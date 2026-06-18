import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ProjectRepository } from "../../repositories/projects.js";
import { requireAuth } from "../../middleware/auth.js";
import { canCreateProject, canManageProject, canViewProject } from "../../policies/access.js";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors.js";
import { issueDto, milestoneDto, pageEnvelope, pagination, parseDateOnly, projectDto, projectMemberDto, timeEntryDto, costRecordDto } from "../../utils/dto.js";

const projectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  templateId: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  health: z.number().int().min(0).max(100).optional(),
  ownerId: z.string().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  testDate: z.string().optional().nullable(),
  acceptanceDate: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
});

const projectPatchSchema = projectSchema.partial();

const memberSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const issueSchema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(1),
  type: z.string().default("任务"),
  status: z.string().default("未开始"),
  ownerId: z.string().optional().nullable(),
  creatorId: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: z.number().optional().nullable(),
  actualHours: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function projectRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { code: { contains: query.search, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [projects, totalCount] = await Promise.all([
      app.prisma.project.findMany({
        where,
        include: { owner: true },
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
          config: { templateId: input.templateId || "agile" },
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
    if (!canViewProject(context, project)) throw notFound("项目不存在。");
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
          ...(input.templateId !== undefined ? { config: { templateId: input.templateId || "agile" } } : {}),
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
    const updated = await app.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: context.userId },
      include: { owner: true },
    });
    await audit(app, context, "project.delete", "Project", id, { deletedAt: updated.deletedAt }, request.id);
    return { requestId: request.id, project: projectDto(updated) };
  });

  app.get("/:id/board", async (request) => {
    const context = requireAuth(request);
    const { id } = request.params as { id: string };
    const repository = new ProjectRepository(app.prisma);
    const project = await repository.findBoard(context.organizationId, id);
    if (!canViewProject(context, project)) throw notFound("项目不存在。");
    return {
      requestId: request.id,
      project: projectDto(project),
      issues: project!.issues.map(issueDto),
      milestones: project!.milestones.map(milestoneDto),
      members: project!.members.map(projectMemberDto),
      timeEntries: project!.timeEntries.map(timeEntryDto),
      costRecord: project!.costRecord ? costRecordDto(project!.costRecord) : null,
      permissions: permissionsForProject(context, project),
    };
  });

  app.get("/:id/members", async (request) => {
    const context = requireAuth(request);
    const project = await requireVisibleProject(app, context, (request.params as { id: string }).id);
    const members = await app.prisma.projectMember.findMany({
      where: { organizationId: context.organizationId, projectId: project.id },
      include: { user: true },
      orderBy: { updatedAt: "desc" },
    });
    return { requestId: request.id, rows: members.map(projectMemberDto) };
  });

  app.post("/:id/members", async (request, reply) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const parsed = memberSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("成员参数不正确。", parsed.error.flatten());
    await assertActiveUser(app, context.organizationId, parsed.data.userId);
    const member = await app.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: parsed.data.userId } },
      create: { organizationId: context.organizationId, projectId: project.id, userId: parsed.data.userId, status: parsed.data.status },
      update: { status: parsed.data.status },
      include: { user: true },
    });
    await audit(app, context, "project_member.upsert", "ProjectMember", member.id, { projectId: project.id, userId: parsed.data.userId, status: parsed.data.status }, request.id);
    reply.status(201);
    return { requestId: request.id, member: projectMemberDto(member) };
  });

  app.patch("/:id/members/:memberId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const { memberId } = request.params as { memberId: string };
    const parsed = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }).safeParse(request.body);
    if (!parsed.success) throw badRequest("成员参数不正确。", parsed.error.flatten());
    const member = await app.prisma.projectMember.findFirst({ where: { id: memberId, organizationId: context.organizationId, projectId: project.id } });
    if (!member) throw notFound("成员不存在。");
    if (member.userId === project.ownerId && parsed.data.status === "INACTIVE") throw badRequest("不能停用当前项目 Owner 的成员身份。");
    const updated = await app.prisma.projectMember.update({ where: { id: memberId }, data: { status: parsed.data.status }, include: { user: true } });
    await audit(app, context, "project_member.update", "ProjectMember", memberId, parsed.data, request.id);
    return { requestId: request.id, member: projectMemberDto(updated) };
  });

  app.delete("/:id/members/:memberId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const { memberId } = request.params as { memberId: string };
    const member = await app.prisma.projectMember.findFirst({ where: { id: memberId, organizationId: context.organizationId, projectId: project.id } });
    if (!member) throw notFound("成员不存在。");
    if (member.userId === project.ownerId) throw badRequest("不能移除当前项目 Owner。");
    const updated = await app.prisma.projectMember.update({ where: { id: memberId }, data: { status: "INACTIVE" }, include: { user: true } });
    await audit(app, context, "project_member.delete", "ProjectMember", memberId, {}, request.id);
    return { requestId: request.id, member: projectMemberDto(updated) };
  });

  app.post("/:id/issues", async (request, reply) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const parsed = issueSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("事项参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const code = input.code || `ISS-${Date.now().toString().slice(-5)}`;
    const issue = await app.prisma.issue.create({
      data: {
        organizationId: context.organizationId,
        projectId: project.id,
        code,
        title: input.title.trim(),
        type: input.type,
        status: input.status,
        ownerId: input.ownerId || null,
        creatorId: input.creatorId || context.userId,
        priority: input.priority || null,
        startDate: parseDateOnly(input.startDate),
        dueDate: parseDateOnly(input.dueDate),
        estimatedHours: input.estimatedHours ?? null,
        actualHours: input.actualHours ?? null,
        description: input.description || "",
      },
    });
    await audit(app, context, "issue.create", "Issue", issue.id, { projectId: project.id }, request.id);
    reply.status(201);
    return { requestId: request.id, issue: issueDto(issue) };
  });

  app.patch("/:id/issues/:issueId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const { issueId } = request.params as { issueId: string };
    const issue = await app.prisma.issue.findFirst({ where: { id: issueId, organizationId: context.organizationId, projectId: project.id, deletedAt: null } });
    if (!issue) throw notFound("事项不存在。");
    const parsed = issueSchema.partial().safeParse(request.body);
    if (!parsed.success) throw badRequest("事项参数不正确。", parsed.error.flatten());
    const input = parsed.data;
    const updated = await app.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
        ...(input.creatorId !== undefined ? { creatorId: input.creatorId || null } : {}),
        ...(input.priority !== undefined ? { priority: input.priority || null } : {}),
        ...(input.startDate !== undefined ? { startDate: parseDateOnly(input.startDate) ?? null } : {}),
        ...(input.dueDate !== undefined ? { dueDate: parseDateOnly(input.dueDate) ?? null } : {}),
        ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
        ...(input.actualHours !== undefined ? { actualHours: input.actualHours } : {}),
        ...(input.description !== undefined ? { description: input.description || "" } : {}),
      },
    });
    await audit(app, context, "issue.update", "Issue", issueId, input, request.id);
    return { requestId: request.id, issue: issueDto(updated) };
  });

  app.delete("/:id/issues/:issueId", async (request) => {
    const context = requireAuth(request);
    const project = await requireManagedProject(app, context, (request.params as { id: string }).id);
    const { issueId } = request.params as { issueId: string };
    const issue = await app.prisma.issue.findFirst({ where: { id: issueId, organizationId: context.organizationId, projectId: project.id, deletedAt: null } });
    if (!issue) throw notFound("事项不存在。");
    const updated = await app.prisma.issue.update({ where: { id: issueId }, data: { deletedAt: new Date() } });
    await audit(app, context, "issue.delete", "Issue", issueId, {}, request.id);
    return { requestId: request.id, issue: issueDto(updated) };
  });
}

async function requireVisibleProject(app: FastifyInstance, context: any, id: string) {
  const project = await app.prisma.project.findFirst({ where: { id, organizationId: context.organizationId, deletedAt: null }, include: { owner: true } });
  if (!canViewProject(context, project)) throw notFound("项目不存在。");
  return project!;
}

async function requireManagedProject(app: FastifyInstance, context: any, id: string) {
  const project = await requireVisibleProject(app, context, id);
  if (!canManageProject(context, project)) throw forbidden("没有权限管理该项目。");
  return project;
}

async function assertActiveUser(app: FastifyInstance, organizationId: string, userId: string) {
  const user = await app.prisma.user.findFirst({ where: { id: userId, organizationId, status: "ACTIVE", deletedAt: null } });
  if (!user) throw badRequest("成员必须是当前组织 ACTIVE 用户。");
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

function permissionsForProject(context: any, project: any) {
  const manage = canManageProject(context, project);
  return {
    canView: canViewProject(context, project),
    canViewBoard: canViewProject(context, project),
    canUpdate: manage,
    canDelete: manage,
    canManageMembers: manage,
    canViewProjectTimeEntries: manage,
    canApproveTimeEntries: manage,
    canViewCost: manage,
    canManageCost: manage,
    canExportCost: manage,
  };
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
