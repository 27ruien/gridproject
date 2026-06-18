import { ProjectAccessPolicy } from "../policies/projectAccessPolicy.js";
import { PROJECT_MEMBER_STATUS } from "../../domain/access.js";

export function createProjectCommand({ context, input, users, now = new Date().toISOString() }) {
  if (!ProjectAccessPolicy.canCreateProject(context)) {
    return { ok: false, status: 403, message: "没有权限创建项目。" };
  }

  const ownerId = input.ownerId || context.userId;
  const owner = users.find((user) => (
    user.id === ownerId &&
    user.organizationId === context.organizationId &&
    user.status === "ACTIVE"
  ));
  if (!owner) return { ok: false, status: 400, message: "项目 Owner 必须是当前组织 ACTIVE 用户。" };

  const project = {
    id: input.id || `project-${Date.now()}`,
    organizationId: context.organizationId,
    name: input.name,
    code: input.code || input.id || `P${Date.now()}`,
    description: input.description || "",
    status: input.status || "规划中",
    health: input.health ?? 90,
    ownerId,
    createdById: context.userId,
    deletedAt: null,
    deletedById: null,
    createdAt: now,
    updatedAt: now,
  };
  const projectMember = {
    id: `pm-${project.id}-${ownerId}`,
    organizationId: context.organizationId,
    projectId: project.id,
    userId: ownerId,
    status: PROJECT_MEMBER_STATUS.ACTIVE,
    createdAt: now,
  };
  const auditLog = createProjectAuditLog(context, "project.create", project.id, { ownerId });

  return { ok: true, project, projectMember, auditLog };
}

export function changeProjectOwnerCommand({ context, project, newOwnerId, users, projectMembers, now = new Date().toISOString() }) {
  if (!ProjectAccessPolicy.canManageProjectMembers(context, project)) {
    return { ok: false, status: 403, message: "没有权限变更项目 Owner。" };
  }

  const owner = users.find((user) => (
    user.id === newOwnerId &&
    user.organizationId === context.organizationId &&
    user.status === "ACTIVE"
  ));
  if (!owner) return { ok: false, status: 400, message: "新 Owner 必须是当前组织 ACTIVE 用户。" };

  const updatedProject = {
    ...project,
    ownerId: newOwnerId,
    updatedAt: now,
  };
  const activeMember = projectMembers.find((member) => (
    member.projectId === project.id &&
    member.userId === newOwnerId &&
    member.status === PROJECT_MEMBER_STATUS.ACTIVE
  ));
  const projectMember = activeMember || {
    id: `pm-${project.id}-${newOwnerId}`,
    organizationId: context.organizationId,
    projectId: project.id,
    userId: newOwnerId,
    status: PROJECT_MEMBER_STATUS.ACTIVE,
    createdAt: now,
  };

  return {
    ok: true,
    project: updatedProject,
    projectMember,
    auditLog: createProjectAuditLog(context, "project.owner.change", project.id, { before: project.ownerId, after: newOwnerId }),
  };
}

function createProjectAuditLog(context, action, projectId, data) {
  return {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: context.organizationId,
    actorId: context.userId,
    action,
    entityType: "Project",
    entityId: projectId,
    data,
    createdAt: new Date().toISOString(),
  };
}

