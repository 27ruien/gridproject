import type { FastifyInstance } from "fastify";
import type { AuthContext } from "../types.js";
import { canManageProject, canViewProjectWorkspace, isProjectOwner } from "../policies/access.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";

export async function requireVisibleProject(app: FastifyInstance, context: AuthContext, id: string) {
  const project = await app.prisma.project.findFirst({
    where: { id, organizationId: context.organizationId, deletedAt: null },
    include: { owner: true, members: true },
  });
  if (!canViewProjectWorkspace(context, project, project?.members || [])) throw notFound("项目不存在。");
  return project!;
}

export async function requireManagedProject(app: FastifyInstance, context: AuthContext, id: string) {
  const project = await requireVisibleProject(app, context, id);
  if (!canManageProject(context, project)) throw forbidden("没有权限管理该项目。");
  return project;
}

export function canRestoreProjectScoped(context: AuthContext, project: { organizationId: string; ownerId?: string | null } | null | undefined) {
  return Boolean(context.isActiveUser && project && project.organizationId === context.organizationId && (context.isAdmin || isProjectOwner(context, project)));
}

export async function assertActiveUser(app: FastifyInstance, organizationId: string, userId: string) {
  const user = await app.prisma.user.findFirst({ where: { id: userId, organizationId, status: "ACTIVE", deletedAt: null } });
  if (!user) throw badRequest("目标用户必须是当前组织 ACTIVE 用户。");
  return user;
}

export async function assertActiveProjectMember(app: FastifyInstance, organizationId: string, projectId: string, userId: string) {
  await assertActiveUser(app, organizationId, userId);
  const member = await app.prisma.projectMember.findFirst({
    where: { organizationId, projectId, userId, status: "ACTIVE" },
  });
  if (!member) throw badRequest("负责人必须是当前项目 ACTIVE 成员。");
  if ((member as any).role === "VIEWER") throw badRequest("只读成员不能作为事项负责人。");
  return member;
}

export async function assertIssueCodeAvailable(app: FastifyInstance, projectId: string, code: string, exceptIssueId?: string) {
  const duplicate = await app.prisma.issue.findFirst({
    where: {
      projectId,
      code,
      ...(exceptIssueId ? { id: { not: exceptIssueId } } : {}),
    },
  });
  if (duplicate) throw conflict("同一项目下事项编号必须唯一。");
}

export async function appendIssueActivity(
  app: FastifyInstance,
  context: AuthContext,
  issueId: string,
  type: string,
  text: string,
  data?: unknown,
) {
  return app.prisma.issueActivity.create({
    data: {
      organizationId: context.organizationId,
      issueId,
      actorId: context.userId,
      type,
      text,
      data: data as any,
    },
  });
}

export async function audit(app: FastifyInstance, context: AuthContext, action: string, entityType: string, entityId: string, data: unknown, requestId: string) {
  await app.prisma.auditLog.create({
    data: {
      organizationId: context.organizationId,
      actorId: context.userId,
      action,
      entityType,
      entityId,
      data: data as any,
      requestId,
    },
  });
}
