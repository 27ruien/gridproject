import type { PrismaClient } from "../../generated/prisma/client.js";

export class CostRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findScoped(organizationId: string, id: string) {
    return this.prisma.projectCostRecord.findFirst({
      where: { id, organizationId },
      include: { project: { include: { owner: true } } },
    });
  }

  async calculationData(organizationId: string, projectId: string) {
    const [timeEntries, issues, users] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { organizationId, projectId, deletedAt: null },
        include: { user: true },
      }),
      this.prisma.issue.findMany({
        where: { organizationId, projectId, deletedAt: null },
      }),
      this.prisma.user.findMany({
        where: { organizationId },
      }),
    ]);
    return { timeEntries, issues, users };
  }
}
