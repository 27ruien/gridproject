# GitHub Actions Dev Deployment

This runbook configures manual, auditable GridProject Dev deployments from the GitHub Actions page. It applies only to the Dev host and `gridproject_dev`. GitHub never receives the database URL, database password, `server/.env`, initial administrator password, session secret, root password, or any production credential.

## 1. Create a dedicated SSH key

On an administrator Mac, create a key used only by GridProject Dev Actions:

```bash
ssh-keygen \
  -t ed25519 \
  -C "github-actions-gridproject-dev" \
  -f ~/.ssh/gridproject_dev_actions
```

The files have separate destinations:

- `~/.ssh/gridproject_dev_actions`: private key, stored in the GitHub `dev` Environment Secret `DEV_SSH_PRIVATE_KEY`.
- `~/.ssh/gridproject_dev_actions.pub`: public key, installed for the server's `deploy` user.

Do not reuse a root key, a personal SSH key, or a production deployment key. Never commit either key to this repository.

## 2. Initialize the deploy user

The repository must already exist at `/opt/gridproject`. Upload only the public key with an existing server administrator account, then run the idempotent setup script as root:

```bash
scp ~/.ssh/gridproject_dev_actions.pub <admin>@<dev-host>:/tmp/gridproject_dev_actions.pub

ssh <admin>@<dev-host>
sudo install -m 600 /tmp/gridproject_dev_actions.pub /root/gridproject_dev_actions.pub
cd /opt/gridproject
sudo bash scripts/setup-deploy-user.sh \
  --public-key-file /root/gridproject_dev_actions.pub
sudo rm -f /tmp/gridproject_dev_actions.pub /root/gridproject_dev_actions.pub
```

The setup script can be run again with the same key. It does not duplicate the key or sudo configuration. It prepares:

- `/home/deploy/.ssh/authorized_keys`
- write access for `/opt/gridproject` and the three GridProject Dev frontend directories
- `/var/backups/gridproject`
- `/var/lib/gridproject-dev/deployments`
- `/var/log/gridproject-deploy`
- `/var/lock/gridproject-dev-deploy.lock`

The existing owner and mode of `/opt/gridproject/server/.env` are preserved. The setup script adds only a read ACL for `deploy`, so it does not replace the service account's access or rewrite the file.

The generated sudoers rule allows only these service operations:

```text
systemctl restart gridproject-dev
systemctl status gridproject-dev
journalctl -u gridproject-dev
```

It does not grant `NOPASSWD: ALL`, Nginx administration, access to another service, or a root shell.

Test the dedicated key from the administrator Mac:

```bash
ssh \
  -i ~/.ssh/gridproject_dev_actions \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  deploy@<dev-host>
```

Confirm `/opt/gridproject/server/.env` remains on the server and contains only the Dev configuration. Do not upload that file to GitHub.

## 3. Create the GitHub Environment

In `27ruien/gridproject`, open:

```text
Settings
→ Environments
→ New environment
→ dev
```

Environment protection rules and required reviewers can be enabled here. Both deployment workflows use `environment: dev`, so those rules apply before any SSH connection.

## 4. Add Environment Secrets

Under `Settings → Environments → dev → Environment secrets`, add exactly:

| Secret | Value |
| --- | --- |
| `DEV_SSH_HOST` | Dev server hostname or address |
| `DEV_SSH_PORT` | SSH port, normally `22` |
| `DEV_SSH_USER` | `deploy` |
| `DEV_SSH_PRIVATE_KEY` | Entire dedicated private key file |

Do not create GitHub Secrets for `DATABASE_URL`, a database password, `server/.env`, `ADMIN_PASSWORD`, `SESSION_SECRET`, a root password, or any production value.

## 5. Prepare the first deployment

Before the first Actions deployment, an administrator must ensure:

1. `/opt/gridproject` is a clean clone whose `origin` is `https://github.com/27ruien/gridproject`.
2. `/opt/gridproject/server/.env` points to `127.0.0.1:5432/gridproject_dev` with `NODE_ENV` other than `production`.
3. `gridproject-dev.service` exists and starts the backend from `/opt/gridproject/server`.
4. Nginx serves `/var/www/gridproject-dev` and proxies `/api` to `127.0.0.1:3000`.
5. PostgreSQL client tools `pg_dump` and `pg_isready`, Node.js, npm, curl, Git, flock, sudo, and the ACL tool `setfacl` are installed.

For a completely empty Dev database, perform the documented initial `migrate deploy` and seed from [Dev Deployment](dev-deployment.md) before relying on a running service. Never use `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` on the server.

## 6. Run a manual Dev deployment

Open:

```text
Actions
→ Deploy Dev
→ Run workflow
```

Use:

```text
ref=main
run_seed=false
confirm_environment=dev
```

Inputs:

- `ref`: branch, tag, or full Commit SHA. The Runner resolves it to an exact SHA, and the server verifies that Commit came from `origin`.
- `run_seed`: defaults to `false`. Set it to `true` only when the idempotent initial data seed is intentionally required.
- `confirm_environment`: must be exactly `dev`.

The Runner first performs frontend lint/test/build, backend lint/build, Prisma validate/generate, and the tracked-secret check. These checks do not connect to `gridproject_dev` or `gridproject_prod`. The server then acquires the deployment lock, validates its clean worktree and Dev-only database target, creates a custom-format backup, runs forward migrations, optionally seeds, builds API-mode assets, switches the frontend atomically, restarts the backend, and checks both health endpoints.

`Deploy Dev` and `Rollback Dev` share the `gridproject-dev-deployment` concurrency group. A second workflow waits at GitHub, while the non-blocking server `flock` prevents overlapping manual server operations.

## 7. Read deployment results

Open the workflow run and inspect:

- Job steps for Runner checks and sanitized SSH output.
- `Summary` for the environment, target Commit, timing, backup, migration, seed, build, health, and automatic rollback status.
- `/var/log/gridproject-deploy` on the server for deployment and rollback logs.
- `/var/lib/gridproject-dev/deployments` for machine-readable deployment records.
- `sudo journalctl -u gridproject-dev` for backend service output.

Logs and summaries do not print the full database URL or SSH private key. The public Dev address is represented generically in the Summary so a secret host value is not re-emitted.

## 8. Roll back Dev code

Find a full Commit SHA from a successful server deployment record. Then open:

```text
Actions
→ Rollback Dev
→ Run workflow
```

Enter:

```text
target_commit=<full successful deployment SHA>
confirm_environment=dev
```

The rollback script refuses an unrecorded Commit, a dirty worktree, a non-Dev database URL, and a target whose Prisma migration status is incompatible with the current database. If validation passes, it builds the target frontend and backend, atomically switches the frontend, restarts the service, and verifies health.

Rollback never runs a down migration and never restores a database backup. A code rollback can still be incompatible with schema changes even when migration status is clean; review the migration history before approval. If the rollback target fails health checks, the script attempts to restore the code and frontend that were active when rollback began.

## 9. Failed deployment behavior

- Backup failure: migration, frontend replacement, and restart do not run.
- Migration failure: frontend replacement and restart do not run; the backup path is reported.
- Build failure: the active frontend and running backend remain unchanged.
- Restart or health failure after activation: previous code and frontend are rebuilt/restored and health is checked again.
- Database migration: never reversed automatically. The backup path is provided for an administrator or DBA to assess manually.

The server retains the ten newest `gridproject_dev_before_*.dump` files. Backups contain Dev data and must be protected as sensitive server-side artifacts.

## 10. Security boundary

- GitHub stores only the four dedicated Dev SSH values.
- GitHub does not store the database password or `server/.env`.
- GitHub does not use a root password or root private key.
- The `deploy` user has narrowly scoped sudo commands for `gridproject-dev` only.
- Deployment rejects port `5433`, `gridproject_prod`, non-local database hosts, and `NODE_ENV=production`.
- The workflows do not connect from the Runner to a server database.
- Database migrations are forward-only and are not automatically rolled back.
