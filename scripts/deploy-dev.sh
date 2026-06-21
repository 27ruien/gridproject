#!/usr/bin/env bash
set -Eeuo pipefail

readonly PROJECT_DIR="${GRIDPROJECT_PROJECT_DIR:-/opt/gridproject}"
readonly ENV_FILE="$PROJECT_DIR/server/.env"
readonly FRONTEND_CURRENT="${GRIDPROJECT_FRONTEND_DIR:-/var/www/gridproject-dev}"
readonly FRONTEND_NEXT="${GRIDPROJECT_FRONTEND_NEXT_DIR:-/var/www/gridproject-dev-next}"
readonly FRONTEND_PREVIOUS="${GRIDPROJECT_FRONTEND_PREVIOUS_DIR:-/var/www/gridproject-dev-previous}"
readonly BACKUP_DIR="${GRIDPROJECT_BACKUP_DIR:-/var/backups/gridproject}"
readonly STATE_DIR="${GRIDPROJECT_STATE_DIR:-/var/lib/gridproject-dev/deployments}"
readonly LOG_DIR="${GRIDPROJECT_LOG_DIR:-/var/log/gridproject-deploy}"
readonly LOCK_FILE="${GRIDPROJECT_LOCK_FILE:-/var/lock/gridproject-dev-deploy.lock}"
readonly SERVICE_NAME="gridproject-dev"

TARGET_INPUT="${1:-}"
RUN_SEED="${2:-false}"
START_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
END_TIME=""
CURRENT_COMMIT="unknown"
TARGET_COMMIT="unknown"
FINAL_COMMIT="unknown"
BACKUP_PATH="not-created"
BACKUP_RESULT="not-started"
MIGRATION_RESULT="not-started"
SEED_RESULT="not-requested"
FRONTEND_BUILD_RESULT="not-started"
BACKEND_BUILD_RESULT="not-started"
HEALTH_RESULT="not-started"
ROLLBACK_OCCURRED="no"
STATUS="failed"
RECORD_FILE=""

usage() {
  echo "Usage: scripts/deploy-dev.sh <target-ref-or-sha> <run-seed:true|false>" >&2
}

fail() {
  echo "Deployment failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command '$1' is not installed."
}

write_record() {
  [[ -n "$RECORD_FILE" ]] || return 0
  local temp_record="${RECORD_FILE}.tmp"
  {
    printf 'type=deployment\n'
    printf 'status=%s\n' "$STATUS"
    printf 'start_time=%s\n' "$START_TIME"
    printf 'end_time=%s\n' "$END_TIME"
    printf 'deployment_user=%s\n' "$(id -un)"
    printf 'current_commit=%s\n' "$CURRENT_COMMIT"
    printf 'target_commit=%s\n' "$TARGET_COMMIT"
    printf 'backup_path=%s\n' "$BACKUP_PATH"
    printf 'backup_result=%s\n' "$BACKUP_RESULT"
    printf 'migration_result=%s\n' "$MIGRATION_RESULT"
    printf 'seed_result=%s\n' "$SEED_RESULT"
    printf 'frontend_build_result=%s\n' "$FRONTEND_BUILD_RESULT"
    printf 'backend_build_result=%s\n' "$BACKEND_BUILD_RESULT"
    printf 'health_result=%s\n' "$HEALTH_RESULT"
    printf 'rollback_occurred=%s\n' "$ROLLBACK_OCCURRED"
    printf 'final_commit=%s\n' "$FINAL_COMMIT"
  } > "$temp_record"
  mv -f "$temp_record" "$RECORD_FILE"
}

emit_summary() {
  printf 'DEPLOY_SUMMARY_START_TIME=%s\n' "$START_TIME"
  printf 'DEPLOY_SUMMARY_END_TIME=%s\n' "$END_TIME"
  printf 'DEPLOY_SUMMARY_BACKUP=%s\n' "$BACKUP_RESULT"
  printf 'DEPLOY_SUMMARY_MIGRATION=%s\n' "$MIGRATION_RESULT"
  printf 'DEPLOY_SUMMARY_SEED=%s\n' "$SEED_RESULT"
  printf 'DEPLOY_SUMMARY_FRONTEND_BUILD=%s\n' "$FRONTEND_BUILD_RESULT"
  printf 'DEPLOY_SUMMARY_BACKEND_BUILD=%s\n' "$BACKEND_BUILD_RESULT"
  printf 'DEPLOY_SUMMARY_HEALTH=%s\n' "$HEALTH_RESULT"
  printf 'DEPLOY_SUMMARY_ROLLBACK=%s\n' "$ROLLBACK_OCCURRED"
  printf 'DEPLOY_SUMMARY_DEV_ADDRESS=%s\n' "configured Dev URL"
}

finish() {
  local exit_code=$?
  set +e
  END_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  write_record
  emit_summary
  exit "$exit_code"
}
trap finish EXIT

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v npx >/dev/null 2>&1; then
    npx --yes pnpm@11.0.7 "$@"
  else
    fail "pnpm is unavailable and npx fallback is not installed."
  fi
}

resolve_target_commit() {
  local candidate
  for candidate in "$TARGET_INPUT" "origin/$TARGET_INPUT" "refs/remotes/origin/$TARGET_INPUT" "refs/tags/$TARGET_INPUT"; do
    if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
      git rev-parse "${candidate}^{commit}"
      return 0
    fi
  done
  return 1
}

is_remote_commit() {
  local commit="$1"
  local remote_ref
  while IFS= read -r remote_ref; do
    if git merge-base --is-ancestor "$commit" "$remote_ref"; then
      return 0
    fi
  done < <(git for-each-ref --format='%(refname)' refs/remotes/origin)

  git ls-remote origin 'refs/tags/*' 'refs/tags/*^{}' 2>/dev/null \
    | awk '{print $1}' \
    | grep -Fxq "$commit"
}

validate_database_url() {
  local parsed
  # JavaScript template interpolation is intentional here.
  # shellcheck disable=SC2016
  parsed=$(node -e '
    const value = process.env.DATABASE_URL || "";
    let url;
    try { url = new URL(value); } catch { process.exit(2); }
    const host = url.hostname;
    const port = url.port || "5432";
    const database = url.pathname.replace(/^\/+/, "");
    process.stdout.write(`${host}\t${port}\t${database}`);
  ') || fail "DATABASE_URL in server/.env is invalid."

  local db_host db_port db_name
  IFS=$'\t' read -r db_host db_port db_name <<< "$parsed"
  [[ "$db_host" == "127.0.0.1" || "$db_host" == "localhost" ]] \
    || fail "database host must be 127.0.0.1 or localhost."
  [[ "$db_port" == "5432" ]] || fail "database port must be 5432; production port 5433 is forbidden."
  [[ "$db_name" == "gridproject_dev" ]] || fail "database name must be exactly gridproject_dev."
  [[ "$db_name" != *prod* ]] || fail "production-looking database names are forbidden."
  echo "Database target verified as local Dev PostgreSQL (credentials hidden)."
}

retain_recent_backups() {
  local -a backups=()
  local index
  mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gridproject_dev_before_*.dump' -printf '%T@ %p\n' \
    | sort -rn \
    | cut -d' ' -f2-)
  for ((index = 10; index < ${#backups[@]}; index += 1)); do
    rm -f -- "${backups[$index]}"
  done
}

check_health() {
  local deadline=$((SECONDS + 60))
  local body_file http_code url
  body_file=$(mktemp)
  while ((SECONDS < deadline)); do
    local all_healthy=true
    for url in "http://127.0.0.1:3000/api/health" "http://127.0.0.1/api/health"; do
      http_code=$(curl --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 5 "$url" 2>/dev/null || true)
      if [[ "$http_code" != "200" ]] || ! node -e '
        const fs = require("node:fs");
        const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (value.status !== "ok") process.exit(1);
      ' "$body_file" >/dev/null 2>&1; then
        all_healthy=false
        break
      fi
    done
    if [[ "$all_healthy" == "true" ]]; then
      rm -f "$body_file"
      return 0
    fi
    sleep 2
  done
  rm -f "$body_file"
  return 1
}

restore_previous_frontend() {
  [[ -d "$FRONTEND_PREVIOUS" ]] || return 1
  rm -rf "$FRONTEND_NEXT"
  if [[ -e "$FRONTEND_CURRENT" ]]; then
    mv "$FRONTEND_CURRENT" "$FRONTEND_NEXT"
  fi
  if ! mv "$FRONTEND_PREVIOUS" "$FRONTEND_CURRENT"; then
    [[ -e "$FRONTEND_NEXT" ]] && mv "$FRONTEND_NEXT" "$FRONTEND_CURRENT"
    return 1
  fi
  return 0
}

automatic_rollback() {
  ROLLBACK_OCCURRED="yes"
  echo "Activation failed; restoring the previous code and frontend."
  echo "Database migrations are not rolled back automatically. Backup: $BACKUP_PATH"

  local rollback_ok=true
  set +e
  git checkout --detach "$CURRENT_COMMIT" >/dev/null 2>&1 || rollback_ok=false
  npm ci || rollback_ok=false
  run_pnpm --dir server install --frozen-lockfile || rollback_ok=false
  npm run server:build || rollback_ok=false
  restore_previous_frontend || rollback_ok=false
  sudo systemctl restart "$SERVICE_NAME" || rollback_ok=false
  if [[ "$rollback_ok" == "true" ]] && check_health; then
    HEALTH_RESULT="failed; previous release healthy"
    FINAL_COMMIT="$CURRENT_COMMIT"
    STATUS="failed-rolled-back"
    echo "Automatic code and frontend rollback succeeded."
  else
    HEALTH_RESULT="failed; automatic rollback failed"
    FINAL_COMMIT="unknown"
    STATUS="failed-rollback-incomplete"
    echo "Automatic rollback did not restore health. Administrator review is required." >&2
    sudo journalctl -u "$SERVICE_NAME" -n 100 --no-pager || true
  fi
  set -e
}

[[ -n "$TARGET_INPUT" ]] || { usage; fail "target ref or commit is required."; }
[[ "$RUN_SEED" == "true" || "$RUN_SEED" == "false" ]] || { usage; fail "run-seed must be true or false."; }

require_command flock
exec 9>"$LOCK_FILE"
flock -n 9 || fail "another GridProject Dev deployment or rollback is already running."

RUN_USER="$(id -un)"
if [[ "$RUN_USER" != "deploy" && "${GRIDPROJECT_ALLOW_ADMIN:-false}" != "true" ]]; then
  fail "must run as deploy; an administrator may explicitly set GRIDPROJECT_ALLOW_ADMIN=true for a manual test."
fi

[[ -d "$PROJECT_DIR/.git" ]] || fail "$PROJECT_DIR is not a Git repository."
[[ -r "$ENV_FILE" ]] || fail "$ENV_FILE is missing or unreadable."
[[ -d "$FRONTEND_CURRENT" && -w "$FRONTEND_CURRENT" ]] || fail "$FRONTEND_CURRENT must exist and be writable."
[[ -w "$(dirname "$FRONTEND_CURRENT")" ]] || fail "the frontend parent directory must permit atomic directory replacement."
[[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]] || fail "$BACKUP_DIR is missing or not writable."
[[ -d "$STATE_DIR" && -w "$STATE_DIR" ]] || fail "$STATE_DIR is missing or not writable."
[[ -d "$LOG_DIR" && -w "$LOG_DIR" ]] || fail "$LOG_DIR is missing or not writable."

require_command git
require_command node
require_command npm
require_command pg_dump
require_command pg_isready
require_command curl
require_command systemctl
require_command sudo
require_command sha256sum
if ! command -v pnpm >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  fail "either pnpm or npx is required for backend dependencies."
fi
systemctl cat "${SERVICE_NAME}.service" >/dev/null 2>&1 || fail "${SERVICE_NAME}.service does not exist."

LOG_FILE="$LOG_DIR/deploy-$(date -u +%Y%m%d-%H%M%S)-$$.log"
RECORD_FILE="$STATE_DIR/deploy-$(date -u +%Y%m%d-%H%M%S)-$$.record"
exec > >(tee -a "$LOG_FILE") 2>&1

cd "$PROJECT_DIR"
[[ -z "$(git status --porcelain)" ]] || fail "Git worktree is dirty; no reset or cleanup was performed."
CURRENT_COMMIT="$(git rev-parse HEAD)"
FINAL_COMMIT="$CURRENT_COMMIT"
ENV_HASH="$(sha256sum "$ENV_FILE" | awk '{print $1}')"

echo "Deployment started at $START_TIME by $RUN_USER."
echo "Current commit: $CURRENT_COMMIT"
echo "Requested target: $TARGET_INPUT"

git fetch origin --prune --tags
TARGET_COMMIT="$(resolve_target_commit)" || fail "target '$TARGET_INPUT' does not resolve to a commit."
is_remote_commit "$TARGET_COMMIT" || fail "target commit is not reachable from the remote repository."
echo "Target commit: $TARGET_COMMIT"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is missing from server/.env."

npm run db:safety:dev
validate_database_url
pg_isready -d "$DATABASE_URL" >/dev/null 2>&1 || fail "Dev PostgreSQL is not reachable."

SHORT_SHA="$(git rev-parse --short=12 "$TARGET_COMMIT")"
BACKUP_PATH="$BACKUP_DIR/gridproject_dev_before_${SHORT_SHA}_$(date -u +%Y%m%d-%H%M%S).dump"
echo "Creating pre-migration Dev backup at $BACKUP_PATH"
if ! pg_dump -Fc --file "$BACKUP_PATH" "$DATABASE_URL"; then
  BACKUP_RESULT="failed"
  rm -f "$BACKUP_PATH"
  fail "pg_dump failed; migration and deployment were not started."
fi
BACKUP_RESULT="success"
retain_recent_backups

git checkout --detach "$TARGET_COMMIT"
[[ -r "$ENV_FILE" ]] || fail "server/.env disappeared after checkout."
[[ "$(sha256sum "$ENV_FILE" | awk '{print $1}')" == "$ENV_HASH" ]] || fail "server/.env changed during checkout."

npm ci
run_pnpm --dir server install --frozen-lockfile

echo "Applying forward-only Prisma migrations. Backup: $BACKUP_PATH"
if ! npm run db:migrate:deploy:dev; then
  MIGRATION_RESULT="failed"
  fail "migration failed; frontend was not replaced and backend was not restarted. Backup: $BACKUP_PATH"
fi
MIGRATION_RESULT="success"

if [[ "$RUN_SEED" == "true" ]]; then
  npm run server:prisma:seed
  SEED_RESULT="executed"
else
  SEED_RESULT="not-requested"
fi

if VITE_DATA_SOURCE=api VITE_API_BASE_URL=/api npm run build && [[ -f dist/index.html ]]; then
  FRONTEND_BUILD_RESULT="success"
else
  FRONTEND_BUILD_RESULT="failed"
  fail "frontend API build failed or dist/index.html is missing."
fi

if npm run server:build && [[ -f server/dist/server.js ]]; then
  BACKEND_BUILD_RESULT="success"
else
  BACKEND_BUILD_RESULT="failed"
  fail "backend build failed or server/dist/server.js is missing."
fi

rm -rf "$FRONTEND_NEXT"
cp -a dist "$FRONTEND_NEXT"
[[ -f "$FRONTEND_NEXT/index.html" ]] || fail "staged frontend is missing index.html."
rm -rf "$FRONTEND_PREVIOUS"
if ! mv "$FRONTEND_CURRENT" "$FRONTEND_PREVIOUS"; then
  fail "could not move the current frontend to the previous slot."
fi
if ! mv "$FRONTEND_NEXT" "$FRONTEND_CURRENT"; then
  mv "$FRONTEND_PREVIOUS" "$FRONTEND_CURRENT" || true
  fail "frontend swap failed; the previous frontend was restored."
fi
if ! sudo systemctl restart "$SERVICE_NAME"; then
  automatic_rollback
  fail "backend restart failed after activation."
fi

if ! check_health; then
  sudo systemctl status "$SERVICE_NAME" || true
  sudo journalctl -u "$SERVICE_NAME" -n 100 --no-pager || true
  automatic_rollback
  fail "health checks failed after activation."
fi

HEALTH_RESULT="success"
FINAL_COMMIT="$TARGET_COMMIT"
STATUS="success"
echo "Deployment completed successfully at commit $TARGET_COMMIT."
