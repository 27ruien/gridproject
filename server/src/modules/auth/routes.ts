import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServerConfig } from "../../config/env.js";
import { clearSessionCookie, requireAuth, setSessionCookie } from "../../middleware/auth.js";
import { sanitizeUserDto } from "../../utils/dto.js";
import { badRequest, tooManyRequests, unauthorized } from "../../utils/errors.js";
import { verifyPassword } from "../../utils/password.js";
import { SESSION_COOKIE, createSessionToken, hashSessionToken, sessionExpiry } from "../../utils/session.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const failureBuckets = new Map<string, { count: number; firstFailedAt: number; blockedUntil?: number }>();
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type AuthRouteOptions = {
  config: ServerConfig;
};

export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions) {
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("登录参数不正确。", parsed.error.flatten());

    const email = parsed.data.email.trim().toLowerCase();
    const bucketKey = loginBucketKey(request.ip, email);
    assertLoginAllowed(bucketKey);
    const user = await app.prisma.user.findFirst({
      where: {
        email,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: { organization: true },
    });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      recordLoginFailure(bucketKey);
      throw unauthorized("邮箱或密码不正确。");
    }
    clearLoginFailures(bucketKey);

    const token = createSessionToken();
    const expiresAt = sessionExpiry(options.config.sessionTtlHours);
    const tokenHash = hashSessionToken(token, options.config.sessionSecret);
    await app.prisma.$transaction([
      app.prisma.session.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
      app.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    setSessionCookie(reply, token, options.config, expiresAt);
    return {
      requestId: request.id,
      user: sanitizeUserDto({ ...user, lastLoginAt: new Date() }),
      organization: user.organization,
    };
  });

  app.post("/logout", async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) {
      await app.prisma.session.updateMany({
        where: {
          tokenHash: hashSessionToken(token, options.config.sessionSecret),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    clearSessionCookie(reply, options.config);
    return { requestId: request.id, ok: true };
  });

  app.get("/me", async (request) => {
    const context = requireAuth(request);
    const organization = await app.prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
    });
    return {
      requestId: request.id,
      user: context.user,
      organization,
    };
  });
}

function loginBucketKey(ip: string, email: string) {
  return `${ip || "unknown"}:${email}`;
}

function assertLoginAllowed(key: string) {
  const bucket = failureBuckets.get(key);
  if (!bucket?.blockedUntil) return;
  if (bucket.blockedUntil <= Date.now()) {
    failureBuckets.delete(key);
    return;
  }
  throw tooManyRequests("登录尝试过多，请稍后再试。");
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const current = failureBuckets.get(key);
  const bucket = current && now - current.firstFailedAt <= FAILURE_WINDOW_MS
    ? current
    : { count: 0, firstFailedAt: now };
  bucket.count += 1;
  if (bucket.count >= MAX_FAILURES) bucket.blockedUntil = now + BLOCK_MS;
  failureBuckets.set(key, bucket);
}

function clearLoginFailures(key: string) {
  failureBuckets.delete(key);
}
