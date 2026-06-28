import type { AuthContext } from "../types.js";

export function requireAdmin(context: AuthContext) {
  return context.isActiveUser && context.isAdmin;
}

export function canCreateProject(context: AuthContext) {
  return context.isActiveUser;
}

export function canViewProject(context: AuthContext, project: { organizationId: string; deletedAt?: Date | string | null } | null | undefined) {
  return Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt);
}

export function isProjectOwner(context: AuthContext, project: { ownerId?: string | null } | null | undefined) {
  return Boolean(project?.ownerId && project.ownerId === context.userId);
}

export function isProjectManager(context: AuthContext, project: { ownerId?: string | null; createdById?: string | null } | null | undefined) {
  return Boolean(project && projectManagerId(project) === context.userId);
}

export function isProjectMember(context: AuthContext, project: { id?: string | null } | null | undefined, members: Array<{ projectId?: string | null; userId?: string | null; status?: string | null }> = []) {
  return Boolean(project?.id && members.some((member) => (
    member.projectId === project.id &&
    member.userId === context.userId &&
    member.status === "ACTIVE"
  )));
}

export function canViewProjectWorkspace(
  context: AuthContext,
  project: { id?: string | null; organizationId: string; ownerId?: string | null; deletedAt?: Date | string | null } | null | undefined,
  members: Array<{ projectId?: string | null; userId?: string | null; status?: string | null }> = [],
) {
  if (!canViewProject(context, project)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectMember(context, project, members);
}

export function canManageProject(context: AuthContext, project: { organizationId: string; ownerId?: string | null; deletedAt?: Date | string | null } | null | undefined) {
  return canViewProject(context, project) && (context.isAdmin || isProjectOwner(context, project));
}

export function canViewCost(context: AuthContext, project: { organizationId: string; ownerId?: string | null; deletedAt?: Date | string | null } | null | undefined) {
  return canManageProject(context, project) || Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt && (project as any).createdById === context.userId);
}

export function canViewTimeEntry(context: AuthContext, entry: { organizationId: string; userId: string; deletedAt?: Date | string | null }, project: { ownerId?: string | null; createdById?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if ((entry as any).status === "DRAFT") return entry.userId === context.userId;
  if (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project) || (project as any)?.createdById === context.userId || isProjectMember(context, project as any, (project as any)?.members || [])) return true;
  return entry.userId === context.userId;
}

export function canEditTimeEntry(context: AuthContext, entry: { organizationId: string; userId: string; status: string; deletedAt?: Date | string | null }, _project: { ownerId?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(entry.status);
}

export function canDeleteTimeEntry(context: AuthContext, entry: { organizationId: string; userId: string; status: string; deletedAt?: Date | string | null }, _project: { ownerId?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && entry.status === "DRAFT";
}

export function canSubmitTimeEntry(context: AuthContext, entry: { organizationId: string; userId: string; status: string; deletedAt?: Date | string | null }) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(entry.status);
}

export function canApproveTimeEntry(context: AuthContext, entry: { organizationId: string; status: string; deletedAt?: Date | string | null }, project: { ownerId?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.status === "SUBMITTED" && (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project as any));
}

export function canRejectTimeEntry(context: AuthContext, entry: { organizationId: string; status: string; deletedAt?: Date | string | null }, project: { ownerId?: string | null } | null | undefined) {
  return canApproveTimeEntry(context, entry, project);
}

function projectManagerId(project: any) {
  const config = project?.config && typeof project.config === "object" && !Array.isArray(project.config) ? project.config : {};
  return String(config.projectManagerId || project?.projectManagerId || "");
}
