import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ProjectRepository } from "../../repositories/projects.js";
import { requireAuth } from "../../middleware/auth.js";
import { canCreateProject, canManageProject, canViewProjectWorkspace } from "../../policies/access.js";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors.js";
import { issueDto, milestoneDto, pageEnvelope, pagination, parseDateOnly, projectDto, projectMemberDto, timeEntryDto, costRecordDto, toJsonObject } from "../../utils/dto.js";

const executionTeamSchema = z.enum(["商务", "设计", "开发", "特效"]);
const projectStatusSchema = z.enum(["规划中", "开发阶段", "测试阶段", "验收阶段", "上线阶段", "已暂停", "已完成"]);
const ACTIVE_PROJECT_MEMBER_STATUS = "ACTIVE" as const;

const projectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  templateId: z.string().optional(),
  executionTeams: z.array(executionTeamSchema).max(4).optional(),
  description: z.string().optional(),
  status: projectStatusSchema.optional(),
  health: z.number().int().min(0).max(100).optional(),
  ownerId: z.string().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  testDate: z.string().optional().nullable(),
  acceptanceDate: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
}).strict();

const projectPatchSchema = projectSchema.partial();

export async function projectRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const accessWhere = context.isAdmin ? {} : {
      OR: [
        { ownerId: context.userId },
        { createdById: context.userId },
          { members: { some: { userId: context.userId, status: ACTIVE_PROJECT_MEMBER_STATUS } } },
      ],
    };
    const searchWhere = query.search ? {
      OR: [
        { name: { contains: query.search, mode: "insensitive" as const } },
        { code: { contains: query.search, mode: "insensitive" as const } },
      ],
    } : {};
    const where: any = {
      organizationId: context.organizationId,
      deletedAt: null,
      ...(Object.keys(accessWhere).length || Object.keys(searchWhere).length ? { AND: [accessWhere, searchWhere].filter((item) => Object.keys(item).length) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.team ? { config: { path: ["executionTeams"], array_contains: [query.team] } } : {}),
    };
    const [projects, totalCount] = await Promise.all([
      app.prisma.project.findMany({
        where,
        include: { owner: true, members: true },
        orderBy: sortProject(query.sort),
        skip,
        take,
      }),
      app.prisma.project.count({ where }),
    ]);
    return { requestId: request.id, ...pageEnvelope(projects.map(projectDto), totalCount, page, pageSize) };
  });

  app.post("/", async (request, reply) => {
    const context = requireAuth(request);
    if (!canCreateProject(context)) throw forbidden("没有权限创建项目。");
    const parsed = projectSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("项目参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const ownerId = input.ownerId || context.userId;
    const owner = await app.prisma.user.findFirst({
      where: { id: ownerId, organizationId: context.organizationId, status: "ACTIVE", deletedAt: null },
    });
    if (!owner) throw badRequest("项目 Owner 必须是当前组织 ACTIVE 用户。");

    const code = (input.code || `P${Date.now().toString().slice(-6)}`).trim().toUpperCase();
    await assertProjectCodeAvailable(app, context.organizationId, code);
    const created = await app.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: context.organizationId,
          name: input.name.trim(),
          code,
          description: input.description || "",
          status: input.status || "规划中",
          health: input.health ?? 90,
          startDate: parseDateOnly(input.startDate),
          dueDate: parseDateOnly(input.dueDate),
          testDate: parseDateOnly(input.testDate),
          acceptanceDate: parseDateOnly(input.acceptanceDate),
          releaseDate: parseDateOnly(input.releaseDate),
          config: { templateId: input.templateId || "agile", executionTeams: input.executionTeams || [] },
          ownerId,
          createdById: context.userId,
        },
        include: { owner: true },
      });
      await tx.projectMember.create({
        data: {
          organizationId: context.organizationId,
          projectId: project.id,
          userId: ownerId,
          status: "ACTIVE",
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project.create",
          entityType: "Project",
          entityId: project.id,
          data: { ownerId },
          requestId: request.id,
        },
      });
      return project;
    });
    reply.status(201);
    return { requestId: request.id, project: projectDto(created) };
  });

  app.get("/:id", async (request) => {
    const context = requireAuth(request);
    const { id } = request.params as { id: string };
    const repository = new ProjectRepository(app.prisma);
    const project = await repository.findVisibleById(context.organizationId, id);
    if (!canViewProjectWorkspace(context, project, project?.members || [])) throw notFound("项目不存在。");
    return { requestId: request.id, project: projectDto(project) };
  });

  app.patch("/:id", async (request) => {
    const context = requireAuth(request);
    const { id } = request.params as { id: string };
    const repository = new ProjectRepository(app.prisma);
    const project = await repository.findVisibleById(context.organizationId, id);
    if (!project) throw notFound("项目不存在。");
    if (!canManageProject(context, project)) throw forbidden("没有权限编辑该项目。");
    const parsed = projectPatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("项目参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const currentConfig = toJsonObject(project.config);

    const nextCode = input.code?.trim().toUpperCase();
    if (nextCode && nextCode !== project.code) await assertProjectCodeAvailable(app, context.organizationId, nextCode, project.id);
    if (input.ownerId && input.ownerId !== project.ownerId) {
      const owner = await app.prisma.user.findFirst({
        where: { id: input.ownerId, organizationId: context.organizationId, status: "ACTIVE", deletedAt: null },
      });
      if (!owner) throw badRequest("项目 Owner 必须是当前组织 ACTIVE 用户。");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const nextProject = await tx.project.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(nextCode ? { code: nextCode } : {}),
          ...(input.description !== undefined ? { description: input.description || "" } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.health !== undefined ? { health: input.health } : {}),
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
          ...(input.startDate !== undefined ? { startDate: parseDateOnly(input.startDate) ?? null } : {}),
          ...(input.dueDate !== undefined ? { dueDate: parseDateOnly(input.dueDate) ?? null } : {}),
          ...(input.testDate !== undefined ? { testDate: parseDateOnly(input.testDate) ?? null } : {}),
          ...(input.acceptanceDate !== undefined ? { acceptanceDate: parseDateOnly(input.acceptanceDate) ?? null } : {}),
          ...(input.releaseDate !== undefined ? { releaseDate: parseDateOnly(input.releaseDate) ?? null } : {}),
          ...(input.templateId !== undefined || input.executionTeams !== undefined ? {
            config: {
              ...currentConfig,
              ...(input.templateId !== undefined ? { templateId: input.templateId || "agile" } : {}),
              ...(input.executionTeams !== undefined ? { executionTeams: input.executionTeams } : {}),
            },
          } : {}),
        },
        include: { owner: true },
      });
      if (input.ownerId) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId: input.ownerId } },
          create: { organizationId: context.organizationId, projectId: id, userId: input.ownerId, status: "ACTIVE" },
          update: { status: "ACTIVE" },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project.update",
          entityType: "Project",
          entityId: id,
          data: input as any,
          requestId: request.id,
        },
      });
      return nextProject;
    });
    return { requestId: request.id, project: projectDto(updated) };
  });

  app.delete("/:id", async (request) => {
    const context = requireAuth(request);
    const { id } = request.params as { id: string };
    const repository = new ProjectRepository(app.prisma);
    const project = await repository.findVisibleById(context.organizationId, id);
    if (!project) throw notFound("项目不存在。");
    if (!canManageProject(context, project)) throw forbidden("没有权限删除该项目。");
    const issueCount = await app.prisma.issue.count({ where: { projectId: id, deletedAt: null } });
    if (issueCount) throw conflict("该项目仍有事项，请先处理事项后再删除。", { issueCount });
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.project.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: context.userId },
        include: { owner: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "project.delete",
          entityType: "Project",
          entityId: id,
          data: { deletedAt: row.deletedAt?.toISOString() },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, project: projectDto(updated) };
  });

  app.get("/:id/board", async (request) => {
    const context = requireAuth(request);
    const { id } = request.params as { id: string };
    const repository = new ProjectRepository(app.prisma);
    const project = await repository.findBoard(context.organizationId, id);
    if (!canViewProjectWorkspace(context, project, project?.members || [])) throw notFound("项目不存在。");
    return {
      requestId: request.id,
      project: projectDto(project),
      issues: project!.issues.map(issueDto),
      milestones: project!.milestones.map(milestoneDto),
      members: project!.members.map(projectMemberDto),
      timeEntries: project!.timeEntries.map(timeEntryDto),
      costRecord: project!.costRecord ? costRecordDto(project!.costRecord) : null,
      permissions: permissionsForProject(context, project, project!.members),
    };
  });

}

async function assertProjectCodeAvailable(app: FastifyInstance, organizationId: string, code: string, exceptProjectId?: string) {
  const duplicate = await app.prisma.project.findFirst({
    where: {
      organizationId,
      code,
      ...(exceptProjectId ? { id: { not: exceptProjectId } } : {}),
    },
  });
  if (duplicate) throw conflict("同一组织下项目代码必须唯一。");
}

function sortProject(sort = "updatedAt:desc") {
  if (sort === "name:asc") return { name: "asc" as const };
  if (sort === "health:asc") return { health: "asc" as const };
  if (sort === "createdAt:desc") return { createdAt: "desc" as const };
  return { updatedAt: "desc" as const };
}

function permissionsForProject(context: any, project: any, members: any[] = []) {
  const manage = canManageProject(context, project);
  const ownerOrCreator = manage || project?.createdById === context.userId;
  return {
    canView: canViewProjectWorkspace(context, project, members),
    canViewBoard: canViewProjectWorkspace(context, project, members),
    canUpdate: manage,
    canDelete: manage,
    canManageMembers: manage,
    canViewProjectTimeEntries: ownerOrCreator,
    canApproveTimeEntries: false,
    canViewCost: ownerOrCreator,
    canManageCost: ownerOrCreator,
    canExportCost: ownerOrCreator,
  };
}
