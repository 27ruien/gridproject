import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../config/env.js";

export async function healthRoutes(app: FastifyInstance, options: { config: ServerConfig }) {
  app.get("/health", async () => ({
    status: "ok",
    version: options.config.appVersion,
    environment: options.config.nodeEnv === "production" ? "production" : "development",
  }));
}
