import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TimeEntryRepository } from "../../repositories/timeEntries.js";
import { requireAuth } from "../../middleware/auth.js";
import { canApproveTimeEntry, canManageTimeEntry, canViewProject } from "../../policies/access.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { pageEnvelope, pagination, parseDateOnly, timeEntryDto } from "../../utils/dto.js";

const timeEntrySchema = z.object({
  projectId: z.string().min(1),
  issueId: z.string().optional().nullable(),
  userId: z.string().optional(),
  workDate: z.string().min(1),
  hours: z.number().positive(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).default("DRAFT"),
  description: z.string().optional().nullable(),
});

const timeEntryPatchSchema = timeEntrySchema.partial().extend({
  correctionReason: z.string().optional().nullable(),
});

export async function timeEntryRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const where: any = {
      organizationId: context.organizationId,
      deletedAt: null,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo ? {
        workDate: {
          ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
        },
      } : {}),
    };

    if (!context.isAdmin) {
      const repository = new TimeEntryRepository(app.prisma);
      const projectIds = await repository.visibleProjectIds(context.organizationId, context.userId);
      where.OR = [
        { userId: context.userId },
        { projectId: { in: projectIds } },
      ];
    }

    const [entries, totalCount] = await Promise.all([
      app.prisma.timeEntry.findMany({
        where,
        include: { user: true, project: true, issue: true },
        orderBy: [{ workDate: "desc" }, { updatedAt: "desc" }],
        skip,
        take,
      }),
      app.prisma.timeEntry.count({ where }),
    ]);
    return { requestId: request.id, ...pageEnvelope(entries.map(timeEntryDto), totalCount, page, pageSize) };
  });

  app.post("/", async (request, reply) => {
    const context = requireAuth(request);
    const parsed = timeEntrySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("工时参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const userId = context.isAdmin && input.userId ? input.userId : context.userId;
    const project = await app.prisma.project.findFirst({ where: { id: input.projectId, organizationId: context.organizationId, deletedAt: null } });
    if (!canViewProject(context, project)) throw notFound("项目不存在。");
    if (!context.isAdmin && !(await isActiveProjectMember(app, context.organizationId, project!.id, userId))) {
      throw forbidden("只有项目成员可以填报该项目工时。");
    }
    if (input.issueId) await assertIssueBelongsToProject(app, context.organizationId, project!.id, input.issueId);

    const entry = await app.prisma.timeEntry.create({
      data: {
        organizationId: context.organizationId,
        projectId: project!.id,
        issueId: input.issueId || null,
        userId,
        reporterId: context.userId,
        workDate: parseDateOnly(input.workDate) || new Date(),
        hours: input.hours,
        status: input.status,
        description: input.description || "",
        approvedAt: input.status === "APPROVED" ? new Date() : null,
        approvedById: input.status === "APPROVED" ? context.userId : null,
      },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.create", "TimeEntry", entry.id, { projectId: entry.projectId }, request.id);
    reply.status(201);
    return { requestId: request.id, entry: timeEntryDto(entry) };
  });

  app.patch("/:id", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canManageTimeEntry(context, entry, entry.project)) throw forbidden("没有权限编辑该工时。");
    const parsed = timeEntryPatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("工时参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const projectId = input.projectId || entry.projectId;
    if (projectId !== entry.projectId) {
      const project = await app.prisma.project.findFirst({ where: { id: projectId, organizationId: context.organizationId, deletedAt: null } });
      if (!canViewProject(context, project)) throw notFound("项目不存在。");
    }
    if (input.issueId) await assertIssueBelongsToProject(app, context.organizationId, projectId, input.issueId);

    const updated = await app.prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.issueId !== undefined ? { issueId: input.issueId || null } : {}),
        ...(input.userId !== undefined && context.isAdmin ? { userId: input.userId } : {}),
        ...(input.workDate !== undefined ? { workDate: parseDateOnly(input.workDate) || entry.workDate } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined ? { description: input.description || "" } : {}),
        ...(input.correctionReason !== undefined ? { correctionReason: input.correctionReason || "" } : {}),
      },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.update", "TimeEntry", entry.id, input, request.id);
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.delete("/:id", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canManageTimeEntry(context, entry, entry.project)) throw forbidden("没有权限删除该工时。");
    const updated = await app.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date(), deletedById: context.userId },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.delete", "TimeEntry", entry.id, {}, request.id);
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/submit", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (entry.userId !== context.userId && !context.isAdmin) throw forbidden("只能提交自己的工时。");
    if (!["DRAFT", "REJECTED"].includes(entry.status)) throw badRequest("只有草稿或驳回状态可以提交。");
    const updated = await app.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { status: "SUBMITTED" },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.submit", "TimeEntry", entry.id, {}, request.id);
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/approve", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canApproveTimeEntry(context, entry, entry.project)) throw forbidden("没有权限审批该工时。");
    const updated = await app.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { status: "APPROVED", approvedAt: new Date(), approvedById: context.userId },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.approve", "TimeEntry", entry.id, {}, request.id);
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/reject", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canApproveTimeEntry(context, entry, entry.project)) throw forbidden("没有权限驳回该工时。");
    const reason = (request.body as any)?.correctionReason || "";
    const updated = await app.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { status: "REJECTED", correctionReason: reason, approvedAt: null, approvedById: null },
      include: { user: true, project: true, issue: true },
    });
    await audit(app, context, "time_entry.reject", "TimeEntry", entry.id, { reason }, request.id);
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });
}

async function getEntry(app: FastifyInstance, context: any, id: string) {
  const entry = await app.prisma.timeEntry.findFirst({
    where: { id, organizationId: context.organizationId, deletedAt: null },
    include: { project: true, user: true, issue: true },
  });
  if (!entry) throw notFound("工时不存在。");
  return entry;
}

async function isActiveProjectMember(app: FastifyInstance, organizationId: string, projectId: string, userId: string) {
  const member = await app.prisma.projectMember.findFirst({
    where: { organizationId, projectId, userId, status: "ACTIVE" },
  });
  return Boolean(member);
}

async function assertIssueBelongsToProject(app: FastifyInstance, organizationId: string, projectId: string, issueId: string) {
  const issue = await app.prisma.issue.findFirst({
    where: { id: issueId, organizationId, projectId, deletedAt: null },
  });
  if (!issue) throw badRequest("事项必须属于当前项目。");
}

async function audit(app: FastifyInstance, context: any, action: string, entityType: string, entityId: string, data: unknown, requestId: string) {
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
