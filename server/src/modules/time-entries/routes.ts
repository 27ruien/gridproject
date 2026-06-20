import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TimeEntryRepository } from "../../repositories/timeEntries.js";
import { requireAuth } from "../../middleware/auth.js";
import { canApproveTimeEntry, canDeleteTimeEntry, canEditTimeEntry, canRejectTimeEntry, canSubmitTimeEntry, canViewProject, canViewTimeEntry } from "../../policies/access.js";
import { assertDailyHoursLimit, withDailyTimeEntryLock } from "../../services/timeEntryConsistency.js";
import { badRequest, forbidden, notFound, validationError } from "../../utils/errors.js";
import { pageEnvelope, pagination, parseDateOnly, timeEntryDto } from "../../utils/dto.js";

const timeEntrySchema = z.object({
  projectId: z.string().min(1),
  issueId: z.string().optional().nullable(),
  userId: z.string().optional(),
  workDate: z.string().min(1),
  hours: z.number().positive().max(24),
  description: z.string().optional().nullable(),
  correctionReason: z.string().optional().nullable(),
}).strict();

const timeEntryPatchSchema = z.object({
  issueId: z.string().optional().nullable(),
  workDate: z.string().optional(),
  hours: z.number().positive().max(24).optional(),
  description: z.string().optional().nullable(),
  correctionReason: z.string().optional().nullable(),
}).strict();

const timeEntryMoveSchema = z.object({
  targetProjectId: z.string().min(1),
  targetIssueId: z.string().optional().nullable(),
  correctionReason: z.string().min(1),
}).strict();

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
    if (!parsed.success) throw validationError("工时参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const userId = context.isAdmin && input.userId ? input.userId : context.userId;
    if (input.userId && input.userId !== context.userId && !context.isAdmin) throw forbidden("只能为自己创建工时。");
    if (context.isAdmin && userId !== context.userId && !input.correctionReason?.trim()) {
      throw badRequest("管理员代录他人工时必须填写修正原因。");
    }
    const project = await app.prisma.project.findFirst({ where: { id: input.projectId, organizationId: context.organizationId, deletedAt: null } });
    if (!canViewProject(context, project)) throw notFound("项目不存在。");
    await assertActiveProjectMember(app, context.organizationId, project!.id, userId);
    if (input.issueId) await assertIssueBelongsToProject(app, context.organizationId, project!.id, input.issueId);
    const workDate = parseRequiredWorkDate(input.workDate);

    const entry = await withDailyTimeEntryLock(app.prisma, { organizationId: context.organizationId, userId, workDate }, async (tx) => {
      await assertDailyHoursLimit(tx, { organizationId: context.organizationId, userId, workDate }, input.hours);
      const created = await tx.timeEntry.create({
        data: {
          organizationId: context.organizationId,
          projectId: project!.id,
          issueId: input.issueId || null,
          userId,
          reporterId: context.userId,
          workDate,
          hours: input.hours,
          status: "DRAFT",
          description: input.description || "",
          correctionReason: input.correctionReason || null,
        },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.create",
          entityType: "TimeEntry",
          entityId: created.id,
          data: { projectId: created.projectId, userId, correctionReason: input.correctionReason || "" },
          requestId: request.id,
        },
      });
      return created;
    });
    reply.status(201);
    return { requestId: request.id, entry: timeEntryDto(entry) };
  });

  app.patch("/:id", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canEditTimeEntry(context, entry, entry.project)) throw forbidden("没有权限编辑该工时。");
    const parsed = timeEntryPatchSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("工时参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    if (context.isAdmin && entry.userId !== context.userId && !input.correctionReason?.trim()) {
      throw badRequest("管理员修改他人工时必须填写修正原因。");
    }
    if (input.issueId) await assertIssueBelongsToProject(app, context.organizationId, entry.projectId, input.issueId);

    const nextWorkDate = input.workDate !== undefined ? parseRequiredWorkDate(input.workDate) : entry.workDate;
    const nextHours = input.hours !== undefined ? input.hours : Number(entry.hours);
    const updated = await withDailyTimeEntryLock(app.prisma, { organizationId: context.organizationId, userId: entry.userId, workDate: nextWorkDate }, async (tx) => {
      await assertDailyHoursLimit(tx, { organizationId: context.organizationId, userId: entry.userId, workDate: nextWorkDate }, nextHours, entry.id);
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: {
          ...(input.issueId !== undefined ? { issueId: input.issueId || null } : {}),
          ...(input.workDate !== undefined ? { workDate: nextWorkDate } : {}),
          ...(input.hours !== undefined ? { hours: input.hours } : {}),
          ...(input.description !== undefined ? { description: input.description || "" } : {}),
          ...(input.correctionReason !== undefined ? { correctionReason: input.correctionReason || "" } : {}),
        },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.update",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: { before: auditSnapshot(entry), after: auditSnapshot(row), correctionReason: input.correctionReason || "" },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/move", async (request) => {
    const context = requireAuth(request);
    if (!context.isAdmin) throw forbidden("只有 ADMIN 可以移动工时所属项目。");
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    const parsed = timeEntryMoveSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("移动工时参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const targetProject = await app.prisma.project.findFirst({
      where: { id: input.targetProjectId, organizationId: context.organizationId, deletedAt: null },
    });
    if (!targetProject) throw notFound("目标项目不存在。");
    await assertActiveProjectMember(app, context.organizationId, targetProject.id, entry.userId);

    let targetIssueId: string | null = null;
    if (input.targetIssueId) {
      await assertIssueBelongsToProject(app, context.organizationId, targetProject.id, input.targetIssueId);
      targetIssueId = input.targetIssueId;
    } else if (input.targetIssueId === null) {
      targetIssueId = null;
    } else if (entry.issueId) {
      const originalIssueStillMatches = await app.prisma.issue.findFirst({
        where: { id: entry.issueId, organizationId: context.organizationId, projectId: targetProject.id, deletedAt: null },
        select: { id: true },
      });
      targetIssueId = originalIssueStillMatches ? entry.issueId : null;
    }

    const updated = await withDailyTimeEntryLock(app.prisma, { organizationId: context.organizationId, userId: entry.userId, workDate: entry.workDate }, async (tx) => {
      await assertDailyHoursLimit(tx, { organizationId: context.organizationId, userId: entry.userId, workDate: entry.workDate }, Number(entry.hours), entry.id);
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: {
          projectId: targetProject.id,
          issueId: targetIssueId,
          correctionReason: input.correctionReason.trim(),
        },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.move",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: {
            before: { projectId: entry.projectId, issueId: entry.issueId },
            after: { projectId: row.projectId, issueId: row.issueId },
            correctionReason: input.correctionReason.trim(),
          },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.delete("/:id", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canDeleteTimeEntry(context, entry, entry.project)) throw forbidden("没有权限删除该工时。");
    const reason = (request.body as any)?.correctionReason || "";
    if (context.isAdmin && entry.userId !== context.userId && !String(reason).trim()) {
      throw badRequest("管理员删除他人工时必须填写修正原因。");
    }
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: { deletedAt: new Date(), deletedById: context.userId },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.delete",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: { before: auditSnapshot(entry), correctionReason: reason },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/submit", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canSubmitTimeEntry(context, entry)) throw forbidden("只有自己的草稿或驳回工时可以提交。");
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: { status: "SUBMITTED" },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.submit",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/approve", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canApproveTimeEntry(context, entry, entry.project)) throw forbidden("没有权限审批该工时。");
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: { status: "APPROVED", approvedAt: new Date(), approvedById: context.userId },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.approve",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });

  app.post("/:id/reject", async (request) => {
    const context = requireAuth(request);
    const entry = await getEntry(app, context, (request.params as { id: string }).id);
    if (!canRejectTimeEntry(context, entry, entry.project)) throw forbidden("没有权限驳回该工时。");
    const reason = (request.body as any)?.correctionReason || "";
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entry.id },
        data: { status: "REJECTED", correctionReason: reason, approvedAt: null, approvedById: null },
        include: { user: true, project: true, issue: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "time_entry.reject",
          entityType: "TimeEntry",
          entityId: entry.id,
          data: { reason },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, entry: timeEntryDto(updated) };
  });
}

async function getEntry(app: FastifyInstance, context: any, id: string) {
  const entry = await app.prisma.timeEntry.findFirst({
    where: { id, organizationId: context.organizationId, deletedAt: null },
    include: { project: true, user: true, issue: true },
  });
  if (!entry) throw notFound("工时不存在。");
  if (!canViewTimeEntry(context, entry, entry.project)) throw notFound("工时不存在。");
  return entry;
}

async function assertActiveProjectMember(app: FastifyInstance, organizationId: string, projectId: string, userId: string) {
  const member = await app.prisma.projectMember.findFirst({
    where: { organizationId, projectId, userId, status: "ACTIVE" },
  });
  if (!member) throw forbidden("工时所属用户必须是项目 ACTIVE 成员。");
}

async function assertIssueBelongsToProject(app: FastifyInstance, organizationId: string, projectId: string, issueId: string) {
  const issue = await app.prisma.issue.findFirst({
    where: { id: issueId, organizationId, projectId, deletedAt: null },
  });
  if (!issue) throw badRequest("事项必须属于当前项目。");
}

function parseRequiredWorkDate(value: string) {
  const date = parseDateOnly(value);
  if (!date) throw badRequest("workDate 必须是合法日期。");
  return date;
}

function auditSnapshot(entry: any) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    issueId: entry.issueId,
    userId: entry.userId,
    workDate: entry.workDate instanceof Date ? entry.workDate.toISOString().slice(0, 10) : entry.workDate,
    hours: Number(entry.hours),
    status: entry.status,
    description: entry.description,
    correctionReason: entry.correctionReason,
  };
}
