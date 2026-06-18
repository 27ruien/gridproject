import { ORGANIZATION_ROLES, USER_STATUS } from "../domain/access.js";
import { UserAccessPolicy } from "../server/policies/userAccessPolicy.js";
import { hashPasswordArgon2id, isPasswordHash, validatePassword } from "./passwordService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const userService = {
  listUsers({ context, users, projects = [], projectMembers = [], timeEntries = [], search = "", role = "", status = "", page = 1, pageSize = 10, sort = "updatedAt:desc" }) {
    if (!UserAccessPolicy.canViewUsers(context)) return forbidden("没有权限查看人员列表。");
    const keyword = search.trim().toLowerCase();
    const rows = users
      .filter((user) => user.organizationId === context.organizationId)
      .filter((user) => !role || user.role === role)
      .filter((user) => !status || user.status === status)
      .filter((user) => !keyword || `${user.name}${user.email}`.toLowerCase().includes(keyword))
      .map((user) => ({
        ...sanitizeUser(user),
        stats: getUserStats(user.id, { projects, projectMembers, timeEntries }),
      }));

    const sorted = sortUsers(rows, sort);
    const currentPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Number(pageSize) || 10);
    const start = (currentPage - 1) * normalizedPageSize;
    return {
      ok: true,
      rows: sorted.slice(start, start + normalizedPageSize),
      totalCount: sorted.length,
      page: currentPage,
      pageSize: normalizedPageSize,
      totalPages: Math.max(1, Math.ceil(sorted.length / normalizedPageSize)),
    };
  },

  getUser({ context, user, projects = [], projectMembers = [], timeEntries = [] }) {
    if (!UserAccessPolicy.canViewUsers(context)) return forbidden("没有权限查看人员详情。");
    if (!user || user.organizationId !== context.organizationId) return notFound();
    return {
      ok: true,
      user: {
        ...sanitizeUser(user),
        stats: getUserStats(user.id, { projects, projectMembers, timeEntries }),
      },
    };
  },

  async createUser({ context, input, users, now = new Date().toISOString() }) {
    if (!UserAccessPolicy.canCreateUser(context)) return forbidden("没有权限新增人员。");
    const validation = validateUserInput(input, users, context.organizationId);
    if (!validation.ok) return validation;

    const passwordErrors = validatePassword(input.initialPassword);
    if (passwordErrors.length) return invalid(passwordErrors.join(""));
    if (input.initialPassword !== input.confirmInitialPassword) return invalid("确认初始密码必须一致。");

    const passwordHash = await hashPasswordArgon2id(input.initialPassword);
    const user = {
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: context.organizationId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      role: normalizeRole(input.role),
      status: normalizeStatus(input.status),
      lastLoginAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: now,
      updatedAt: now,
    };

    return {
      ok: true,
      user: sanitizeUser(user),
      persistedUser: user,
      auditLog: createAuditLog(context, "user.create", user.id, { name: user.name, email: user.email, role: user.role, status: user.status }),
    };
  },

  updateUser({ context, user, patch, users, projects = [], now = new Date().toISOString() }) {
    if (!UserAccessPolicy.canUpdateUser(context)) return forbidden("没有权限编辑人员。");
    if (!user || user.organizationId !== context.organizationId) return notFound();

    const nextUser = {
      ...user,
      name: patch.name !== undefined ? String(patch.name).trim() : user.name,
      email: patch.email !== undefined ? String(patch.email).trim().toLowerCase() : user.email,
      role: patch.role !== undefined ? normalizeRole(patch.role) : user.role,
      status: patch.status !== undefined ? normalizeStatus(patch.status) : user.status,
      updatedAt: now,
    };

    if (!nextUser.name) return invalid("姓名必填。");
    if (!EMAIL_PATTERN.test(nextUser.email)) return invalid("邮箱格式不正确。");
    if (users.some((item) => item.organizationId === context.organizationId && item.id !== user.id && item.email.toLowerCase() === nextUser.email)) {
      return conflict("同一组织下邮箱必须唯一。");
    }

    const guard = guardUserStateChange({ context, before: user, after: nextUser, users, projects });
    if (!guard.ok) return guard;

    if (nextUser.status === USER_STATUS.ACTIVE) {
      nextUser.deletedAt = null;
      nextUser.deletedById = null;
    }

    return {
      ok: true,
      user: sanitizeUser(nextUser),
      persistedUser: nextUser,
      auditLog: createAuditLog(context, "user.update", user.id, {
        before: auditUserSnapshot(user),
        after: auditUserSnapshot(nextUser),
      }),
    };
  },

  deleteUser({ context, user, users, projects = [], now = new Date().toISOString() }) {
    if (!UserAccessPolicy.canDeleteUser(context)) return forbidden("没有权限删除人员。");
    if (!user || user.organizationId !== context.organizationId) return notFound();

    const nextUser = {
      ...user,
      status: USER_STATUS.INACTIVE,
      deletedAt: now,
      deletedById: context.userId,
      updatedAt: now,
    };
    const guard = guardUserStateChange({ context, before: user, after: nextUser, users, projects });
    if (!guard.ok) return guard;

    return {
      ok: true,
      user: sanitizeUser(nextUser),
      persistedUser: nextUser,
      auditLog: createAuditLog(context, "user.delete", user.id, { deletedAt: now }),
    };
  },

  async resetPassword({ context, user, input, sessions = [], now = new Date().toISOString() }) {
    if (!UserAccessPolicy.canResetPassword(context)) return forbidden("没有权限重置密码。");
    if (!user || user.organizationId !== context.organizationId) return notFound();
    const password = input.newPassword || input.password || "";
    const confirmPassword = input.confirmNewPassword || input.confirmPassword || "";
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) return invalid(passwordErrors.join(""));
    if (password !== confirmPassword) return invalid("确认密码必须一致。");

    const passwordHash = await hashPasswordArgon2id(password);
    const nextUser = {
      ...user,
      passwordHash,
      updatedAt: now,
    };
    const nextSessions = sessions.map((session) => (
      session.organizationId === context.organizationId && session.userId === user.id && !session.revokedAt
        ? { ...session, revokedAt: now }
        : session
    ));

    return {
      ok: true,
      user: sanitizeUser(nextUser),
      persistedUser: nextUser,
      sessions: nextSessions,
      auditLog: createAuditLog(context, "user.reset_password", user.id, { resetAt: now }),
    };
  },
};

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function canUserLogin(user) {
  return Boolean(user && user.status === USER_STATUS.ACTIVE && !user.deletedAt && isPasswordHash(user.passwordHash));
}

export function getUserStats(userId, { projects = [], projectMembers = [], timeEntries = [] }) {
  const ownerProjects = projects.filter((project) => project.ownerId === userId && !project.deletedAt);
  const participantProjectIds = new Set(projectMembers
    .filter((member) => member.userId === userId && member.status === "ACTIVE")
    .map((member) => member.projectId));
  const userTimeEntries = timeEntries.filter((entry) => entry.userId === userId && !entry.deletedAt);
  const totalHours = userTimeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const lastTimeEntryAt = userTimeEntries
    .map((entry) => entry.workDate || entry.spentDate || entry.createdAt || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";

  return {
    ownerProjectCount: ownerProjects.length,
    participantProjectCount: participantProjectIds.size,
    ownerProjects,
    participantProjects: projects.filter((project) => participantProjectIds.has(project.id) && !project.deletedAt),
    totalHours: Number(totalHours.toFixed(1)),
    lastTimeEntryAt,
  };
}

function validateUserInput(input, users, organizationId) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) return invalid("姓名必填。");
  if (!EMAIL_PATTERN.test(email || "")) return invalid("邮箱格式不正确。");
  if (users.some((user) => user.organizationId === organizationId && user.email.toLowerCase() === email)) {
    return conflict("同一组织下邮箱必须唯一。");
  }
  return { ok: true };
}

function guardUserStateChange({ context, before, after, users, projects }) {
  if (before.id === context.userId && after.status === USER_STATUS.INACTIVE) {
    return invalid("禁止停用或删除自己当前正在使用的账号。");
  }

  const removesActiveAdmin = before.role === ORGANIZATION_ROLES.ADMIN &&
    before.status === USER_STATUS.ACTIVE &&
    (after.role !== ORGANIZATION_ROLES.ADMIN || after.status !== USER_STATUS.ACTIVE);
  if (removesActiveAdmin) {
    const remaining = users.filter((user) => (
      user.organizationId === context.organizationId &&
      user.id !== before.id &&
      user.role === ORGANIZATION_ROLES.ADMIN &&
      user.status === USER_STATUS.ACTIVE &&
      !user.deletedAt
    ));
    if (!remaining.length) return invalid("系统必须始终至少保留一名 ACTIVE ADMIN。");
  }

  if (after.status === USER_STATUS.INACTIVE) {
    const ownedProjects = projects.filter((project) => project.organizationId === context.organizationId && project.ownerId === before.id && !project.deletedAt);
    if (ownedProjects.length) {
      return {
        ok: false,
        status: 409,
        reason: "owner-transfer-required",
        message: "该用户仍是项目 Owner，请先转移所有负责项目。",
        projects: ownedProjects.map((project) => ({ id: project.id, code: project.code, name: project.name })),
      };
    }
  }

  return { ok: true };
}

function sortUsers(rows, sort) {
  if (sort === "name:asc") return [...rows].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (sort === "role:asc") return [...rows].sort((a, b) => a.role.localeCompare(b.role));
  if (sort === "createdAt:desc") return [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function normalizeRole(role) {
  return role === ORGANIZATION_ROLES.ADMIN ? ORGANIZATION_ROLES.ADMIN : ORGANIZATION_ROLES.MEMBER;
}

function normalizeStatus(status) {
  return status === USER_STATUS.INACTIVE ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE;
}

function auditUserSnapshot(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    deletedAt: user.deletedAt || null,
  };
}

function createAuditLog(context, action, entityId, data) {
  return {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: context.organizationId,
    actorId: context.userId,
    action,
    entityType: "User",
    entityId,
    data,
    createdAt: new Date().toISOString(),
  };
}

function forbidden(message) {
  return { ok: false, status: 403, reason: "forbidden", message };
}

function notFound() {
  return { ok: false, status: 404, reason: "not-found", message: "人员不存在。" };
}

function invalid(message) {
  return { ok: false, status: 400, reason: "invalid", message };
}

function conflict(message) {
  return { ok: false, status: 409, reason: "conflict", message };
}
