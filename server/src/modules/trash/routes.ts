import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { canManageMilestones, canRestoreIssue, canViewCost } from "../../policies/access.js";
import { appendIssueActivity, assertIssueCodeAvailable, audit, canRestoreProjectScoped } from "../shared.js";
import { forbidden, notFound } from "../../utils/errors.js";
import { costRecordDto, issueDto, milestoneDto, projectDto, sanitizeUserDto, toIsoDateTime } from "../../utils/dto.js";

type TrashType = "project" | "issue" | "milestone" | "costRecord" | "user";

const TYPES = new Set<TrashType>(["project", "issue", "milestone", "costRecord", "user"]);

export async function trashRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const [projects, issues, milestones, costRecords, users] = await Promise.all([
      app.prisma.project.findMany({
        where: { organizationId: context.organizationId, deletedAt: { not: null }, ...(context.isAdmin ? {} : { ownerId: context.userId }) },
        include: { owner: true },
      }),
      app.prisma.issue.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: { not: null },
          ...(context.isAdmin ? {} : { project: { OR: [{ ownerId: context.userId }, { members: { some: { userId: context.userId, status: "ACTIVE", role: "MANAGER" } } }] } }),
        },
        include: { project: true },
      }),
      app.prisma.milestone.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: { not: null },
          ...(context.isAdmin ? {} : { project: { OR: [{ ownerId: context.userId }, { members: { some: { userId: context.userId, status: "ACTIVE", role: "MANAGER" } } }] } }),
        },
        include: { project: true },
      }),
      app.prisma.projectCostRecord.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: { not: null },
          ...(context.isAdmin ? {} : { project: { ownerId: context.userId } }),
        },
        include: { project: { include: { owner: true } } },
      }),
      context.isAdmin
        ? app.prisma.user.findMany({ where: { organizationId: context.organizationId, deletedAt: { not: null } } })
        : Promise.resolve([]),
    ]);

    const rows = [
      ...projects.map((project) => trashItem("project", projectDto(project), project.deletedAt)),
      ...issues.map((issue) => trashItem("issue", issueDto(issue), issue.deletedAt)),
      ...milestones.map((milestone) => trashItem("milestone", milestoneDto(milestone), milestone.deletedAt)),
      ...costRecords.map((record) => trashItem("costRecord", costRecordDto(record), record.deletedAt)),
      ...users.map((user) => trashItem("user", sanitizeUserDto(user), user.deletedAt)),
    ].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));

    return { requestId: request.id, rows };
  });

  app.post("/:type/:id/restore", async (request) => {
    const context = requireAuth(request);
    const { type, id } = request.params as { type: TrashType; id: string };
    if (!TYPES.has(type)) throw notFound("回收站项目不存在。");

    if (type === "project") {
      const project = await app.prisma.project.findFirst({
        where: { id, organizationId: context.organizationId, deletedAt: { not: null } },
        include: { owner: true },
      });
      if (!project) throw notFound("项目不存在。");
      if (!canRestoreProjectScoped(context, project)) throw forbidden("没有权限恢复该项目。");
      const row = await app.prisma.project.update({ where: { id }, data: { deletedAt: null, deletedById: null }, include: { owner: true } });
      await audit(app, context, "project.restore", "Project", id, {}, request.id);
      return { requestId: request.id, type, entity: projectDto(row) };
    }

    if (type === "issue") {
      const issue = await app.prisma.issue.findFirst({
        where: { id, organizationId: context.organizationId, deletedAt: { not: null } },
        include: { project: { include: { members: true } } },
      });
      if (!issue || issue.project.deletedAt) throw notFound("事项不存在。");
      if (!canRestoreIssue(context, issue, issue.project)) throw forbidden("没有权限恢复该事项。");
      await assertIssueCodeAvailable(app, issue.projectId, issue.code, issue.id);
      const row = await app.prisma.issue.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
      await appendIssueActivity(app, context, id, "restored", "恢复事项");
      await audit(app, context, "issue.restore", "Issue", id, {}, request.id);
      return { requestId: request.id, type, entity: issueDto(row) };
    }

    if (type === "milestone") {
      const milestone = await app.prisma.milestone.findFirst({
        where: { id, organizationId: context.organizationId, deletedAt: { not: null } },
        include: { project: { include: { members: true } } },
      });
      if (!milestone || milestone.project.deletedAt) throw notFound("相关方事项不存在。");
      if (!canManageMilestones(context, milestone.project, milestone.project.members || [])) throw forbidden("没有权限恢复该相关方事项。");
      const row = await app.prisma.milestone.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
      await audit(app, context, "milestone.restore", "Milestone", id, {}, request.id);
      return { requestId: request.id, type, entity: milestoneDto(row) };
    }

    if (type === "costRecord") {
      const record = await app.prisma.projectCostRecord.findFirst({
        where: { id, organizationId: context.organizationId, deletedAt: { not: null } },
        include: { project: { include: { owner: true } } },
      });
      if (!record) throw notFound("成本记录不存在。");
      if (!canViewCost(context, record.project)) throw forbidden("没有权限恢复该成本记录。");
      const row = await app.prisma.projectCostRecord.update({
        where: { id },
        data: { status: "ACTIVE", deletedAt: null, deletedById: null, updatedById: context.userId },
        include: { project: { include: { owner: true } } },
      });
      await audit(app, context, "cost_record.restore", "ProjectCostRecord", id, {}, request.id);
      return { requestId: request.id, type, entity: costRecordDto(row) };
    }

    const user = await app.prisma.user.findFirst({ where: { id, organizationId: context.organizationId, deletedAt: { not: null } } });
    if (!user) throw notFound("人员不存在。");
    if (!context.isAdmin) throw forbidden("没有权限恢复人员。");
    const row = await app.prisma.user.update({ where: { id }, data: { status: "ACTIVE", deletedAt: null, deletedById: null } });
    await audit(app, context, "user.restore", "User", id, {}, request.id);
    return { requestId: request.id, type, entity: sanitizeUserDto(row) };
  });
}

function trashItem(type: TrashType, entity: any, deletedAt: unknown) {
  return {
    id: `trash-${type}-${entity.id}`,
    type,
    entityId: entity.id,
    entity,
    deletedAt: toIsoDateTime(deletedAt),
  };
}
