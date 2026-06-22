#!/usr/bin/env bash
set -Eeuo pipefail

readonly PROJECT_DIR="${GRIDPROJECT_PROJECT_DIR:-/opt/gridproject}"
readonly ENV_FILE="$PROJECT_DIR/server/.env"
readonly FRONTEND_CURRENT="${GRIDPROJECT_FRONTEND_DIR:-/var/www/gridproject-dev}"
readonly FRONTEND_NEXT="${GRIDPROJECT_FRONTEND_NEXT_DIR:-/var/www/gridproject-dev-next}"
readonly FRONTEND_PREVIOUS="${GRIDPROJECT_FRONTEND_PREVIOUS_DIR:-/var/www/gridproject-dev-previous}"
readonly STATE_DIR="${GRIDPROJECT_STATE_DIR:-/var/lib/gridproject-dev/deployments}"
readonly LOG_DIR="${GRIDPROJECT_LOG_DIR:-/var/log/gridproject-deploy}"
readonly LOCK_FILE="${GRIDPROJECT_LOCK_FILE:-/var/lock/gridproject-dev-deploy.lock}"
readonly SERVICE_NAME="gridproject-dev"

TARGET_INPUT="${1:-}"
START_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
END_TIME=""
CURRENT_COMMIT="unknown"
TARGET_COMMIT="unknown"
FINAL_COMMIT="unknown"
HISTORY_RESULT="not-started"
COMPATIBILITY_RESULT="not-started"
FRONTEND_BUILD_RESULT="not-started"
BACKEND_BUILD_RESULT="not-started"
HEALTH_RESULT="not-started"
STATUS="failed"
RECORD_FILE=""

fail() {
  echo "Rollback failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command '$1' is not installed."
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v npx >/dev/null 2>&1; then
    npx --yes pnpm@11.0.7 "$@"
  else
    fail "pnpm is unavailable and npx fallback is not installed."
  fi
}

write_record() {
  [[ -n "$RECORD_FILE" ]] || return 0
  local temp_record="${RECORD_FILE}.tmp"
  {
    printf 'type=rollback\n'
    printf 'status=%s\n' "$STATUS"
    printf 'start_time=%s\n' "$START_TIME"
    printf 'end_time=%s\n' "$END_TIME"
    printf 'rollback_user=%s\n' "$(id -un)"
    printf 'current_commit=%s\n' "$CURRENT_COMMIT"
    printf 'target_commit=%s\n' "$TARGET_COMMIT"
    printf 'history_result=%s\n' "$HISTORY_RESULT"
    printf 'compatibility_result=%s\n' "$COMPATIBILITY_RESULT"
    printf 'frontend_build_result=%s\n' "$FRONTEND_BUILD_RESULT"
    printf 'backend_build_result=%s\n' "$BACKEND_BUILD_RESULT"
    printf 'health_result=%s\n' "$HEALTH_RESULT"
    printf 'final_commit=%s\n' "$FINAL_COMMIT"
    printf 'database_rollback=not-performed\n'
  } > "$temp_record"
  mv -f "$temp_record" "$RECORD_FILE"
}

emit_summary() {
  printf 'ROLLBACK_SUMMARY_START_TIME=%s\n' "$START_TIME"
  printf 'ROLLBACK_SUMMARY_END_TIME=%s\n' "$END_TIME"
  printf 'ROLLBACK_SUMMARY_HISTORY=%s\n' "$HISTORY_RESULT"
  printf 'ROLLBACK_SUMMARY_COMPATIBILITY=%s\n' "$COMPATIBILITY_RESULT"
  printf 'ROLLBACK_SUMMARY_FRONTEND_BUILD=%s\n' "$FRONTEND_BUILD_RESULT"
  printf 'ROLLBACK_SUMMARY_BACKEND_BUILD=%s\n' "$BACKEND_BUILD_RESULT"
  printf 'ROLLBACK_SUMMARY_HEALTH=%s\n' "$HEALTH_RESULT"
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

validate_database_url() {
  local parsed
  parsed=$(node -e '
    const value = process.env.DATABASE_URL || "";
    let url;
    try { url = new URL(value); } catch { process.exit(2); }
    process.stdout.write([url.hostname, url.port || "5432", url.pathname.replace(/^\/+/, "")].join("\t"));
  ') || fail "DATABASE_URL in server/.env is invalid."

  local db_host db_port db_name
  IFS=$'\t' read -r db_host db_port db_name <<< "$parsed"
  [[ "$db_host" == "127.0.0.1" || "$db_host" == "localhost" ]] || fail "database host must be local."
  [[ "$db_port" == "5432" ]] || fail "database port must be 5432; port 5433 is forbidden."
  [[ "$db_name" == "gridproject_dev" ]] || fail "database name must be exactly gridproject_dev."
}

target_was_successfully_deployed() {
  local record
  while IFS= read -r -d '' record; do
    if grep -Fxq 'type=deployment' "$record" \
      && grep -Fxq 'status=success' "$record" \
      && grep -Fxq "final_commit=$TARGET_COMMIT" "$record"; then
      return 0
    fi
  done < <(find "$STATE_DIR" -maxdepth 1 -type f -name 'deploy-*.record' -print0)
  return 1
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

restore_original_release() {
  echo "Rollback target failed health checks; restoring the release that was active before rollback."
  local restore_ok=true
  set +e
  git checkout --detach "$CURRENT_COMMIT" >/dev/null 2>&1 || restore_ok=false
  npm ci || restore_ok=false
  run_pnpm --dir server install --frozen-lockfile || restore_ok=false
  npm run server:build || restore_ok=false
  rm -rf "$FRONTEND_NEXT"
  if [[ -e "$FRONTEND_CURRENT" ]]; then
    mv "$FRONTEND_CURRENT" "$FRONTEND_NEXT" || restore_ok=false
  fi
  if [[ -d "$FRONTEND_PREVIOUS" ]]; then
    mv "$FRONTEND_PREVIOUS" "$FRONTEND_CURRENT" || restore_ok=false
  else
    restore_ok=false
  fi
  sudo systemctl restart "$SERVICE_NAME" || restore_ok=false
  if [[ "$restore_ok" == "true" ]] && check_health; then
    FINAL_COMMIT="$CURRENT_COMMIT"
    HEALTH_RESULT="target failed; original release restored"
    STATUS="failed-original-restored"
    echo "Original release restored successfully."
  else
    FINAL_COMMIT="unknown"
    HEALTH_RESULT="target failed; original restore incomplete"
    STATUS="failed-restore-incomplete"
    echo "Original release could not be fully restored; administrator action is required." >&2
    sudo journalctl -u "$SERVICE_NAME" -n 100 --no-pager || true
  fi
  set -e
}

[[ "$TARGET_INPUT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "target_commit must be a full 40-character commit SHA."

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
[[ -d "$STATE_DIR" && -w "$STATE_DIR" ]] || fail "$STATE_DIR is missing or not writable."
[[ -d "$LOG_DIR" && -w "$LOG_DIR" ]] || fail "$LOG_DIR is missing or not writable."

require_command git
require_command node
require_command npm
require_command curl
require_command systemctl
require_command sudo
require_command sha256sum
if ! command -v pnpm >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  fail "either pnpm or npx is required for backend dependencies."
fi
systemctl cat "${SERVICE_NAME}.service" >/dev/null 2>&1 || fail "${SERVICE_NAME}.service does not exist."

LOG_FILE="$LOG_DIR/rollback-$(date -u +%Y%m%d-%H%M%S)-$$.log"
RECORD_FILE="$STATE_DIR/rollback-$(date -u +%Y%m%d-%H%M%S)-$$.record"
exec > >(tee -a "$LOG_FILE") 2>&1

cd "$PROJECT_DIR"
[[ -z "$(git status --porcelain)" ]] || fail "Git worktree is dirty; no reset or cleanup was performed."
CURRENT_COMMIT="$(git rev-parse HEAD)"
FINAL_COMMIT="$CURRENT_COMMIT"
ENV_HASH="$(sha256sum "$ENV_FILE" | awk '{print $1}')"

git fetch origin --prune --tags
TARGET_COMMIT="$(git rev-parse --verify "${TARGET_INPUT}^{commit}")" || fail "target commit does not exist."
if ! target_was_successfully_deployed; then
  HISTORY_RESULT="failed"
  fail "target commit does not appear in a successful server deployment record."
fi
HISTORY_RESULT="success"

echo "Rollback started at $START_TIME by $RUN_USER."
echo "Current commit: $CURRENT_COMMIT"
echo "Validated rollback target: $TARGET_COMMIT"

git checkout --detach "$TARGET_COMMIT"
[[ -r "$ENV_FILE" ]] || fail "server/.env disappeared after checkout."
[[ "$(sha256sum "$ENV_FILE" | awk '{print $1}')" == "$ENV_HASH" ]] || fail "server/.env changed during checkout."

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is missing from server/.env."
validate_database_url

npm ci
run_pnpm --dir server install --frozen-lockfile
run_pnpm --dir server exec prisma generate --schema ../prisma/schema.prisma

echo "Checking rollback target migrations against the current Dev database (read-only status check)."
if ! run_pnpm --dir server exec prisma migrate status --schema ../prisma/schema.prisma; then
  COMPATIBILITY_RESULT="failed"
  fail "target migration history is not compatible with the current database; no code was activated."
fi
COMPATIBILITY_RESULT="passed with code/schema risk acknowledged"

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
mv "$FRONTEND_CURRENT" "$FRONTEND_PREVIOUS"
if ! mv "$FRONTEND_NEXT" "$FRONTEND_CURRENT"; then
  mv "$FRONTEND_PREVIOUS" "$FRONTEND_CURRENT" || true
  fail "frontend swap failed; the active frontend was restored."
fi

if ! sudo systemctl restart "$SERVICE_NAME" || ! check_health; then
  sudo systemctl status "$SERVICE_NAME" || true
  sudo journalctl -u "$SERVICE_NAME" -n 100 --no-pager || true
  restore_original_release
  fail "rollback target did not become healthy."
fi

HEALTH_RESULT="success"
FINAL_COMMIT="$TARGET_COMMIT"
STATUS="success"
echo "Rollback completed successfully at commit $TARGET_COMMIT."
echo "No down migration or database restore was performed."
