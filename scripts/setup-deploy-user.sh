#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEPLOY_USER="deploy"
readonly DEPLOY_GROUP="deploy"
PUBLIC_KEY_FILE=""

usage() {
  echo "Usage: sudo bash scripts/setup-deploy-user.sh --public-key-file /path/to/gridproject_dev_actions.pub" >&2
}

fail() {
  echo "Deploy user setup failed: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --public-key-file)
      [[ $# -ge 2 ]] || { usage; fail "--public-key-file requires a path."; }
      PUBLIC_KEY_FILE="$2"
      shift 2
      ;;
    *)
      usage
      fail "unknown argument: $1"
      ;;
  esac
done

[[ "$(id -u)" == "0" ]] || fail "this script must be run as root through sudo."
[[ -n "$PUBLIC_KEY_FILE" && -r "$PUBLIC_KEY_FILE" ]] || fail "a readable public key file is required."
command -v setfacl >/dev/null 2>&1 || fail "setfacl is required for scoped file and /var/www access."

PUBLIC_KEY="$(tr -d '\r\n' < "$PUBLIC_KEY_FILE")"
[[ "$PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))[[:space:]] ]] \
  || fail "the supplied file does not contain a supported SSH public key."

if ! getent group "$DEPLOY_GROUP" >/dev/null 2>&1; then
  groupadd "$DEPLOY_GROUP"
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --gid "$DEPLOY_GROUP" --shell /bin/bash "$DEPLOY_USER"
else
  usermod --append --groups "$DEPLOY_GROUP" "$DEPLOY_USER"
fi

DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
[[ -n "$DEPLOY_HOME" ]] || fail "could not determine deploy user home directory."

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$DEPLOY_HOME/.ssh"
touch "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
if ! grep -Fxq "$PUBLIC_KEY" "$DEPLOY_HOME/.ssh/authorized_keys"; then
  printf '%s\n' "$PUBLIC_KEY" >> "$DEPLOY_HOME/.ssh/authorized_keys"
fi

[[ -d /opt/gridproject/.git ]] || fail "/opt/gridproject must already be a Git repository."
find /opt/gridproject -path /opt/gridproject/server/.env -prune -o -exec chown "$DEPLOY_USER:$DEPLOY_GROUP" {} +
if [[ -e /opt/gridproject/server/.env ]]; then
  setfacl -m "u:${DEPLOY_USER}:r" /opt/gridproject/server/.env
fi

install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" \
  /var/backups/gridproject \
  /var/lib/gridproject-dev/deployments \
  /var/log/gridproject-deploy

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" \
  /var/www/gridproject-dev \
  /var/www/gridproject-dev-next \
  /var/www/gridproject-dev-previous

# Atomic sibling-directory renames require write access to /var/www. The sticky
# bit prevents deploy from removing entries owned by another user.
chmod +t /var/www
setfacl -m "u:${DEPLOY_USER}:rwx" /var/www

touch /var/lock/gridproject-dev-deploy.lock
chown "$DEPLOY_USER:$DEPLOY_GROUP" /var/lock/gridproject-dev-deploy.lock
chmod 600 /var/lock/gridproject-dev-deploy.lock

SYSTEMCTL_PATH="$(command -v systemctl)"
JOURNALCTL_PATH="$(command -v journalctl)"
[[ -n "$SYSTEMCTL_PATH" && -n "$JOURNALCTL_PATH" ]] || fail "systemctl and journalctl are required."

SUDOERS_FILE="/etc/sudoers.d/gridproject-dev-deploy"
SUDOERS_TEMP="$(mktemp)"
trap 'rm -f "$SUDOERS_TEMP"' EXIT
{
  printf '%s ALL=(root) NOPASSWD: %s restart gridproject-dev\n' "$DEPLOY_USER" "$SYSTEMCTL_PATH"
  printf '%s ALL=(root) NOPASSWD: %s status gridproject-dev\n' "$DEPLOY_USER" "$SYSTEMCTL_PATH"
  printf '%s ALL=(root) NOPASSWD: %s -u gridproject-dev, %s -u gridproject-dev *\n' \
    "$DEPLOY_USER" "$JOURNALCTL_PATH" "$JOURNALCTL_PATH"
} > "$SUDOERS_TEMP"
chmod 440 "$SUDOERS_TEMP"
visudo -cf "$SUDOERS_TEMP" >/dev/null
install -m 440 -o root -g root "$SUDOERS_TEMP" "$SUDOERS_FILE"

echo "Deploy user setup completed. No private key or application secret was installed."
echo "Test with: ssh deploy@<dev-host>"
