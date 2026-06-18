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

export function canManageProject(context: AuthContext, project: { organizationId: string; ownerId?: string | null; deletedAt?: Date | string | null } | null | undefined) {
  return canViewProject(context, project) && (context.isAdmin || isProjectOwner(context, project));
}

export function canViewCost(context: AuthContext, project: { organizationId: string; ownerId?: string | null; deletedAt?: Date | string | null } | null | undefined) {
  return canManageProject(context, project);
}

export function canManageTimeEntry(context: AuthContext, entry: { organizationId: string; userId: string; status: string; deletedAt?: Date | string | null }, project: { ownerId?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (context.isAdmin || isProjectOwner(context, project)) return true;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(entry.status);
}

export function canApproveTimeEntry(context: AuthContext, entry: { organizationId: string; status: string; deletedAt?: Date | string | null }, project: { ownerId?: string | null } | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.status === "SUBMITTED" && (context.isAdmin || isProjectOwner(context, project));
}
