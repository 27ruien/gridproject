import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { ServerConfig } from "./config/env.js";
import { getConfig } from "./config/env.js";
import { authContextPlugin } from "./middleware/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { sendError } from "./utils/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { bootstrapRoutes } from "./modules/bootstrap/routes.js";
import { costRecordRoutes } from "./modules/cost-records/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { issueCommentRoutes } from "./modules/issue-comments/routes.js";
import { issueRoutes } from "./modules/issues/routes.js";
import { milestoneRoutes } from "./modules/milestones/routes.js";
import { projectMemberRoutes } from "./modules/project-members/routes.js";
import { projectRoutes } from "./modules/projects/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { timeEntryRoutes } from "./modules/time-entries/routes.js";
import { trashRoutes } from "./modules/trash/routes.js";
import { userRoutes } from "./modules/users/routes.js";

export async function buildApp(config: ServerConfig = getConfig()) {
  if (config.nodeEnv === "production" && !config.sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  const app = Fastify({
    logger: config.nodeEnv === "test" ? false : true,
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    return sendError(reply, error, request.id);
  });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, config.frontendOrigins.includes(origin));
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(prismaPlugin);
  await app.register(authContextPlugin, { config });

  await app.register(healthRoutes, { prefix: "/api", config });
  await app.register(authRoutes, { prefix: "/api/auth", config });
  await app.register(bootstrapRoutes, { prefix: "/api/bootstrap" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(projectRoutes, { prefix: "/api/projects" });
  await app.register(projectMemberRoutes, { prefix: "/api/projects" });
  await app.register(issueRoutes, { prefix: "/api" });
  await app.register(issueCommentRoutes, { prefix: "/api" });
  await app.register(milestoneRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  await app.register(trashRoutes, { prefix: "/api/trash" });
  await app.register(timeEntryRoutes, { prefix: "/api/time-entries" });
  await app.register(costRecordRoutes, { prefix: "/api/cost-records" });

  return app;
}
