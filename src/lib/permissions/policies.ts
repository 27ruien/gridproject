import type { AuthContext, Project, ProjectMember, ProjectPermissions, TimeEntry, User } from "@/types/domain";

export const ORGANIZATION_ID = "org-default";

export function buildAccessContext(user: User | null, organizationId = ORGANIZATION_ID): AuthContext {
  return {
    organizationId,
    user,
    userId: user?.id || "",
    isAdmin: user?.role === "ADMIN",
    isActiveUser: Boolean(user && user.status === "ACTIVE" && user.organizationId === organizationId && !user.deletedAt),
  };
}

export function isActiveProjectMember(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  if (!context.isActiveUser || !project) return false;
  return members.some((member) => (
    member.organizationId === context.organizationId &&
    member.projectId === project.id &&
    member.userId === context.userId &&
    member.status === "ACTIVE"
  ));
}

export function isProjectOwner(context: AuthContext, project: Project | null | undefined) {
  return Boolean(context.isActiveUser && project?.ownerId === context.userId);
}

export function isProjectCreator(context: AuthContext, project: Project | null | undefined) {
  return Boolean(context.isActiveUser && project?.createdById === context.userId);
}

export function canCreateProject(context: AuthContext) {
  return context.isActiveUser;
}

export function canViewProject(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return Boolean(
    context.isActiveUser &&
    project &&
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    (context.isAdmin || isProjectOwner(context, project) || isProjectCreator(context, project) || isActiveProjectMember(context, project, members)),
  );
}

export function canUpdateProject(context: AuthContext, project: Project | null | undefined) {
  return Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt && (context.isAdmin || isProjectOwner(context, project)));
}

export function permissionsForProject(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]): ProjectPermissions {
  const canManageCost = Boolean(
    context.isActiveUser &&
    project &&
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    (context.isAdmin || isProjectOwner(context, project) || isProjectCreator(context, project)),
  );
  const canViewProjectTimeEntries = context.isAdmin || isProjectOwner(context, project) || isProjectCreator(context, project);
  return {
    canView: canViewProject(context, project, members),
    canViewBoard: canViewProject(context, project, members),
    canUpdate: canUpdateProject(context, project),
    canDelete: canUpdateProject(context, project),
    canManageMembers: canUpdateProject(context, project),
    canViewProjectTimeEntries,
    canApproveTimeEntries: context.isAdmin || isProjectOwner(context, project),
    canViewCost: canManageCost,
    canManageCost,
    canExportCost: canManageCost,
  };
}

export function canAccessAdminPage(context: AuthContext) {
  return context.isActiveUser && context.isAdmin;
}

export function canCreateOwnTimeEntry(context: AuthContext, project: Project | null | undefined, members: ProjectMember[], inputUserId: string) {
  return Boolean(
    context.isActiveUser &&
    inputUserId === context.userId &&
    project &&
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    isActiveProjectMember(context, project, members),
  );
}

export function normalizeTimeEntryStatus(status: TimeEntry["status"]): "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" {
  const legacy: Record<string, "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"> = {
    草稿: "DRAFT",
    已提交: "SUBMITTED",
    已审批: "APPROVED",
    已驳回: "REJECTED",
  };
  return legacy[String(status)] || (status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED") || "SUBMITTED";
}

export function canEditTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined) {
  if (!context.isActiveUser || !entry || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && normalizeTimeEntryStatus(entry.status) === "DRAFT";
}

export function canSubmitTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined) {
  return canEditTimeEntry(context, entry);
}

export function canApproveTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined, project: Project | null | undefined) {
  if (!context.isActiveUser || !entry || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (normalizeTimeEntryStatus(entry.status) !== "SUBMITTED") return false;
  return context.isAdmin || isProjectOwner(context, project);
}

export function visibleProjectsForUser(context: AuthContext, projects: Project[], members: ProjectMember[]) {
  return projects.filter((project) => canViewProject(context, project, members));
}

export function managedProjectsForUser(context: AuthContext, projects: Project[]) {
  if (context.isAdmin) return projects.filter((project) => !project.deletedAt && project.organizationId === context.organizationId);
  return projects.filter((project) => (
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    (project.ownerId === context.userId || project.createdById === context.userId)
  ));
}
