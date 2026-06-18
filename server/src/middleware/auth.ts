import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerConfig } from "../config/env.js";
import { unauthorized } from "../utils/errors.js";
import { SESSION_COOKIE, hashSessionToken } from "../utils/session.js";
import { sanitizeUserDto } from "../utils/dto.js";

type AuthPluginOptions = {
  config: ServerConfig;
};

export const authContextPlugin = fp(async (fastify: FastifyInstance, options: AuthPluginOptions) => {
  fastify.addHook("onRequest", async (request) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) return;

    const tokenHash = hashSessionToken(token, options.config.sessionSecret);
    const session = await fastify.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session || session.user.deletedAt || session.user.status !== "ACTIVE") return;

    const user = sanitizeUserDto(session.user);
    request.auth = {
      organizationId: session.organizationId,
      userId: session.userId,
      user,
      role: session.user.role,
      isAdmin: session.user.role === "ADMIN",
      isActiveUser: true,
    };
  });
});

export function requireAuth(request: FastifyRequest) {
  if (!request.auth?.isActiveUser) throw unauthorized();
  return request.auth;
}

export function setSessionCookie(reply: FastifyReply, token: string, config: ServerConfig, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: ServerConfig) {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  });
}
