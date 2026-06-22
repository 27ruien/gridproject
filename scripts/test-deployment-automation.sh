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
    .github/workflows/deploy-dev.yml \
    .github/workflows/rollback-dev.yml \
    .github/workflows/ci.yml
else
  fail "Ruby is required for the local Workflow YAML syntax check."
fi

assert_contains .github/workflows/deploy-dev.yml '^name: Deploy Dev$' "Deploy workflow name is missing"
assert_contains .github/workflows/deploy-dev.yml 'workflow_dispatch:' "Deploy workflow must be manual"
assert_contains .github/workflows/deploy-dev.yml 'confirm_environment' "Deploy confirmation input is missing"
assert_contains .github/workflows/deploy-dev.yml 'CONFIRM_ENVIRONMENT.*!=.*dev' "Deploy must reject non-Dev confirmation"
assert_contains .github/workflows/deploy-dev.yml 'environment: dev' "Deploy job must use the Dev environment"
assert_contains .github/workflows/deploy-dev.yml 'group: gridproject-dev-deployment' "Deploy concurrency group is missing"
assert_contains .github/workflows/deploy-dev.yml 'cancel-in-progress: false' "Deploy concurrency must not cancel active work"
assert_contains .github/workflows/deploy-dev.yml 'StrictHostKeyChecking=yes' "Strict SSH host checking is required"
assert_contains .github/workflows/deploy-dev.yml 'BatchMode=yes' "SSH password prompts must be disabled"
assert_contains .github/workflows/deploy-dev.yml 'chmod 600.*SSH_KEY_PATH' "Temporary SSH key permissions are unsafe"
assert_not_contains .github/workflows/deploy-dev.yml 'uses:.*(ssh|scp)' "Third-party SSH actions are forbidden"
assert_contains .github/workflows/deploy-dev.yml 'git bundle create.*gridproject-dev\.bundle' "Deploy workflow must create a Git bundle"
assert_contains .github/workflows/deploy-dev.yml '^[[:space:]]+scp[[:space:]]*\\' "Deploy workflow must upload the bundle with SCP"
assert_contains .github/workflows/deploy-dev.yml 'git bundle verify.*REMOTE_BUNDLE_PATH' "Server must verify the uploaded bundle"
assert_contains .github/workflows/deploy-dev.yml 'git fetch "\$REMOTE_BUNDLE_PATH" refs/heads/gridproject-deploy-bundle:refs/remotes/gridproject-deploy-bundle/main' "Server must fetch the target commit from the local bundle"
assert_contains .github/workflows/deploy-dev.yml 'imported_commit.*==.*TARGET_COMMIT' "Bundle import SHA must match TARGET_COMMIT"
assert_contains .github/workflows/deploy-dev.yml 'GRIDPROJECT_LOCAL_BUNDLE_DEPLOY=1 bash scripts/deploy-dev\.sh' "Server must run deploy-dev.sh in local bundle mode"
assert_contains .github/workflows/deploy-dev.yml 'trap cleanup_bundle EXIT' "Remote bundle cleanup trap is missing"
assert_contains .github/workflows/deploy-dev.yml 'rm -f --.*REMOTE_BUNDLE_PATH' "Temporary bundle cleanup is missing"

workflow_secrets="$(grep -Eo 'secrets\.[A-Z0-9_]+' .github/workflows/deploy-dev.yml .github/workflows/rollback-dev.yml \
  | sed 's/.*secrets\.//' \
  | sort -u \
  | tr '\n' ' ')"
[[ "$workflow_secrets" == "DEV_SSH_HOST DEV_SSH_PORT DEV_SSH_PRIVATE_KEY DEV_SSH_USER " ]] \
  || fail "Workflows may read only the four approved Dev SSH secrets."

assert_contains scripts/deploy-dev.sh 'flock -n' "Deployment lock must be non-blocking"
assert_contains scripts/deploy-dev.sh 'git status --porcelain' "Dirty worktree check is missing"
assert_contains scripts/deploy-dev.sh 'target.*does not resolve to a commit' "Missing target commits must be rejected"
assert_contains scripts/deploy-dev.sh 'GRIDPROJECT_LOCAL_BUNDLE_DEPLOY' "Local bundle deployment mode is missing"
assert_contains scripts/deploy-dev.sh 'bundle deployment requires current HEAD to match target commit' "Bundle mode must verify the current HEAD"
assert_contains scripts/deploy-dev.sh 'git fetch origin --prune --tags' "Default deployment mode must keep remote fetch validation"
assert_contains scripts/deploy-dev.sh 'target commit is not reachable from the remote repository' "Default deployment mode must keep remote reachability validation"
assert_before scripts/deploy-dev.sh 'GRIDPROJECT_LOCAL_BUNDLE_DEPLOY' 'git fetch origin --prune --tags' "Bundle mode must branch before any origin fetch"
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
assert_not_contains .github/workflows/deploy-dev.yml '(DATABASE_URL|ADMIN_PASSWORD|SESSION_SECRET|gridproject_prod)' "Deployment workflow must not contain application or database secrets"

echo "Deployment automation static tests passed."
