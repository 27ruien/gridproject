import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { canViewProject, isProjectOwner } from "../../policies/access.js";
import { assertActiveProjectMember, assertIssueCodeAvailable, requireVisibleProject } from "../shared.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { issueDto, pageEnvelope, pagination, parseDateOnly, toJsonObject } from "../../utils/dto.js";

const scheduleFields = {
  scheduleKey: z.string().optional(),
  scheduleModel: z.string().optional(),
  scheduleOwners: z.array(z.string()).optional(),
  scheduleWorkdays: z.number().nonnegative().optional(),
  scheduleImportedAt: z.string().datetime().optional(),
  scheduleSource: z.literal("gridtimeline").optional(),
};

const issueCreateSchema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(1),
  type: z.string().default("任务"),
  status: z.string().default("未开始"),
  ownerId: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: z.number().optional().nullable(),
  actualHours: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  next: z.string().optional().nullable(),
  ...scheduleFields,
}).strict();

const issuePatchSchema = issueCreateSchema.partial();

export async function issueRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/issues", async (request) => {
    const context = requireAuth(request);
    const project = await requireVisibleProject(app, context, (request.params as { projectId: string }).projectId);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const where: any = {
      organizationId: context.organizationId,
      projectId: project.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    const [issues, totalCount] = await Promise.all([
      app.prisma.issue.findMany({ where, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], skip, take }),
      app.prisma.issue.count({ where }),
    ]);
    const enriched = await enrichIssues(app, context.organizationId, issues);
    return { requestId: request.id, ...pageEnvelope(enriched.map(issueDto), totalCount, page, pageSize) };
  });

  app.post("/projects/:projectId/issues", async (request, reply) => {
    const context = requireAuth(request);
    const project = await requireVisibleProject(app, context, (request.params as { projectId: string }).projectId);
    const parsed = issueCreateSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("事项参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const ownerId = input.ownerId || context.userId;
    await assertActiveProjectMember(app, context.organizationId, project.id, ownerId);
    const code = (input.code || `ISS-${Date.now().toString().slice(-5)}`).trim().toUpperCase();
    await assertIssueCodeAvailable(app, project.id, code);
    const issue = await app.prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({
        data: {
          organizationId: context.organizationId,
          projectId: project.id,
          code,
          title: input.title.trim(),
          type: input.type,
          status: input.status,
          ownerId,
          creatorId: context.userId,
          priority: input.priority || null,
          startDate: parseDateOnly(input.startDate),
          dueDate: parseDateOnly(input.dueDate),
          estimatedHours: input.estimatedHours ?? null,
          actualHours: input.actualHours ?? null,
          next: input.next || "",
          description: input.description || "",
          scheduleData: scheduleDataForInput(input),
        },
      });
      await tx.issueActivity.create({
        data: { organizationId: context.organizationId, issueId: created.id, actorId: context.userId, type: "created", text: "创建事项" },
      });
      await tx.auditLog.create({
        data: { organizationId: context.organizationId, actorId: context.userId, action: "issue.create", entityType: "Issue", entityId: created.id, data: { projectId: project.id }, requestId: request.id },
      });
      return created;
    });
    reply.status(201);
    return { requestId: request.id, issue: issueDto(await loadIssueDetail(app, context.organizationId, issue.id)) };
  });

  app.get("/issues/:issueId", async (request) => {
    const context = requireAuth(request);
    const issue = await loadIssueDetail(app, context.organizationId, (request.params as { issueId: string }).issueId);
    if (!issue || issue.deletedAt || !canViewProject(context, issue.project)) throw notFound("事项不存在。");
    return { requestId: request.id, issue: issueDto(issue) };
  });

  app.patch("/issues/:issueId", async (request) => {
    const context = requireAuth(request);
    const issue = await loadIssueDetail(app, context.organizationId, (request.params as { issueId: string }).issueId);
    if (!issue || issue.deletedAt || !canViewProject(context, issue.project)) throw notFound("事项不存在。");
    const parsed = issuePatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("事项参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const currentScheduleData = toJsonObject(issue.scheduleData);
    if (input.ownerId) await assertActiveProjectMember(app, context.organizationId, issue.projectId, input.ownerId);
    const nextCode = input.code?.trim().toUpperCase();
    if (nextCode && nextCode !== issue.code) await assertIssueCodeAvailable(app, issue.projectId, nextCode, issue.id);
    const activities = issueActivitiesForPatch(issue, input);
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.issue.update({
        where: { id: issue.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
          ...(input.priority !== undefined ? { priority: input.priority || null } : {}),
          ...(input.startDate !== undefined ? { startDate: parseDateOnly(input.startDate) ?? null } : {}),
          ...(input.dueDate !== undefined ? { dueDate: parseDateOnly(input.dueDate) ?? null } : {}),
          ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
          ...(input.actualHours !== undefined ? { actualHours: input.actualHours } : {}),
          ...(input.next !== undefined ? { next: input.next || "" } : {}),
          ...(input.description !== undefined ? { description: input.description || "" } : {}),
          ...(hasSchedulePatch(input) ? { scheduleData: { ...currentScheduleData, ...scheduleDataForInput(input) } } : {}),
        },
      });
      for (const activity of activities) {
        await tx.issueActivity.create({ data: { organizationId: context.organizationId, issueId: issue.id, actorId: context.userId, ...activity } });
      }
      await tx.auditLog.create({
        data: { organizationId: context.organizationId, actorId: context.userId, action: "issue.update", entityType: "Issue", entityId: issue.id, data: input as any, requestId: request.id },
      });
      return row;
    });
    return { requestId: request.id, issue: issueDto(await loadIssueDetail(app, context.organizationId, updated.id)) };
  });

  app.delete("/issues/:issueId", async (request) => {
    const context = requireAuth(request);
    const issue = await loadIssueDetail(app, context.organizationId, (request.params as { issueId: string }).issueId);
    if (!issue || issue.deletedAt || !canViewProject(context, issue.project)) throw notFound("事项不存在。");
    if (!canDeleteIssue(context, issue)) throw forbidden("没有权限删除该事项。");
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.issue.update({
        where: { id: issue.id },
        data: { deletedAt: new Date(), deletedById: context.userId },
      });
      await tx.issueActivity.create({
        data: { organizationId: context.organizationId, issueId: issue.id, actorId: context.userId, type: "deleted", text: "删除事项" },
      });
      await tx.auditLog.create({
        data: { organizationId: context.organizationId, actorId: context.userId, action: "issue.delete", entityType: "Issue", entityId: issue.id, data: {}, requestId: request.id },
      });
      return row;
    });
    return { requestId: request.id, issue: issueDto(await enrichIssue(app, context.organizationId, updated)) };
  });

  app.post("/issues/:issueId/restore", async (request) => {
    const context = requireAuth(request);
    const issue = await loadIssueDetail(app, context.organizationId, (request.params as { issueId: string }).issueId, true);
    if (!issue || !issue.deletedAt || issue.project.deletedAt || !canDeleteIssue(context, issue)) throw notFound("事项不存在。");
    await assertIssueCodeAvailable(app, issue.projectId, issue.code, issue.id);
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.issue.update({ where: { id: issue.id }, data: { deletedAt: null, deletedById: null } });
      await tx.issueActivity.create({
        data: { organizationId: context.organizationId, issueId: issue.id, actorId: context.userId, type: "restored", text: "恢复事项" },
      });
      await tx.auditLog.create({
        data: { organizationId: context.organizationId, actorId: context.userId, action: "issue.restore", entityType: "Issue", entityId: issue.id, data: {}, requestId: request.id },
      });
      return row;
    });
    return { requestId: request.id, issue: issueDto(await loadIssueDetail(app, context.organizationId, updated.id)) };
  });
}

async function loadIssueDetail(app: FastifyInstance, organizationId: string, issueId: string, includeDeleted = false) {
  const issue = await app.prisma.issue.findFirst({
    where: { id: issueId, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: {
      project: true,
      comments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  return issue ? enrichIssue(app, organizationId, issue) : null;
}

async function enrichIssues(app: FastifyInstance, organizationId: string, issues: any[]) {
  const userIds = [...new Set(issues.flatMap((issue) => [issue.ownerId, issue.creatorId]).filter(Boolean))];
  const users = await app.prisma.user.findMany({ where: { organizationId, id: { in: userIds } } });
  const byId = new Map(users.map((user) => [user.id, user]));
  return issues.map((issue) => ({
    ...issue,
    owner: byId.get(issue.ownerId)?.name || "",
    creator: byId.get(issue.creatorId)?.name || "",
  }));
}

async function enrichIssue(app: FastifyInstance, organizationId: string, issue: any) {
  const comments = issue.comments || [];
  const activities = issue.activities || [];
  const userIds = [...new Set([
    issue.ownerId,
    issue.creatorId,
    ...comments.map((comment: any) => comment.authorId),
    ...activities.map((activity: any) => activity.actorId),
  ].filter(Boolean))];
  const users = await app.prisma.user.findMany({ where: { organizationId, id: { in: userIds } } });
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    ...issue,
    owner: byId.get(issue.ownerId)?.name || "",
    creator: byId.get(issue.creatorId)?.name || "",
    comments: comments.map((comment: any) => ({ ...comment, authorName: byId.get(comment.authorId)?.name || "" })),
    activities: activities.map((activity: any) => ({ ...activity, actorName: activity.actorId ? byId.get(activity.actorId)?.name || "" : "" })),
  };
}

function canDeleteIssue(context: any, issue: any) {
  return context.isAdmin || isProjectOwner(context, issue.project) || issue.creatorId === context.userId;
}

function issueActivitiesForPatch(issue: any, input: any) {
  const activities = [];
  if (input.status !== undefined && input.status !== issue.status) activities.push({ type: "status", text: `状态从 ${issue.status} 更新为 ${input.status}`, data: { before: issue.status, after: input.status } as any });
  if (input.ownerId !== undefined && input.ownerId !== issue.ownerId) activities.push({ type: "owner", text: "更新负责人", data: { before: issue.ownerId, after: input.ownerId } as any });
  if (input.startDate !== undefined || input.dueDate !== undefined) activities.push({ type: "schedule", text: "更新事项日期", data: { startDate: input.startDate, dueDate: input.dueDate } as any });
  if (!activities.length) activities.push({ type: "updated", text: "更新事项信息", data: input as any });
  return activities;
}

function hasSchedulePatch(input: any) {
  return Object.keys(scheduleFields).some((key) => input[key] !== undefined);
}

function scheduleDataForInput(input: any) {
  return {
    ...(input.scheduleKey !== undefined ? { scheduleKey: input.scheduleKey } : {}),
    ...(input.scheduleModel !== undefined ? { scheduleModel: input.scheduleModel } : {}),
    ...(input.scheduleOwners !== undefined ? { scheduleOwners: input.scheduleOwners } : {}),
    ...(input.scheduleWorkdays !== undefined ? { scheduleWorkdays: input.scheduleWorkdays } : {}),
    ...(input.scheduleImportedAt !== undefined ? { scheduleImportedAt: input.scheduleImportedAt } : {}),
    ...(input.scheduleSource !== undefined ? { scheduleSource: input.scheduleSource } : {}),
  };
}
