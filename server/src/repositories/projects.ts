import type { PrismaClient } from "../../generated/prisma/client.js";

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findVisibleById(organizationId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { organizationId, id, deletedAt: null },
      include: { owner: true },
    });
  }

  findBoard(organizationId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { organizationId, id, deletedAt: null },
      include: {
        owner: true,
        issues: { where: { deletedAt: null }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] },
        milestones: { where: { deletedAt: null }, orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }] },
        members: { include: { user: true }, orderBy: { updatedAt: "desc" } },
        timeEntries: { where: { deletedAt: null }, include: { user: true, issue: true }, orderBy: { workDate: "desc" } },
        costRecord: true,
      },
    });
  }
}
