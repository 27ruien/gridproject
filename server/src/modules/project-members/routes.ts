import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { assertActiveUser, requireManagedProject } from "../shared.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { projectMemberDto } from "../../utils/dto.js";

const memberSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
}).strict();

export async function projectMemberRoutes(app: FastifyInstance) {
  app.get("/:projectId/members", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { projectId: string }).projectId);
    const members = await app.prisma.projectMember.findMany({
      where: { organizationId: context.organizationId, projectId: project.id },
      include: { user: true },
      orderBy: { updatedAt: "desc" },
    });
    return { requestId: request.id, rows: members.map(projectMemberDto) };
  });

  app.post("/:projectId/members", async (request, reply) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { projectId: string }).projectId);
    const parsed = memberSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("成员参数不正确。", parsed.error.flatten());
    await assertActiveUser(app, context.organizationId, parsed.data.userId);
    const existing = await app.prisma.projectMember.findFirst({
      where: { organizationId: context.organizationId, projectId: project.id, userId: parsed.data.userId },
    });
    if (existing?.status === "ACTIVE") throw conflict("该用户已是项目成员。");
    const member = await app.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.projectMember.update({ where: { id: existing.id }, data: { status: "ACTIVE" }, include: { user: true } })
        : await tx.projectMember.create({
          data: { organizationId: context.organizationId, projectId: project.id, userId: parsed.data.userId, status: parsed.data.status },
          include: { user: true },
        });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project_member.add",
          entityType: "ProjectMember",
          entityId: row.id,
          data: { projectId: project.id, userId: row.userId },
          requestId: request.id,
        },
      });
      return row;
    });
    reply.status(201);
    return { requestId: request.id, member: projectMemberDto(member) };
  });

  app.patch("/:projectId/members/:memberId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { projectId: string }).projectId);
    const { memberId } = request.params as { memberId: string };
    const parsed = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }).strict().safeParse(request.body);
    if (!parsed.success) throw badRequest("成员参数不正确。", parsed.error.flatten());
    const member = await app.prisma.projectMember.findFirst({ where: { id: memberId, organizationId: context.organizationId, projectId: project.id } });
    if (!member) throw notFound("成员不存在。");
    if (member.userId === project.ownerId && parsed.data.status !== "ACTIVE") throw badRequest("不能停用当前项目 Owner 的成员身份。");
    await guardMemberRemoval(app, context.organizationId, project.id, member.userId, parsed.data.status);
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectMember.update({ where: { id: memberId }, data: { status: parsed.data.status }, include: { user: true } });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project_member.update",
          entityType: "ProjectMember",
          entityId: memberId,
          data: parsed.data,
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, member: projectMemberDto(updated) };
  });

  app.delete("/:projectId/members/:memberId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { projectId: string }).projectId);
    const { memberId } = request.params as { memberId: string };
    const member = await app.prisma.projectMember.findFirst({ where: { id: memberId, organizationId: context.organizationId, projectId: project.id } });
    if (!member) throw notFound("成员不存在。");
    if (member.userId === project.ownerId) throw badRequest("不能移除当前项目 Owner。");
    await guardMemberRemoval(app, context.organizationId, project.id, member.userId, "INACTIVE");
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectMember.update({ where: { id: memberId }, data: { status: "INACTIVE" }, include: { user: true } });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project_member.delete",
          entityType: "ProjectMember",
          entityId: memberId,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, member: projectMemberDto(updated) };
  });
}

async function guardMemberRemoval(app: FastifyInstance, organizationId: string, projectId: string, userId: string, nextStatus: string) {
  if (nextStatus === "ACTIVE") return;
  const unfinishedIssueCount = await app.prisma.issue.count({
    where: {
      organizationId,
      projectId,
      ownerId: userId,
      deletedAt: null,
      status: { notIn: ["已完成", "已验收"] },
    },
  });
  if (unfinishedIssueCount) throw conflict("该成员仍有未完成事项，不能移除。", { unfinishedIssueCount });
}
