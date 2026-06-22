import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { ServerConfig } from "../../config/env.js";
import { clearSessionCookie, requireAuth, setSessionCookie } from "../../middleware/auth.js";
import { PasswordFailureLimiter, passwordFailureBucketKey } from "../../security/passwordFailureLimiter.js";
import { sanitizeUserDto } from "../../utils/dto.js";
import { badRequest, tooManyRequests, unauthorized } from "../../utils/errors.js";
import { hashPassword, validatePassword, verifyPassword } from "../../utils/password.js";
import { SESSION_COOKIE, createSessionToken, hashSessionToken, sessionExpiry } from "../../utils/session.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
}).strict();

const preferenceSchema = z.object({
  density: z.enum(["compact", "comfortable"]),
  dateFormat: z.enum(["yyyy-mm-dd", "mm-dd-yyyy", "dd-mm-yyyy"]),
  weekStart: z.enum(["monday", "sunday"]),
  defaultNav: z.enum(["expanded", "collapsed", "auto"]),
  homeDueRange: z.enum(["all", "mine", "others"]),
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
}).strict();

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1),
}).strict();

const failureBuckets = new Map<string, { count: number; firstFailedAt: number; blockedUntil?: number }>();
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type AuthRouteOptions = {
  config: ServerConfig;
};

export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions) {
  const passwordFailureLimiter = new PasswordFailureLimiter();
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

  app.patch("/profile", async (request) => {
    const context = requireAuth(request);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("个人资料参数不正确。", parsed.error.flatten());
    const currentPreferences = jsonObject(context.user.preferences);
    const preferences = toJsonInput(parsed.data.avatarColor
      ? { ...currentPreferences, avatarColor: parsed.data.avatarColor }
      : currentPreferences);
    const user = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: context.userId },
        data: { name: parsed.data.name, preferences },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.profile_update",
          entityType: "User",
          entityId: context.userId,
          data: { name: parsed.data.name },
          requestId: request.id,
        },
      });
      return updated;
    });
    return { requestId: request.id, user: sanitizeUserDto(user) };
  });

  app.patch("/preferences", async (request) => {
    const context = requireAuth(request);
    const parsed = preferenceSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("偏好设置参数不正确。", parsed.error.flatten());
    const preferences = toJsonInput({ ...jsonObject(context.user.preferences), ...parsed.data });
    const user = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: context.userId }, data: { preferences } });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.preferences_update",
          entityType: "User",
          entityId: context.userId,
          data: parsed.data,
          requestId: request.id,
        },
      });
      return updated;
    });
    return { requestId: request.id, user: sanitizeUserDto(user) };
  });

  app.patch("/password", async (request) => {
    const context = requireAuth(request);
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("密码参数不正确。", parsed.error.flatten());
    if (parsed.data.newPassword === parsed.data.currentPassword) throw badRequest("新密码不能与当前密码相同。");
    if (parsed.data.newPassword !== parsed.data.confirmPassword) throw badRequest("两次输入的新密码不一致。");
    const passwordErrors = validatePassword(parsed.data.newPassword);
    if (passwordErrors.length) throw badRequest(passwordErrors.join(""));

    const bucketKey = passwordFailureBucketKey(context.userId, request.ip);
    if (passwordFailureLimiter.isBlocked(bucketKey)) {
      await app.prisma.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.password_rate_limited",
          entityType: "User",
          entityId: context.userId,
          data: { reason: "failure_limit_reached", windowMinutes: 15 },
          requestId: request.id,
        },
      });
      throw tooManyRequests("密码验证尝试过多，请稍后再试。");
    }

    const user = await app.prisma.user.findFirst({
      where: { id: context.userId, organizationId: context.organizationId, status: "ACTIVE", deletedAt: null },
    });
    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      const failure = passwordFailureLimiter.recordFailure(bucketKey);
      await app.prisma.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.password_verification_failed",
          entityType: "User",
          entityId: context.userId,
          data: { reason: "current_password_mismatch", failureCount: failure.count },
          requestId: request.id,
        },
      });
      throw badRequest("当前密码不正确。");
    }

    const currentToken = request.cookies?.[SESSION_COOKIE];
    const currentTokenHash = currentToken ? hashSessionToken(currentToken, options.config.sessionSecret) : "";
    const passwordHash = await hashPassword(parsed.data.newPassword);
    const now = new Date();
    const updated = await app.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.updateMany({
        where: {
          organizationId: context.organizationId,
          userId: context.userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.password_update",
          entityType: "User",
          entityId: context.userId,
          data: { updatedAt: now.toISOString(), otherSessionsRevoked: true },
          requestId: request.id,
        },
      });
      return nextUser;
    });
    passwordFailureLimiter.clear(bucketKey);
    return { requestId: request.id, user: sanitizeUserDto(updated), currentSessionKept: Boolean(currentTokenHash), otherSessionsRevoked: true };
  });
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
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
