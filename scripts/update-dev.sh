#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/opt/gridproject"
DEPLOY_USER="deploy"
LOCK_FILE="/var/lock/gridproject-dev-update.lock"

fail() {
  echo "Dev update failed: $*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

command -v flock >/dev/null 2>&1 || fail "flock is not installed."
command -v sudo >/dev/null 2>&1 || fail "sudo is not installed."
command -v systemctl >/dev/null 2>&1 || fail "systemctl is not installed."
command -v curl >/dev/null 2>&1 || fail "curl is not installed."

exec 9>"$LOCK_FILE"
flock -n 9 || fail "another GridProject Dev update is already running."

[[ -d "$PROJECT_DIR" ]] || fail "$PROJECT_DIR does not exist."
[[ -d "$PROJECT_DIR/.git" ]] || fail "$PROJECT_DIR is not a Git repository."
id "$DEPLOY_USER" >/dev/null 2>&1 || fail "deploy user does not exist."
[[ -f "$PROJECT_DIR/scripts/deploy-dev.sh" ]] || fail "scripts/deploy-dev.sh is missing."
[[ -r "$PROJECT_DIR/server/.env" ]] || fail "server/.env is missing or unreadable."

PROJECT_OWNER="$(stat -c '%U:%G' "$PROJECT_DIR")"
if [[ "$PROJECT_OWNER" != "$DEPLOY_USER:$DEPLOY_USER" ]]; then
  echo "$PROJECT_DIR must be owned by $DEPLOY_USER:$DEPLOY_USER." >&2
  echo "Run: chown -R $DEPLOY_USER:$DEPLOY_USER $PROJECT_DIR" >&2
  exit 1
fi

sudo -u "$DEPLOY_USER" test -r "$PROJECT_DIR/server/.env" \
  || fail "server/.env is not readable by $DEPLOY_USER."

TRACKED_CHANGES="$(sudo -u "$DEPLOY_USER" -H bash -lc \
  'cd /opt/gridproject && git status --porcelain --untracked-files=no')"
if [[ -n "$TRACKED_CHANGES" ]]; then
  echo "Tracked worktree changes are present:" >&2
  printf '%s\n' "$TRACKED_CHANGES" >&2
  exit 1
fi

sudo -u "$DEPLOY_USER" -H bash -lc \
  'cd /opt/gridproject && git fetch origin main && git switch -C main origin/main'

TARGET_COMMIT="$(sudo -u "$DEPLOY_USER" -H bash -lc \
  'cd /opt/gridproject && git rev-parse HEAD')"
echo "Deploying commit: $TARGET_COMMIT"

sudo -u "$DEPLOY_USER" -H bash -lc \
  "cd /opt/gridproject && bash scripts/deploy-dev.sh '$TARGET_COMMIT' false"

systemctl is-active --quiet gridproject-dev \
  || fail "gridproject-dev is not active."
curl -fsS --max-time 10 http://127.0.0.1:3000/api/health > /dev/null \
  || fail "API health check failed."
curl -fsSI --max-time 10 -H 'Host: 101.133.150.129' http://127.0.0.1/ > /dev/null \
  || fail "frontend health check failed."

echo "Dev deployment completed."
echo "Commit: $TARGET_COMMIT"
echo "Frontend: http://101.133.150.129/"
echo "API health: OK"
