# Deployment

## Build

```bash
npm ci
corepack enable
corepack prepare pnpm@11.0.7 --activate
pnpm --dir server install --frozen-lockfile
npm run server:prisma:generate
npm run server:prisma:migrate:deploy
npm run server:build
npm run build
```

Use `prisma migrate deploy` for deployed environments. Do not use `db push` or `migrate reset`.

## Environment

Production runtime should provide environment variables outside the repo:

```bash
NODE_ENV="production"
HOST="127.0.0.1"
PORT="3000"
DATABASE_URL="postgresql://gridproject_app:REPLACE_ME@127.0.0.1:5433/gridproject_prod?schema=public"
SESSION_SECRET="REPLACE_WITH_A_LONG_RANDOM_STRING"
SESSION_TTL_HOURS="168"
COOKIE_SECURE="true"
SESSION_COOKIE_NAME="gridproject_prod_session"
SESSION_COOKIE_PATH="/tool/project/"
FRONTEND_ORIGIN="https://gridworks.cn"
```

Do not commit real values. The checked-in examples contain placeholders only.

## Process

Example systemd command:

```bash
WorkingDirectory=/srv/gridproject/server
ExecStart=/usr/bin/node dist/server.js
EnvironmentFile=/etc/gridproject/server.env
```

Serve the Vite build from `dist/` and reverse proxy `/api/` to the Fastify server. See `docs/nginx-gridproject.conf.example`.

## Seed

Production seed is blocked unless `ALLOW_PRODUCTION_SEED=true` is explicitly set for that command. Prefer creating the first production admin through a controlled one-time operational run and then removing the seed password from the environment.
