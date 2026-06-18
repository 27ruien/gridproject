CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProjectMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "CostRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL,
  "health" INTEGER NOT NULL DEFAULT 90,
  "startDate" TIMESTAMPTZ,
  "dueDate" TIMESTAMPTZ,
  "testDate" TIMESTAMPTZ,
  "acceptanceDate" TIMESTAMPTZ,
  "releaseDate" TIMESTAMPTZ,
  "config" JSONB,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "deletedById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_members" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ProjectMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issues" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ownerId" TEXT,
  "creatorId" TEXT,
  "priority" TEXT,
  "startDate" TIMESTAMPTZ,
  "dueDate" TIMESTAMPTZ,
  "estimatedHours" NUMERIC(10,2),
  "actualHours" NUMERIC(10,2),
  "description" TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "time_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "issueId" TEXT,
  "userId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "workDate" TIMESTAMPTZ NOT NULL,
  "hours" NUMERIC(10,2) NOT NULL,
  "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "correctionReason" TEXT,
  "deletedAt" TIMESTAMPTZ,
  "deletedById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "time_entries_hours_positive" CHECK ("hours" > 0)
);

CREATE TABLE "project_cost_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "standardHoursPerDay" NUMERIC(5,2) NOT NULL DEFAULT 8,
  "status" "CostRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "deletedById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_cost_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_cost_records_standard_hours_positive" CHECK ("standardHoursPerDay" > 0)
);

CREATE TABLE "project_cost_rates" (
  "id" TEXT NOT NULL,
  "projectCostRecordId" TEXT NOT NULL,
  "amountPerPersonDay" NUMERIC(18,2) NOT NULL,
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo" TIMESTAMPTZ,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_cost_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_cost_rates_amount_non_negative" CHECK ("amountPerPersonDay" >= 0),
  CONSTRAINT "project_cost_rates_period_valid" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "data" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_organizationId_email_key" ON "users"("organizationId", "email");
CREATE INDEX "users_organizationId_status_idx" ON "users"("organizationId", "status");

CREATE UNIQUE INDEX "projects_organizationId_code_key" ON "projects"("organizationId", "code");
CREATE INDEX "projects_organizationId_deletedAt_idx" ON "projects"("organizationId", "deletedAt");
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
CREATE INDEX "project_members_organizationId_status_idx" ON "project_members"("organizationId", "status");

CREATE UNIQUE INDEX "issues_projectId_code_key" ON "issues"("projectId", "code");
CREATE INDEX "issues_organizationId_projectId_idx" ON "issues"("organizationId", "projectId");

CREATE INDEX "time_entries_projectId_workDate_status_idx" ON "time_entries"("projectId", "workDate", "status");
CREATE INDEX "time_entries_projectId_userId_workDate_idx" ON "time_entries"("projectId", "userId", "workDate");
CREATE INDEX "time_entries_organizationId_status_idx" ON "time_entries"("organizationId", "status");

CREATE UNIQUE INDEX "project_cost_records_projectId_key" ON "project_cost_records"("projectId");
CREATE INDEX "project_cost_records_organizationId_status_idx" ON "project_cost_records"("organizationId", "status");

CREATE INDEX "project_cost_rates_projectCostRecordId_effectiveFrom_idx" ON "project_cost_rates"("projectCostRecordId", "effectiveFrom");
ALTER TABLE "project_cost_rates"
  ADD CONSTRAINT "project_cost_rates_no_overlap"
  EXCLUDE USING gist (
    "projectCostRecordId" WITH =,
    tstzrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamptz), '[)') WITH &&
  );

CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issues" ADD CONSTRAINT "issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_cost_records" ADD CONSTRAINT "project_cost_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_cost_records" ADD CONSTRAINT "project_cost_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_cost_records" ADD CONSTRAINT "project_cost_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_cost_records" ADD CONSTRAINT "project_cost_records_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_cost_records" ADD CONSTRAINT "project_cost_records_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_cost_rates" ADD CONSTRAINT "project_cost_rates_projectCostRecordId_fkey" FOREIGN KEY ("projectCostRecordId") REFERENCES "project_cost_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_cost_rates" ADD CONSTRAINT "project_cost_rates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

