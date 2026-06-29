import { describe, expect, it } from "vitest";
import type { AuthContext, Issue, Project, ProjectMember, TimeEntry, User } from "@/types/domain";
import {
  buildAccessContext,
  canApproveTimeEntry,
  canCreateIssue,
  canCreateOwnTimeEntry,
  canDeleteIssue,
  canEditTimeEntry,
  canUpdateIssue,
  normalizeProjectMemberRole,
  permissionsForProject,
} from "./policies";

const organizationId = "org-policy";

const users = {
  admin: user("admin", "ADMIN"),
  owner: user("owner"),
  manager: user("manager"),
  member: user("member"),
  viewer: user("viewer"),
  legacy: user("legacy"),
  outsider: user("outsider"),
};

const project: Project = {
  id: "project-1",
  organizationId,
  name: "Policy Project",
  templateId: "agile",
  ownerId: users.owner.id,
  status: "进行中",
  executionTeams: [],
  milestones: [],
  deletedAt: null,
};

const members: ProjectMember[] = [
  member("pm-manager", users.manager.id, "MANAGER"),
  member("pm-member", users.member.id, "MEMBER"),
  member("pm-viewer", users.viewer.id, "VIEWER"),
  { id: "pm-legacy", organizationId, projectId: project.id, userId: users.legacy.id, status: "ACTIVE" },
];

const memberIssue: Issue = issue("issue-member", users.member.id, users.manager.id);
const assignedIssue: Issue = issue("issue-assigned", users.manager.id, users.member.id);
const managerIssue: Issue = issue("issue-manager", users.manager.id, users.manager.id);
const submittedOtherEntry: TimeEntry = timeEntry("time-other", users.manager.id, "SUBMITTED");

describe("project member role policies", () => {
  it("maps project permissions for each role", () => {
    const adminPermissions = permissionsForProject(context(users.admin), project, members);
    expect(adminPermissions.canUpdate).toBe(true);
    expect(adminPermissions.canDelete).toBe(true);
    expect(adminPermissions.canManageMemberRoles).toBe(true);
    expect(adminPermissions.canApproveTimeEntries).toBe(true);

    const ownerPermissions = permissionsForProject(context(users.owner), project, members);
    expect(ownerPermissions.canUpdate).toBe(true);
    expect(ownerPermissions.canDelete).toBe(true);
    expect(ownerPermissions.canManageMemberRoles).toBe(true);
    expect(ownerPermissions.canApproveTimeEntries).toBe(true);

    const managerPermissions = permissionsForProject(context(users.manager), project, members);
    expect(managerPermissions.canView).toBe(true);
    expect(managerPermissions.canCreateIssue).toBe(true);
    expect(managerPermissions.canManageSchedule).toBe(true);
    expect(managerPermissions.canApproveTimeEntries).toBe(true);
    expect(managerPermissions.canDelete).toBe(false);
    expect(managerPermissions.canManageMemberRoles).toBe(false);

    const memberPermissions = permissionsForProject(context(users.member), project, members);
    expect(memberPermissions.canView).toBe(true);
    expect(memberPermissions.canCreateIssue).toBe(true);
    expect(memberPermissions.canCreateTimeEntries).toBe(true);
    expect(memberPermissions.canApproveTimeEntries).toBe(false);
    expect(memberPermissions.canDelete).toBe(false);

    const viewerPermissions = permissionsForProject(context(users.viewer), project, members);
    expect(viewerPermissions.canView).toBe(true);
    expect(viewerPermissions.canCreateIssue).toBe(false);
    expect(viewerPermissions.canCreateTimeEntries).toBe(false);
    expect(viewerPermissions.canManageSchedule).toBe(false);
    expect(viewerPermissions.canApproveTimeEntries).toBe(false);

    expect(permissionsForProject(context(users.outsider), project, members).canView).toBe(false);
  });

  it("keeps owner authority independent from ProjectMember role rows", () => {
    const ownerWithoutMember = permissionsForProject(context(users.owner), project, members);
    expect(ownerWithoutMember.canManageMembers).toBe(true);
    expect(ownerWithoutMember.canChangeOwner).toBe(true);
  });

  it("applies issue and time-entry abilities by project role", () => {
    expect(canCreateIssue(context(users.manager), project, members)).toBe(true);
    expect(canDeleteIssue(context(users.manager), managerIssue, project, members)).toBe(true);
    expect(permissionsForProject(context(users.manager), project, members).canDelete).toBe(false);

    expect(canCreateIssue(context(users.member), project, members)).toBe(true);
    expect(canUpdateIssue(context(users.member), memberIssue, project, members)).toBe(true);
    expect(canUpdateIssue(context(users.member), assignedIssue, project, members)).toBe(true);
    expect(canUpdateIssue(context(users.member), managerIssue, project, members)).toBe(false);
    expect(canApproveTimeEntry(context(users.member), submittedOtherEntry, project, members)).toBe(false);
    expect(canEditTimeEntry(context(users.admin), submittedOtherEntry)).toBe(false);

    expect(canCreateIssue(context(users.viewer), project, members)).toBe(false);
    expect(canCreateOwnTimeEntry(context(users.viewer), project, members, users.viewer.id)).toBe(false);
  });

  it("defaults legacy project members without role to MEMBER", () => {
    expect(normalizeProjectMemberRole(undefined)).toBe("MEMBER");
    expect(permissionsForProject(context(users.legacy), project, members).canCreateIssue).toBe(true);
    expect(canCreateOwnTimeEntry(context(users.legacy), project, members, users.legacy.id)).toBe(true);
  });

  it("keeps localStorage permission output aligned with the API permission contract", () => {
    expect(pickProjectPermissions(permissionsForProject(context(users.admin), project, members))).toEqual(contract(true, true, true, true, true, true, true, true, true, true));
    expect(pickProjectPermissions(permissionsForProject(context(users.owner), project, members))).toEqual(contract(true, true, true, true, true, true, true, true, true, true));
    expect(pickProjectPermissions(permissionsForProject(context(users.manager), project, members))).toEqual(contract(true, false, false, false, false, false, true, true, true, true));
    expect(pickProjectPermissions(permissionsForProject(context(users.member), project, members))).toEqual(contract(true, false, false, false, false, false, true, false, true, false));
    expect(pickProjectPermissions(permissionsForProject(context(users.viewer), project, members))).toEqual(contract(true, false, false, false, false, false, false, false, false, false));
    expect(pickProjectPermissions(permissionsForProject(context(users.outsider), project, members))).toEqual(contract(false, false, false, false, false, false, false, false, false, false));
  });
});

function user(id: string, role: User["role"] = "MEMBER"): User {
  return {
    id,
    organizationId,
    name: id,
    email: `${id}@grid.test`,
    role,
    status: "ACTIVE",
  };
}

function context(currentUser: User): AuthContext {
  return buildAccessContext(currentUser, organizationId);
}

function member(id: string, userId: string, role: ProjectMember["role"]): ProjectMember {
  return { id, organizationId, projectId: project.id, userId, status: "ACTIVE", role };
}

function issue(id: string, creatorId: string, ownerId: string): Issue {
  return {
    id,
    code: id.toUpperCase(),
    projectId: project.id,
    type: "任务",
    title: id,
    status: "未开始",
    creatorId,
    ownerId,
    priority: "P2",
    deletedAt: null,
  };
}

function timeEntry(id: string, userId: string, status: TimeEntry["status"]): TimeEntry {
  return {
    id,
    organizationId,
    projectId: project.id,
    userId,
    workDate: "2026-06-29",
    hours: 1,
    status,
    deletedAt: null,
  };
}

function pickProjectPermissions(permissions: ReturnType<typeof permissionsForProject>) {
  return {
    canView: permissions.canView,
    canUpdate: permissions.canUpdate,
    canDelete: permissions.canDelete,
    canChangeOwner: permissions.canChangeOwner,
    canManageMembers: permissions.canManageMembers,
    canManageMemberRoles: permissions.canManageMemberRoles,
    canCreateIssue: permissions.canCreateIssue,
    canManageSchedule: permissions.canManageSchedule,
    canCreateTimeEntries: permissions.canCreateTimeEntries,
    canApproveTimeEntries: permissions.canApproveTimeEntries,
  };
}

function contract(
  canView: boolean,
  canUpdate: boolean,
  canDelete: boolean,
  canChangeOwner: boolean,
  canManageMembers: boolean,
  canManageMemberRoles: boolean,
  canCreateIssue: boolean,
  canManageSchedule: boolean,
  canCreateTimeEntries: boolean,
  canApproveTimeEntries: boolean,
) {
  return {
    canView,
    canUpdate,
    canDelete,
    canChangeOwner,
    canManageMembers,
    canManageMemberRoles,
    canCreateIssue,
    canManageSchedule,
    canCreateTimeEntries,
    canApproveTimeEntries,
  };
}
