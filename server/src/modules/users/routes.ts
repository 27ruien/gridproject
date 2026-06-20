import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserRepository } from "../../repositories/users.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../policies/access.js";
import { pageEnvelope, pagination, sanitizeUserDto } from "../../utils/dto.js";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors.js";
import { hashPassword, validatePassword } from "../../utils/password.js";

const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  initialPassword: z.string().min(1),
  confirmInitialPassword: z.string().min(1),
});

const userPatchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().optional(),
  password: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireUserAdmin(request);
    const query = request.query as Record<string, string | undefined>;
    const { page, pageSize, skip, take } = pagination(query);
    const where = {
      organizationId: context.organizationId,
      ...(query.role ? { role: query.role as "ADMIN" | "MEMBER" } : {}),
      ...(query.status ? { status: query.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { email: { contains: query.search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const orderBy = sortUser(query.sort);
    const [rows, totalCount] = await Promise.all([
      app.prisma.user.findMany({ where, orderBy, skip, take }),
      app.prisma.user.count({ where }),
    ]);
    const repository = new UserRepository(app.prisma);
    const users = await Promise.all(rows.map(async (user) => ({
      ...sanitizeUserDto(user),
      stats: await repository.stats(user.id, context.organizationId),
    })));
    return { requestId: request.id, ...pageEnvelope(users, totalCount, page, pageSize) };
  });

  app.post("/", async (request, reply) => {
    const context = requireUserAdmin(request);
    const parsed = userCreateSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("人员参数不正确。", parsed.error.flatten());
    if (parsed.data.initialPassword !== parsed.data.confirmInitialPassword) throw badRequest("确认初始密码必须一致。");
    const passwordErrors = validatePassword(parsed.data.initialPassword);
    if (passwordErrors.length) throw badRequest(passwordErrors.join(""));

    const email = parsed.data.email.trim().toLowerCase();
    await assertEmailAvailable(app, context.organizationId, email);
    const passwordHash = await hashPassword(parsed.data.initialPassword);

    const user = await app.prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: {
          organizationId: context.organizationId,
          name: parsed.data.name.trim(),
          email,
          passwordHash,
          role: parsed.data.role,
          status: parsed.data.status,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.create",
          entityType: "User",
          entityId: row.id,
          data: { name: row.name, email: row.email, role: row.role, status: row.status },
          requestId: request.id,
        },
      });
      return row;
    });
    reply.status(201);
    return { requestId: request.id, user: sanitizeUserDto(user) };
  });

  app.get("/:id", async (request) => {
    const context = requireUserAdmin(request);
    const { id } = request.params as { id: string };
    const user = await getScopedUser(app, context.organizationId, id);
    const repository = new UserRepository(app.prisma);
    return {
      requestId: request.id,
      user: {
        ...sanitizeUserDto(user),
        stats: await repository.stats(user.id, context.organizationId),
      },
    };
  });

  app.patch("/:id", async (request) => {
    const context = requireUserAdmin(request);
    const { id } = request.params as { id: string };
    const user = await getScopedUser(app, context.organizationId, id);
    const parsed = userPatchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("人员参数不正确。", parsed.error.flatten());

    const patch = parsed.data;
    const nextEmail = patch.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== user.email) await assertEmailAvailable(app, context.organizationId, nextEmail, user.id);

    await guardUserMutation(app, context.organizationId, context.userId, user, patch);
    const updated = await app.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: patch.name.trim() } : {}),
          ...(nextEmail ? { email: nextEmail } : {}),
          ...(patch.status === "ACTIVE" ? { deletedAt: null, deletedById: null } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.update",
          entityType: "User",
          entityId: row.id,
          data: { before: userSnapshot(user), after: userSnapshot(row) },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, user: sanitizeUserDto(updated) };
  });

  app.delete("/:id", async (request) => {
    const context = requireUserAdmin(request);
    const { id } = request.params as { id: string };
    const user = await getScopedUser(app, context.organizationId, id);
    await guardUserMutation(app, context.organizationId, context.userId, user, { status: "INACTIVE" });
    const updated = await app.prisma.$transaction(async (tx) => {
      const now = new Date();
      const row = await tx.user.update({
        where: { id },
        data: {
          status: "INACTIVE",
          deletedAt: now,
          deletedById: context.userId,
        },
      });
      await tx.session.updateMany({
        where: { organizationId: context.organizationId, userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.delete",
          entityType: "User",
          entityId: id,
          data: { deletedAt: row.deletedAt?.toISOString() },
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, user: sanitizeUserDto(updated) };
  });

  app.post("/:id/restore", async (request) => {
    const context = requireUserAdmin(request);
    const { id } = request.params as { id: string };
    await getScopedUser(app, context.organizationId, id);
    const user = await app.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: { status: "ACTIVE", deletedAt: null, deletedById: null },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.restore",
          entityType: "User",
          entityId: id,
          data: {},
          requestId: request.id,
        },
      });
      return row;
    });
    return { requestId: request.id, user: sanitizeUserDto(user) };
  });

  app.post("/:id/reset-password", async (request) => {
    const context = requireUserAdmin(request);
    const { id } = request.params as { id: string };
    const user = await getScopedUser(app, context.organizationId, id);
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("密码参数不正确。", parsed.error.flatten());
    const password = parsed.data.newPassword || parsed.data.password || "";
    const confirmPassword = parsed.data.confirmNewPassword || parsed.data.confirmPassword || "";
    if (password !== confirmPassword) throw badRequest("确认密码必须一致。");
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) throw badRequest(passwordErrors.join(""));
    const passwordHash = await hashPassword(password);
    const updated = await app.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { organizationId: context.organizationId, userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: context.userId,
          action: "user.reset_password",
          entityType: "User",
          entityId: id,
          data: { resetAt: new Date().toISOString() },
          requestId: request.id,
        },
      });
      return nextUser;
    });
    return { requestId: request.id, user: sanitizeUserDto(updated) };
  });
}

function requireUserAdmin(request: any) {
  const context = requireAuth(request);
  if (!requireAdmin(context)) throw forbidden("没有权限管理人员。");
  return context;
}

async function getScopedUser(app: FastifyInstance, organizationId: string, id: string) {
  const user = await app.prisma.user.findFirst({ where: { id, organizationId } });
  if (!user) throw notFound("人员不存在。");
  return user;
}

async function assertEmailAvailable(app: FastifyInstance, organizationId: string, email: string, exceptUserId?: string) {
  const duplicate = await app.prisma.user.findFirst({
    where: {
      organizationId,
      email,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
  });
  if (duplicate) throw conflict("同一组织下邮箱必须唯一。");
}

async function guardUserMutation(app: FastifyInstance, organizationId: string, currentUserId: string, user: any, patch: { role?: string; status?: string }) {
  if (user.id === currentUserId && patch.status === "INACTIVE") {
    throw badRequest("禁止停用或删除自己当前正在使用的账号。");
  }

  const removesActiveAdmin = user.role === "ADMIN" && user.status === "ACTIVE" && (patch.role === "MEMBER" || patch.status === "INACTIVE");
  if (removesActiveAdmin) {
    const remainingAdmins = await app.prisma.user.count({
      where: {
        organizationId,
        id: { not: user.id },
        role: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!remainingAdmins) throw badRequest("系统必须始终至少保留一名 ACTIVE ADMIN。");
  }

  if (patch.status === "INACTIVE") {
    const ownedProjects = await app.prisma.project.findMany({
      where: { organizationId, ownerId: user.id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (ownedProjects.length) throw conflict("该用户仍是项目 Owner，请先转移所有负责项目。", { projects: ownedProjects });
  }
}

function sortUser(sort = "updatedAt:desc") {
  if (sort === "name:asc") return { name: "asc" as const };
  if (sort === "role:asc") return { role: "asc" as const };
  if (sort === "createdAt:desc") return { createdAt: "desc" as const };
  return { updatedAt: "desc" as const };
}

function userSnapshot(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    deletedAt: user.deletedAt,
  };
}
