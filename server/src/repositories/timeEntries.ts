import type { PrismaClient } from "../../generated/prisma/client.js";

export class TimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async visibleProjectIds(organizationId: string, userId: string) {
    const owned = await this.prisma.project.findMany({
      where: { organizationId, ownerId: userId, deletedAt: null },
      select: { id: true },
    });
    return owned.map((project) => project.id);
  }
}
