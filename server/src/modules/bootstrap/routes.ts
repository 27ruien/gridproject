import type { FastifyInstance } from "fastify";
import { UserRepository } from "../../repositories/users.js";
import { requireAuth } from "../../middleware/auth.js";
import { auditLogDto, costRecordDto, issueDto, projectDto, projectMemberDto, sanitizeUserDto, timeEntryDto } from "../../utils/dto.js";

export async function bootstrapRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const repository = new UserRepository(app.prisma);
    const [organization, users, projects, issues, timeEntries, projectMembers, costRecords, auditLogs] = await Promise.all([
      app.prisma.organization.findUniqueOrThrow({ where: { id: context.organizationId } }),
      app.prisma.user.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { updatedAt: "desc" },
      }),
      app.prisma.project.findMany({
        where: { organizationId: context.organizationId, deletedAt: null },
        include: { owner: true },
        orderBy: { updatedAt: "desc" },
      }),
      app.prisma.issue.findMany({
        where: { organizationId: context.organizationId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
      }),
      app.prisma.timeEntry.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: null,
          ...(context.isAdmin ? {} : { OR: [{ userId: context.userId }, { project: { ownerId: context.userId } }] }),
        },
        include: { user: true },
        orderBy: { workDate: "desc" },
      }),
      app.prisma.projectMember.findMany({
        where: { organizationId: context.organizationId },
        include: { user: true },
        orderBy: { updatedAt: "desc" },
      }),
      app.prisma.projectCostRecord.findMany({
        where: {
          organizationId: context.organizationId,
          status: "ACTIVE",
          ...(context.isAdmin ? {} : { project: { ownerId: context.userId } }),
        },
        include: { project: { include: { owner: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      context.isAdmin
        ? app.prisma.auditLog.findMany({
          where: { organizationId: context.organizationId },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
        : Promise.resolve([]),
    ]);

    const usersWithStats = await Promise.all(users.map(async (user) => ({
      ...sanitizeUserDto(user),
      stats: await repository.stats(user.id, context.organizationId),
    })));

    return {
      requestId: request.id,
      organization,
      currentUser: context.user,
      settings: {
        platformName: "GridProject",
        logoText: "G",
      },
      users: usersWithStats,
      projects: projects.map(projectDto),
      issues: issues.map(issueDto),
      timeEntries: timeEntries.map(timeEntryDto),
      projectMembers: projectMembers.map(projectMemberDto),
      costRecords: costRecords.map(costRecordDto),
      sessions: [],
      auditLogs: auditLogs.map(auditLogDto),
      trash: [],
    };
  });
}
