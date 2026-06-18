import fp from "fastify-plugin";
import { PrismaClient } from "../../generated/prisma/client.js";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (fastify: FastifyInstance) => {
  const prisma = new PrismaClient();
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
