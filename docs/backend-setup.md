# Backend Setup

## Database Safety

- Development DB: `127.0.0.1:5432/gridproject_dev`.
- Production DB: `127.0.0.1:5433/gridproject_prod`.
- Development and test servers refuse production-looking URLs.
- Production servers refuse development-looking URLs.
- Do not run `prisma db push`.
- Do not run `prisma migrate dev` for Dev deployment.
- Do not run `prisma migrate reset`.
- Do not ask for or commit database passwords, root passwords, session secrets, or GitHub tokens.

The backend reads database configuration only from `process.env.DATABASE_URL`.

## Install

```bash
npm install
corepack enable
corepack prepare pnpm@11.0.7 --activate
npm run server:install
```

## Configure

```bash
cp server/.env.example server/.env
```

Set these values in `server/.env`:

```bash
DATABASE_URL="postgresql://gridproject_app:REPLACE_ME@127.0.0.1:5432/gridproject_dev?schema=public"
SESSION_SECRET="REPLACE_WITH_A_LONG_RANDOM_STRING"
FRONTEND_ORIGIN="http://127.0.0.1:5173"
ADMIN_EMAIL="admin@example.test"
ADMIN_PASSWORD="REPLACE_WITH_A_STRONG_INITIAL_PASSWORD"
ADMIN_DISPLAY_NAME="管理员"
INITIAL_ORGANIZATION_NAME="GridProject Dev Organization"
```

`ADMIN_PASSWORD` is used by seed to generate an Argon2id hash. The plaintext password is never written to code or migrations.

## Migrate And Seed

```bash
npm run server:prisma:generate
npm run db:migrate:deploy:dev
npm run server:prisma:seed
```

The seed is idempotent for the configured organization/admin email. It creates or updates the admin with a freshly generated Argon2id hash and never uses a fixed default hash.

## Run

```bash
npm run server:dev
```

API base: `http://127.0.0.1:3000/api`.

Health check:

```bash
curl http://127.0.0.1:3000/api/health
```

## API Mode Frontend

Run Vite with:

```bash
VITE_DATA_SOURCE=api VITE_API_BASE_URL=/api npm run dev
```

In API mode the frontend hydrates state from `/api/bootstrap`. Default mode remains localStorage for offline demo/testing.
