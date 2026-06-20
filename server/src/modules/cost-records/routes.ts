import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CostRecordRepository } from "../../repositories/costRecords.js";
import { requireAuth } from "../../middleware/auth.js";
import { canViewCost } from "../../policies/access.js";
import { buildCostRawDataWorkbook, costExportFileName } from "../../services/costExport.js";
import { calculateProjectCost, getCostRawData } from "../../services/costCalculation.js";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors.js";
import { costRecordDto, pageEnvelope, pagination } from "../../utils/dto.js";

const costRecordSchema = z.object({
  projectId: z.string().min(1),
  plannedPersonDays: z.number().positive(),
  standardHoursPerDay: z.number().positive().max(24).default(8),
  notes: z.string().optional().nullable(),
});

const costRecordPatchSchema = costRecordSchema.omit({ projectId: true }).partial();

export async function costRecordRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const projectWhere = context.isAdmin
      ? { organizationId: context.organizationId, deletedAt: null }
      : { organizationId: context.organizationId, ownerId: context.userId, deletedAt: null };
    const where: any = {
      organizationId: context.organizationId,
      status: query.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
      project: {
        ...projectWhere,
        ...(query.search ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { code: { contains: query.search, mode: "insensitive" as const } },
          ],
        } : {}),
      },
    };

    const [records, totalCount] = await Promise.all([
      app.prisma.projectCostRecord.findMany({
        where,
        include: { project: { include: { owner: true } } },
        orderBy: sortCostRecord(query.sort),
        skip,
        take,
      }),
      app.prisma.projectCostRecord.count({ where }),
    ]);
    const repository = new CostRecordRepository(app.prisma);
    const rows = await Promise.all(records.map(async (record) => {
      const data = await repository.calculationData(context.organizationId, record.projectId);
      const summary = calculateProjectCost({ project: record.project, record, ...data, filter: query });
      return { ...costRecordDto(record), summary };
    }));
    return { requestId: request.id, ...pageEnvelope(rows, totalCount, page, pageSize) };
  });

  app.post("/", async (request, reply) => {
    const context = requireAuth(request);
    const parsed = costRecordSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("成本记录参数不正确。", parsed.error.flatten());
    const project = await app.prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId: context.organizationId, deletedAt: null },
      include: { owner: true },
    });
    if (!canViewCost(context, project)) throw forbidden("没有权限创建该项目成本管理记录。");
    const existing = await app.prisma.projectCostRecord.findFirst({
      where: { organizationId: context.organizationId, projectId: parsed.data.projectId },
    });
    if (existing) throw conflict("该项目已有成本管理记录，请编辑或恢复现有记录。");

    const record = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectCostRecord.create({
        data: {
          organizationId: context.organizationId,
          projectId: parsed.data.projectId,
          plannedPersonDays: parsed.data.plannedPersonDays,
          standardHoursPerDay: parsed.data.standardHoursPerDay,
          notes: parsed.data.notes || "",
          createdById: context.userId,
          updatedById: context.userId,
        },
        include: { project: { include: { owner: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "cost_record.create",
          entityType: "ProjectCostRecord",
          entityId: row.id,
          data: { projectId: row.projectId, plannedPersonDays: parsed.data.plannedPersonDays },
          requestId: request.id,
        },
      });
      return row;
    });
    reply.status(201);
    return { requestId: request.id, record: costRecordDto(record) };
  });

  app.get("/:id", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const repository = new CostRecordRepository(app.prisma);
    const data = await repository.calculationData(context.organizationId, record.projectId);
    const summary = calculateProjectCost({ project: record.project, record, ...data, filter: request.query as any });
    return { requestId: request.id, record: costRecordDto(record), summary };
  });

  app.patch("/:id", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const parsed = costRecordPatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("成本记录参数不正确。", parsed.error.flatten());
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectCostRecord.update({
        where: { id: record.id },
        data: {
          ...(parsed.data.plannedPersonDays !== undefined ? { plannedPersonDays: parsed.data.plannedPersonDays } : {}),
          ...(parsed.data.standardHoursPerDay !== undefined ? { standardHoursPerDay: parsed.data.standardHoursPerDay } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || "" } : {}),
          updatedById: context.userId,
        },
        include: { project: { include: { owner: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "cost_record.update",
          entityType: "ProjectCostRecord",
          entityId: row.id,
          data: parsed.data,
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, record: costRecordDto(updated) };
  });

  app.delete("/:id", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectCostRecord.update({
        where: { id: record.id },
        data: {
          status: "ARCHIVED",
          deletedAt: new Date(),
          deletedById: context.userId,
          updatedById: context.userId,
        },
        include: { project: { include: { owner: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "cost_record.delete",
          entityType: "ProjectCostRecord",
          entityId: row.id,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, record: costRecordDto(updated) };
  });

  app.post("/:id/restore", async (request) => {
    const context = requireAuth(request);
    const repository = new CostRecordRepository(app.prisma);
    const record = await repository.findScoped(context.organizationId, (request.params as { id: string }).id);
    if (!record) throw notFound("成本记录不存在。");
    if (!canViewCost(context, record.project)) throw forbidden("没有权限恢复该成本记录。");
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.projectCostRecord.update({
        where: { id: record.id },
        data: {
          status: "ACTIVE",
          deletedAt: null,
          deletedById: null,
          updatedById: context.userId,
        },
        include: { project: { include: { owner: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "cost_record.restore",
          entityType: "ProjectCostRecord",
          entityId: row.id,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, record: costRecordDto(updated) };
  });

  app.get("/:id/summary", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const repository = new CostRecordRepository(app.prisma);
    const data = await repository.calculationData(context.organizationId, record.projectId);
    return {
      requestId: request.id,
      summary: calculateProjectCost({ project: record.project, record, ...data, filter: request.query as any }),
    };
  });

  app.get("/:id/people", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const repository = new CostRecordRepository(app.prisma);
    const data = await repository.calculationData(context.organizationId, record.projectId);
    const summary = calculateProjectCost({ project: record.project, record, ...data, filter: request.query as any });
    return { requestId: request.id, people: summary.people };
  });

  app.get("/:id/raw-data", async (request) => {
    const { context, record } = await requireRecord(app, request);
    const repository = new CostRecordRepository(app.prisma);
    const data = await repository.calculationData(context.organizationId, record.projectId);
    return {
      requestId: request.id,
      rows: getCostRawData({ project: record.project, record, ...data, filter: request.query as any }),
    };
  });

  app.get("/:id/export", async (request, reply) => {
    const { context, record } = await requireRecord(app, request);
    const repository = new CostRecordRepository(app.prisma);
    const data = await repository.calculationData(context.organizationId, record.projectId);
    const summary = calculateProjectCost({ project: record.project, record, ...data, filter: request.query as any });
    const rawData = getCostRawData({ project: record.project, record, ...data, filter: request.query as any });
    const workbook = await buildCostRawDataWorkbook({ summary, rawData });
    const buffer = await workbook.xlsx.writeBuffer();
    await audit(app, context, "cost_record.export", "ProjectCostRecord", record.id, request.query, request.id);
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(costExportFileName(summary))}`);
    return reply.send(Buffer.from(buffer));
  });
}

async function requireRecord(app: FastifyInstance, request: any) {
  const context = requireAuth(request);
  const repository = new CostRecordRepository(app.prisma);
  const record = await repository.findScoped(context.organizationId, (request.params as { id: string }).id);
  if (!record || record.deletedAt) throw notFound("成本记录不存在。");
  if (!canViewCost(context, record.project)) throw forbidden("没有权限访问该成本记录。");
  return { context, record };
}

function sortCostRecord(sort = "updatedAt:desc") {
  if (sort === "createdAt:desc") return { createdAt: "desc" as const };
  return { updatedAt: "desc" as const };
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
