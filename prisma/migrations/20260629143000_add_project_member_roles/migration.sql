CREATE TYPE "ProjectMemberRole" AS ENUM ('MANAGER', 'MEMBER', 'VIEWER');

ALTER TABLE "project_members"
ADD COLUMN "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER';

CREATE INDEX "project_members_organizationId_role_idx" ON "project_members"("organizationId", "role");
