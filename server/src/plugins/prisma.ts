import fp from "fastify-plugin";
import { PrismaClient } from "../../generated/prisma/client.js";
import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (fastify: FastifyInstance, options: { config: ServerConfig }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: options.config.databaseUrl } } });
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
