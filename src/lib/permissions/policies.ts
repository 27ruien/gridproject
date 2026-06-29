import type { AuthContext, Issue, Project, ProjectMember, ProjectMemberRole, ProjectPermissions, TimeEntry, User } from "@/types/domain";

export const ORGANIZATION_ID = "org-default";
export const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ["MANAGER", "MEMBER", "VIEWER"];
export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  MANAGER: "项目经理",
  MEMBER: "项目成员",
  VIEWER: "只读成员",
};

export function buildAccessContext(user: User | null, organizationId = ORGANIZATION_ID): AuthContext {
  return {
    organizationId,
    user,
    userId: user?.id || "",
    isAdmin: user?.role === "ADMIN",
    isActiveUser: Boolean(user && user.status === "ACTIVE" && user.organizationId === organizationId && !user.deletedAt),
  };
}

export function normalizeProjectMemberRole(role: unknown): ProjectMemberRole {
  return PROJECT_MEMBER_ROLES.includes(role as ProjectMemberRole) ? role as ProjectMemberRole : "MEMBER";
}

export function projectMemberForUser(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  if (!context.isActiveUser || !project) return null;
  return members.find((member) => (
    member.organizationId === context.organizationId &&
    member.projectId === project.id &&
    member.userId === context.userId &&
    member.status === "ACTIVE"
  )) || null;
}

export function projectMemberRoleForUser(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  const member = projectMemberForUser(context, project, members);
  return member ? normalizeProjectMemberRole(member.role) : null;
}

export function isActiveProjectMember(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return Boolean(projectMemberForUser(context, project, members));
}

export function isProjectOwner(context: AuthContext, project: Project | null | undefined) {
  return Boolean(context.isActiveUser && project?.ownerId === context.userId);
}

export function isProjectManager(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return projectMemberRoleForUser(context, project, members) === "MANAGER";
}

export function isProjectWorkMember(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  const role = projectMemberRoleForUser(context, project, members);
  return role === "MANAGER" || role === "MEMBER";
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
    (context.isAdmin || isProjectOwner(context, project) || isActiveProjectMember(context, project, members)),
  );
}

export function canUpdateProject(context: AuthContext, project: Project | null | undefined) {
  return Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt && (context.isAdmin || isProjectOwner(context, project)));
}

export function canManageProjectMembers(context: AuthContext, project: Project | null | undefined) {
  return canUpdateProject(context, project);
}

export function canCreateIssue(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return Boolean(canViewProject(context, project, members) && (context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members)));
}

export function canUpdateIssue(context: AuthContext, issue: Issue | null | undefined, project: Project | null | undefined, members: ProjectMember[]) {
  if (!context.isActiveUser || !issue || issue.deletedAt || !canViewProject(context, project, members)) return false;
  if (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members)) return true;
  return isProjectWorkMember(context, project, members) && (issue.creatorId === context.userId || issue.ownerId === context.userId);
}

export function canDeleteIssue(context: AuthContext, issue: Issue | null | undefined, project: Project | null | undefined, members: ProjectMember[]) {
  if (!context.isActiveUser || !issue || issue.deletedAt || !canViewProject(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function canManageMilestones(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return Boolean(canViewProject(context, project, members) && (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members)));
}

export function canManageSchedule(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]) {
  return canManageMilestones(context, project, members);
}

export function canCommentOnIssue(context: AuthContext, issue: Issue | null | undefined, project: Project | null | undefined, members: ProjectMember[]) {
  if (!context.isActiveUser || !issue || issue.deletedAt || !canViewProject(context, project, members)) return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members);
}

export function permissionsForProject(context: AuthContext, project: Project | null | undefined, members: ProjectMember[]): ProjectPermissions {
  const canView = canViewProject(context, project, members);
  const canManageProject = canUpdateProject(context, project);
  const canManageWork = canManageMilestones(context, project, members);
  const canApprove = Boolean(canView && project && (context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members)));
  const canManageCost = Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt && (context.isAdmin || isProjectOwner(context, project)));
  return {
    canView,
    canViewBoard: canView,
    canUpdate: canManageProject,
    canDelete: canManageProject,
    canChangeOwner: canManageProject,
    canManageMembers: canManageProjectMembers(context, project),
    canManageMemberRoles: canManageProjectMembers(context, project),
    canCreateIssue: canCreateIssue(context, project, members),
    canManageMilestones: canManageWork,
    canManageSchedule: canManageWork,
    canCreateTimeEntries: canCreateOwnTimeEntry(context, project, members, context.userId),
    canViewProjectTimeEntries: canApprove,
    canApproveTimeEntries: canApprove,
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
    (context.isAdmin || isProjectOwner(context, project) || isProjectWorkMember(context, project, members)),
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
  if (context.isAdmin) return true;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(normalizeTimeEntryStatus(entry.status));
}

export function canDeleteTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined) {
  if (!context.isActiveUser || !entry || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (context.isAdmin) return true;
  return entry.userId === context.userId && normalizeTimeEntryStatus(entry.status) === "DRAFT";
}

export function canSubmitTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined) {
  if (!context.isActiveUser || !entry || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  return entry.userId === context.userId && ["DRAFT", "REJECTED"].includes(normalizeTimeEntryStatus(entry.status));
}

export function canApproveTimeEntry(context: AuthContext, entry: TimeEntry | null | undefined, project: Project | null | undefined, members: ProjectMember[] = []) {
  if (!context.isActiveUser || !entry || entry.organizationId !== context.organizationId || entry.deletedAt) return false;
  if (normalizeTimeEntryStatus(entry.status) !== "SUBMITTED") return false;
  return context.isAdmin || isProjectOwner(context, project) || isProjectManager(context, project, members);
}

export function visibleProjectsForUser(context: AuthContext, projects: Project[], members: ProjectMember[]) {
  return projects.filter((project) => canViewProject(context, project, members));
}

export function managedProjectsForUser(context: AuthContext, projects: Project[], members: ProjectMember[] = []) {
  if (context.isAdmin) return projects.filter((project) => !project.deletedAt && project.organizationId === context.organizationId);
  return projects.filter((project) => (
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    (project.ownerId === context.userId || isProjectManager(context, project, members))
  ));
}
