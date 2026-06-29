import type { PrismaClient } from "../../generated/prisma/client.js";

export class TimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async visibleProjectIds(organizationId: string, userId: string) {
    const owned = await this.prisma.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: "ACTIVE", role: "MANAGER" } } },
        ],
      },
      select: { id: true },
    });
    return owned.map((project) => project.id);
  }
}
