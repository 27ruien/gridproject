import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { canManageMilestones } from "../../policies/access.js";
import { audit, requireVisibleProject } from "../shared.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { milestoneDto, parseDateOnly } from "../../utils/dto.js";

const milestoneBaseSchema = z.object({
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  window: z.string().optional().nullable(),
  focus: z.string().optional().nullable(),
  status: z.string().min(1).default("未开始"),
  dueDate: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
}).strict();

const milestoneCreateSchema = milestoneBaseSchema.refine((value) => value.title || value.name, {
  message: "title 或 name 必填。",
  path: ["title"],
});

const milestonePatchSchema = milestoneBaseSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "至少提交一个字段。",
});

export async function milestoneRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/milestones", async (request) => {
    const context = requireAuth(request);
    const project = await requireVisibleProject(app, context, (request.params as { projectId: string }).projectId);
    const rows = await app.prisma.milestone.findMany({
      where: { organizationId: context.organizationId, projectId: project.id, deletedAt: null },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    });
    return { requestId: request.id, rows: rows.map(milestoneDto) };
  });

  app.post("/projects/:projectId/milestones", async (request, reply) => {
    const context = requireAuth(request);
    const project = await requireVisibleProject(app, context, (request.params as { projectId: string }).projectId);
    if (!canManageMilestones(context, project, project.members || [])) throw forbidden("没有权限管理该项目里程碑。");
    const parsed = milestoneCreateSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("里程碑参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const row = await app.prisma.milestone.create({
      data: {
        organizationId: context.organizationId,
        projectId: project.id,
        title: (input.title || input.name || "").trim(),
        window: input.window || null,
        focus: input.focus || null,
        status: input.status,
        dueDate: parseDateOnly(input.dueDate) ?? null,
        completedAt: parseCompletedAt(input.completedAt, input.status),
      },
    });
    await audit(app, context, "milestone.create", "Milestone", row.id, { projectId: project.id }, request.id);
    reply.status(201);
    return { requestId: request.id, milestone: milestoneDto(row) };
  });

  app.patch("/milestones/:milestoneId", async (request) => {
    const context = requireAuth(request);
    const current = await requireMilestone(app, context.organizationId, (request.params as { milestoneId: string }).milestoneId);
    const project = await requireVisibleProject(app, context, current.projectId);
    if (!canManageMilestones(context, project, project.members || [])) throw forbidden("没有权限管理该项目里程碑。");
    const parsed = milestonePatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("里程碑参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const nextStatus = input.status ?? current.status;
    const row = await app.prisma.milestone.update({
      where: { id: current.id },
      data: {
        ...(input.title !== undefined || input.name !== undefined ? { title: (input.title || input.name || "").trim() } : {}),
        ...(input.window !== undefined ? { window: input.window || null } : {}),
        ...(input.focus !== undefined ? { focus: input.focus || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.dueDate !== undefined ? { dueDate: parseDateOnly(input.dueDate) ?? null } : {}),
        ...(input.completedAt !== undefined || input.status !== undefined ? { completedAt: parseCompletedAt(input.completedAt, nextStatus) } : {}),
      },
    });
    await audit(app, context, "milestone.update", "Milestone", row.id, input, request.id);
    return { requestId: request.id, milestone: milestoneDto(row) };
  });

  app.delete("/milestones/:milestoneId", async (request) => {
    const context = requireAuth(request);
    const current = await requireMilestone(app, context.organizationId, (request.params as { milestoneId: string }).milestoneId);
    const project = await requireVisibleProject(app, context, current.projectId);
    if (!canManageMilestones(context, project, project.members || [])) throw forbidden("没有权限管理该项目里程碑。");
    const row = await app.prisma.milestone.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), deletedById: context.userId },
    });
    await audit(app, context, "milestone.delete", "Milestone", row.id, {}, request.id);
    return { requestId: request.id, milestone: milestoneDto(row) };
  });

  app.post("/milestones/:milestoneId/restore", async (request) => {
    const context = requireAuth(request);
    const current = await requireMilestone(app, context.organizationId, (request.params as { milestoneId: string }).milestoneId, true);
    const project = await requireVisibleProject(app, context, current.projectId);
    if (!canManageMilestones(context, project, project.members || [])) throw forbidden("没有权限管理该项目里程碑。");
    const row = await app.prisma.milestone.update({
      where: { id: current.id },
      data: { deletedAt: null, deletedById: null },
    });
    await audit(app, context, "milestone.restore", "Milestone", row.id, {}, request.id);
    return { requestId: request.id, milestone: milestoneDto(row) };
  });
}

async function requireMilestone(app: FastifyInstance, organizationId: string, id: string, includeDeleted = false) {
  const row = await app.prisma.milestone.findFirst({
    where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
  });
  if (!row) throw notFound("里程碑不存在。");
  return row;
}

function parseCompletedAt(value: string | null | undefined, status: string) {
  if (value === null) return null;
  if (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw badRequest("completedAt 必须是合法时间。");
    return date;
  }
  return status === "已完成" ? new Date() : null;
}
