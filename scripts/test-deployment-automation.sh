#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "Deployment automation test failed: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  grep -Eq "$pattern" "$file" || fail "$description ($file)"
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if grep -Eiq "$pattern" "$file"; then
    fail "$description ($file)"
  fi
}

line_number() {
  local file="$1"
  local pattern="$2"
  grep -En "$pattern" "$file" | head -n 1 | cut -d: -f1
}

assert_before() {
  local file="$1"
  local first_pattern="$2"
  local second_pattern="$3"
  local description="$4"
  local first_line second_line
  first_line="$(line_number "$file" "$first_pattern")"
  second_line="$(line_number "$file" "$second_pattern")"
  [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]] || fail "$description ($file)"
}

shell_files=(
  scripts/run-pnpm.sh
  scripts/update-dev.sh
  scripts/deploy-dev.sh
  scripts/rollback-dev.sh
  scripts/setup-deploy-user.sh
  scripts/test-deployment-automation.sh
)

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

bash -n "${shell_files[@]}"

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck "${shell_files[@]}"
else
  echo "ShellCheck is not installed; optional ShellCheck pass skipped."
fi

if command -v ruby >/dev/null 2>&1; then
  ruby -e 'require "yaml"; ARGV.each { |file| YAML.load_file(file) }' \
    .github/workflows/rollback-dev.yml \
    .github/workflows/ci.yml
else
  fail "Ruby is required for the local Workflow YAML syntax check."
fi

[[ ! -e .github/workflows/deploy-dev.yml ]] || fail "Deploy Dev workflow must be removed."
[[ -x scripts/update-dev.sh ]] || fail "scripts/update-dev.sh must exist and be executable."
assert_contains scripts/update-dev.sh 'EUID.*-ne 0' "Dev update must require root"
assert_contains scripts/update-dev.sh 'PROJECT_DIR="/opt/gridproject"' "Dev update must use /opt/gridproject"
assert_contains scripts/update-dev.sh 'sudo -u "\$DEPLOY_USER" -H bash -lc' "Git and project commands must run as deploy"
assert_contains scripts/update-dev.sh 'git fetch origin main' "Dev update must use the configured origin"
assert_not_contains scripts/update-dev.sh '(github\.com|gitclone\.com|git[[:space:]]+bundle)' "Dev update must not hardcode a host or use Git bundles"
assert_contains scripts/update-dev.sh 'bash scripts/deploy-dev\.sh.*TARGET_COMMIT.*false' "Dev update must call deploy-dev.sh with seed disabled"
assert_contains scripts/update-dev.sh 'git status --porcelain --untracked-files=no' "Dev update must check tracked worktree changes"
assert_contains scripts/update-dev.sh 'http://127\.0\.0\.1:3000/api/health' "Dev update must check the API on port 3000"
assert_contains scripts/update-dev.sh 'http://127\.0\.0\.1/' "Dev update must check the frontend on port 80"
assert_contains scripts/update-dev.sh 'Host: 101\.133\.150\.129' "Frontend health check must use the Dev Host header"
assert_not_contains scripts/update-dev.sh '5173' "Dev update must not check the Vite port"

workflow_secrets="$(grep -Eo 'secrets\.[A-Z0-9_]+' .github/workflows/rollback-dev.yml \
  | sed 's/.*secrets\.//' \
  | sort -u \
  | tr '\n' ' ')"
[[ "$workflow_secrets" == "DEV_SSH_HOST DEV_SSH_PORT DEV_SSH_PRIVATE_KEY DEV_SSH_USER " ]] \
  || fail "Workflows may read only the four approved Dev SSH secrets."

assert_contains scripts/deploy-dev.sh 'flock -n' "Deployment lock must be non-blocking"
assert_contains scripts/deploy-dev.sh 'git status --porcelain --untracked-files=no' "Tracked worktree check is missing"
assert_contains scripts/deploy-dev.sh 'git cat-file -e.*TARGET_INPUT' "Missing local target commits must be rejected"
assert_contains scripts/deploy-dev.sh 'git cat-file -t.*TARGET_INPUT' "Target object type must be checked"
assert_contains scripts/deploy-dev.sh '\[\[ -n.*TARGET_COMMIT' "Resolved target commit must be non-empty"
assert_contains scripts/deploy-dev.sh 'Current HEAD does not match target commit\.' "HEAD must match the target commit"
assert_contains scripts/deploy-dev.sh 'Host: 101\.133\.150\.129' "Nginx API health check must use the Dev Host header"
assert_not_contains scripts/deploy-dev.sh 'git[[:space:]]+fetch' "deploy-dev.sh must not fetch from a remote"
assert_not_contains scripts/deploy-dev.sh '(GRIDPROJECT_LOCAL_BUNDLE_DEPLOY|git[[:space:]]+bundle)' "Bundle deployment logic must be removed"
assert_contains scripts/deploy-dev.sh 'db:safety:dev' "Dev database safety check is missing"
assert_contains scripts/deploy-dev.sh 'db_port.*5432' "Dev database port must be exact"
assert_contains scripts/deploy-dev.sh '5433.*forbidden' "Production database port must be rejected"
assert_contains scripts/deploy-dev.sh 'db_name.*gridproject_dev' "Dev database name must be exact"
assert_contains scripts/deploy-dev.sh 'db_name.*prod' "Production-looking database names must be rejected"
assert_contains scripts/deploy-dev.sh 'pg_dump -Fc' "Custom-format database backup is missing"
assert_contains scripts/deploy-dev.sh 'if ! pg_dump' "A failed backup must stop deployment"
assert_contains scripts/deploy-dev.sh 'RUN_SEED=".*false' "Seed must default to false"
assert_contains scripts/deploy-dev.sh 'RUN_SEED.*==.*true' "Seed must require explicit true"
assert_contains scripts/deploy-dev.sh 'automatic_rollback' "Health failure must invoke automatic rollback"
assert_contains scripts/deploy-dev.sh 'Database migrations are not rolled back automatically' "No-down-migration warning is missing"
assert_before scripts/deploy-dev.sh 'if ! pg_dump' 'db:migrate:deploy:dev' "Backup must happen before migration"
assert_before scripts/deploy-dev.sh 'db:migrate:deploy:dev' 'mv.*FRONTEND_CURRENT.*FRONTEND_PREVIOUS' "Migration must complete before frontend activation"
assert_not_contains scripts/deploy-dev.sh 'prisma[[:space:]]+(migrate[[:space:]]+(dev|reset)|db[[:space:]]+push)' "Destructive Prisma commands are forbidden"

assert_contains .github/workflows/rollback-dev.yml '^name: Rollback Dev$' "Rollback workflow name is missing"
assert_contains .github/workflows/rollback-dev.yml 'group: gridproject-dev-deployment' "Rollback must share the deployment lock group"
assert_contains scripts/rollback-dev.sh 'target_was_successfully_deployed' "Rollback target must come from deployment history"
assert_contains scripts/rollback-dev.sh 'prisma migrate status' "Rollback needs a read-only migration compatibility check"
assert_contains scripts/rollback-dev.sh 'database_rollback=not-performed' "Rollback record must state that the database was untouched"
assert_not_contains scripts/rollback-dev.sh 'prisma[[:space:]]+(migrate[[:space:]]+(dev|reset)|db[[:space:]]+push)' "Rollback must not downgrade or reset the database"

assert_contains scripts/run-pnpm.sh 'command -v pnpm' "pnpm preference is missing"
assert_contains scripts/run-pnpm.sh 'npx --yes pnpm@11\.0\.7' "npx pnpm fallback is missing"

mkdir -p "$TEMP_DIR/bin"
cat > "$TEMP_DIR/bin/npx" <<'EOF'
#!/bin/sh
printf '%s\n' "$*"
EOF
chmod +x "$TEMP_DIR/bin/npx"
fallback_output="$(PATH="$TEMP_DIR/bin:/usr/bin:/bin" /bin/bash scripts/run-pnpm.sh --dir server --version)"
[[ "$fallback_output" == "--yes pnpm@11.0.7 --dir server --version" ]] \
  || fail "run-pnpm did not invoke the pinned npx fallback as expected."

assert_contains scripts/setup-deploy-user.sh 'NOPASSWD:.*restart gridproject-dev' "Limited service restart sudo rule is missing"
assert_not_contains scripts/setup-deploy-user.sh 'NOPASSWD:[[:space:]]+ALL' "Full passwordless sudo is forbidden"
assert_contains scripts/setup-deploy-user.sh 'setfacl.*SERVICE_USER.*:r' "Service user must receive read access to server/.env"
assert_contains scripts/setup-deploy-user.sh 'setfacl.*SERVICE_USER.*:x' "Service user must receive path traversal access"

echo "Deployment automation static tests passed."
