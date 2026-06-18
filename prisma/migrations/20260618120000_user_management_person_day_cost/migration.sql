ALTER TABLE "users"
  ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '$argon2id$v=19$m=1024,t=2,p=1$Z3JpZHByb2plY3QtZGV2$2g8lN7Wssmdevplaceholderhash',
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT;

CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

ALTER TABLE "users"
  ADD CONSTRAINT "users_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_organizationId_userId_revokedAt_idx" ON "sessions"("organizationId", "userId", "revokedAt");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE IF EXISTS "project_cost_rates";

ALTER TABLE "project_cost_records"
  ADD COLUMN "plannedPersonDays" NUMERIC(10,2) NOT NULL DEFAULT 1,
  DROP COLUMN IF EXISTS "currency";

ALTER TABLE "project_cost_records"
  ALTER COLUMN "plannedPersonDays" DROP DEFAULT;

ALTER TABLE "project_cost_records"
  ADD CONSTRAINT "project_cost_records_planned_person_days_positive" CHECK ("plannedPersonDays" > 0),
  ADD CONSTRAINT "project_cost_records_standard_hours_valid" CHECK ("standardHoursPerDay" > 0 AND "standardHoursPerDay" <= 24);
