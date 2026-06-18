import type { PrismaClient } from "../../generated/prisma/client.js";
import { toNumber } from "../utils/dto.js";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async stats(userId: string, organizationId: string) {
    const [ownerProjects, participantMemberships, hourAggregate] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId, ownerId: userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.projectMember.findMany({
        where: { organizationId, userId, status: "ACTIVE", project: { deletedAt: null } },
        include: { project: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: { organizationId, userId, deletedAt: null },
        _sum: { hours: true },
      }),
    ]);

    const participantProjects = participantMemberships.map((membership) => membership.project);
    const lastTimeEntry = await this.prisma.timeEntry.findFirst({
      where: { organizationId, userId, deletedAt: null },
      orderBy: { workDate: "desc" },
    });

    return {
      ownerProjectCount: ownerProjects.length,
      participantProjectCount: participantProjects.length,
      ownerProjects,
      participantProjects,
      totalHours: toNumber(hourAggregate._sum.hours),
      lastTimeEntryAt: lastTimeEntry?.workDate.toISOString().slice(0, 10) || "",
    };
  }
}
