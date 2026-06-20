ALTER TABLE "organizations" ADD COLUMN "settings" JSONB;

ALTER TABLE "milestones" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "milestones" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "milestones" ADD COLUMN "window" TEXT;
ALTER TABLE "milestones" ADD COLUMN "focus" TEXT;
DROP INDEX IF EXISTS "milestones_organizationId_projectId_idx";
CREATE INDEX "milestones_organizationId_projectId_deletedAt_idx" ON "milestones"("organizationId", "projectId", "deletedAt");

ALTER TABLE "issues" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "issues" ADD COLUMN "next" TEXT;

CREATE TABLE "issue_comments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  "deletedById" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issue_activities" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "issue_comments_organizationId_issueId_deletedAt_idx" ON "issue_comments"("organizationId", "issueId", "deletedAt");
CREATE INDEX "issue_comments_authorId_createdAt_idx" ON "issue_comments"("authorId", "createdAt");
CREATE INDEX "issue_activities_organizationId_issueId_createdAt_idx" ON "issue_activities"("organizationId", "issueId", "createdAt");
CREATE INDEX "issue_activities_actorId_createdAt_idx" ON "issue_activities"("actorId", "createdAt");

ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
