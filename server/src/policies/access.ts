import type { AuthContext } from "../types.js";

export type ProjectMemberRole = "MANAGER" | "MEMBER" | "VIEWER";

export const PROJECT_MEMBER_ROLES = ["MANAGER", "MEMBER", "VIEWER"] as const;
export const DEFAULT_PROJECT_MEMBER_ROLE: ProjectMemberRole = "MEMBER";

type ProjectLike = {
  id?: string | null;
  organizationId: string;
  ownerId?: string | null;
  createdById?: string | null;
  deletedAt?: Date | string | null;
};

type MemberLike = {
  projectId?: string | null;
  userId?: string | null;
  status?: string | null;
  role?: string | null;
};

type IssueLike = {
  organizationId: string;
  projectId?: string | null;
  ownerId?: string | null;
  creatorId?: string | null;
  deletedAt?: Date | string | null;
  project?: ProjectLike & { members?: MemberLike[] };
};

type TimeEntryLike = {
  organizationId: string;
  userId: string;
  status: string;
  deletedAt?: Date | string | null;
};

export function requireAdmin(context: AuthContext) {
  return context.isActiveUser && context.isAdmin;
}

export function normalizeProjectMemberRole(role: unknown): ProjectMemberRole {
  return PROJECT_MEMBER_ROLES.includes(role as ProjectMemberRole) ? role as ProjectMemberRole : DEFAULT_PROJECT_MEMBER_ROLE;
}

export function canCreateProject(context: AuthContext) {
  return context.isActiveUser;
}

export function canViewProject(context: AuthContext, project: { organizationId: string; deletedAt?: Date | string | null } | null | undefined) {
  return Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt);
}

export function isProjectOwner(context: AuthContext, project: { ownerId?: string | null } | null | undefined) {
  return Boolean(context.isActiveUser && project?.ownerId && project.ownerId === context.userId);
}

export function projectMemberForUser(
  context: AuthContext,
  project: { id?: string | null } | null | undefined,
  members: MemberLike[] = [],
) {
  if (!context.isActiveUser || !project?.id) return null;
  return members.find((member) => (
    member.projectId === project.id &&
    member.userId === context.userId &&
    member.status === "ACTIVE"
  )) || null;
}

export function projectMemberRoleForUser(
  context: AuthContext,
  project: { id?: string | null } | null | undefined,
  members: MemberLike[] = [],
) {
  const member = projectMemberForUser(context, project, members);
  return member ? normalizeProjectMemberRole(member.role) : null;
}

export function isProjectMember(
  context: AuthContext,
  project: { id?: string | null } | null | undefined,
  members: MemberLike[] = [],
) {
  return Boolean(projectMemberForUser(context, project, members));
}

export function isProjectManager(
  context: AuthContext,
  project: { id?: string | null } | null | undefined,
  members: MemberLike[] = [],
) {
  return projectMemberRoleForUser(context, project, members) === "MANAGER";
}

export function isProjectWorkMember(
  context: AuthContext,
  project: { id?: string | null } | null | undefined,
  members: MemberLike[] = [],
) {
  const role = projectMemberRoleForUser(context, project, members);
  return role === "MANAGER" || role === "MEMBER";
}

export function canViewProjectWorkspace(
  context: AuthContext,
  project: ProjectLike | null | undefined,
  members: MemberLike[] = [],
) {
  if (!canViewProject(context, project)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectMember(context, project, members);
}

export function canManageProject(context: AuthContext, project: ProjectLike | null | undefined) {
  return canViewProject(context, project) && (context.isAdmin || isProjectOwner(context, project));
}

export function canDeleteProject(context: AuthContext, project: ProjectLike | null | undefined) {
  return canManageProject(context, project);
}

export function canChangeProjectOwner(context: AuthContext, project: ProjectLike | null | undefined) {
  return canManageProject(context, project);
}

export function canManageProjectMembers(context: AuthContext, project: ProjectLike | null | undefined) {
  return canManageProject(context, project);
}

export function canManageProjectMemberRoles(context: AuthContext, project: ProjectLike | null | undefined) {
  return canManageProjectMembers(context, project);
}

export function canCreateIssue(context: AuthContext, project: ProjectLike | null | undefined, members: MemberLike[] = []) {
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members);
}

export function canEditIssue(context: AuthContext, issue: IssueLike | null | undefined, project: (ProjectLike & { members?: MemberLike[] }) | null | undefined = issue?.project) {
  if (!context.isActiveUser || !issue || issue.organizationId !== context.organizationId || issue.deletedAt || !project) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  if (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members)) return true;
  return isProjectWorkMember(context, project, members) && (issue.creatorId === context.userId || issue.ownerId === context.userId);
}

export function canDeleteIssue(context: AuthContext, issue: IssueLike | null | undefined, project: (ProjectLike & { members?: MemberLike[] }) | null | undefined = issue?.project) {
  if (!context.isActiveUser || !issue || issue.organizationId !== context.organizationId || issue.deletedAt || !project) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function canRestoreIssue(context: AuthContext, issue: IssueLike | null | undefined, project: (ProjectLike & { members?: MemberLike[] }) | null | undefined = issue?.project) {
  if (!context.isActiveUser || !issue || issue.organizationId !== context.organizationId || !issue.deletedAt || !project || project.deletedAt) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function canManageMilestones(context: AuthContext, project: ProjectLike | null | undefined, members: MemberLike[] = []) {
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function canManageSchedule(context: AuthContext, project: ProjectLike | null | undefined, members: MemberLike[] = []) {
  return canManageMilestones(context, project, members);
}

export function canCreateIssueComment(context: AuthContext, issue: IssueLike | null | undefined, project: (ProjectLike & { members?: MemberLike[] }) | null | undefined = issue?.project) {
  if (!context.isActiveUser || !issue || issue.organizationId !== context.organizationId || issue.deletedAt || !project) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members);
}

export function canEditIssueComment(
  context: AuthContext,
  comment: { organizationId: string; authorId: string; deletedAt?: Date | string | null } | null | undefined,
  project: (ProjectLike & { members?: MemberLike[] }) | null | undefined,
) {
  if (!context.isActiveUser || !comment || comment.organizationId !== context.organizationId || comment.deletedAt || !project) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  if (context.isAdmin) return true;
  return comment.authorId === context.userId && (isProjectOwner(context, project) || isProjectWorkMember(context, project, members));
}

export function canDeleteIssueComment(
  context: AuthContext,
  comment: { organizationId: string; authorId: string; deletedAt?: Date | string | null } | null | undefined,
  project: (ProjectLike & { members?: MemberLike[] }) | null | undefined,
) {
  if (!context.isActiveUser || !comment || comment.organizationId !== context.organizationId || comment.deletedAt || !project) return false;
  const members = project.members || [];
  if (!canViewProjectWorkspace(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members) || (
    comment.authorId === context.userId && isProjectWorkMember(context, project, members)
  );
}

export function canViewCost(context: AuthContext, project: ProjectLike | null | undefined) {
  return canManageProject(context, project);
}

export function canViewTimeEntry(
  context: AuthContext,
  entry: { organizationId: string; userId: string; status?: string; deletedAt?: Date | string | null },
  project: (ProjectLike & { members?: MemberLike[] }) | null | undefined,
) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (context.isAdmin) return true;
  if (entry.status === "DRAFT") return entry.userId === context.userId;
  const members = project?.members || [];
  if (project && (isProjectOwner(context, project) || isProjectManager(context, project, members))) return true;
  return entry.userId === context.userId;
}

export function canCreateOwnTimeEntry(context: AuthContext, project: ProjectLike | null | undefined, members: MemberLike[] = [], inputUserId = context.userId) {
  if (!context.isActiveUser || inputUserId !== context.userId || !canViewProject(context, project)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members);
}

export function canEditTimeEntry(context: AuthContext, entry: TimeEntryLike, _project: ProjectLike | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (!["DRAFT", "REJECTED"].includes(entry.status)) return false;
  if (context.isAdmin) return true;
  return entry.userId === context.userId;
}

export function canDeleteTimeEntry(context: AuthContext, entry: TimeEntryLike, _project: ProjectLike | null | undefined) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (context.isAdmin) return true;
  return entry.userId === context.userId && entry.status === "DRAFT";
}

export function canSubmitTimeEntry(context: AuthContext, entry: TimeEntryLike) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(entry.status);
}

export function canApproveTimeEntry(
  context: AuthContext,
  entry: { organizationId: string; status: string; deletedAt?: Date | string | null },
  project: (ProjectLike & { members?: MemberLike[] }) | null | undefined,
) {
  if (!context.isActiveUser || entry.organizationId !== context.organizationId || entry.deletedAt || !project) return false;
  if (entry.status !== "SUBMITTED") return false;
  const members = project.members || [];
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function canRejectTimeEntry(
  context: AuthContext,
  entry: { organizationId: string; status: string; deletedAt?: Date | string | null },
  project: (ProjectLike & { members?: MemberLike[] }) | null | undefined,
) {
  return canApproveTimeEntry(context, entry, project);
}

export function permissionsForProject(context: AuthContext, project: ProjectLike | null | undefined, members: MemberLike[] = []) {
  const canView = canViewProjectWorkspace(context, project, members);
  const canManage = canManageProject(context, project);
  const canManageWork = canManageMilestones(context, project, members);
  const canApprove = Boolean(canView && project && (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members)));
  const canFillTime = canCreateOwnTimeEntry(context, project, members);
  const canManageCost = canViewCost(context, project);
  return {
    canView,
    canViewBoard: canView,
    canUpdate: canManage,
    canDelete: canDeleteProject(context, project),
    canChangeOwner: canChangeProjectOwner(context, project),
    canManageMembers: canManageProjectMembers(context, project),
    canManageMemberRoles: canManageProjectMemberRoles(context, project),
    canCreateIssue: canCreateIssue(context, project, members),
    canManageMilestones: canManageWork,
    canManageSchedule: canManageWork,
    canCreateTimeEntries: canFillTime,
    canViewProjectTimeEntries: canApprove,
    canApproveTimeEntries: canApprove,
    canViewCost: canManageCost,
    canManageCost,
    canExportCost: canManageCost,
  };
}
