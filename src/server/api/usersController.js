import { buildAccessContext } from "../../domain/access.js";
import { sanitizeUser, userService } from "../../services/userService.js";

export function createUsersController(repository) {
  return {
    async list(request) {
      const { context, requestId } = requireContext(request);
      const result = userService.listUsers({
        context,
        users: repository.users,
        projects: repository.projects,
        projectMembers: repository.projectMembers,
        timeEntries: repository.timeEntries,
        search: request.query.search || "",
        role: request.query.role || "",
        status: request.query.status || "",
        page: Number(request.query.page || 1),
        pageSize: Number(request.query.pageSize || 10),
        sort: request.query.sort || "updatedAt:desc",
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      return ok({ requestId, ...result });
    },

    async create(request) {
      const { context, requestId } = requireContext(request);
      const result = await userService.createUser({
        context,
        input: request.body,
        users: repository.users,
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      repository.users.push(result.persistedUser);
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, user: result.user }, 201);
    },

    async get(request) {
      const { context, requestId } = requireContext(request);
      const user = getUser(repository, request.params.id, context);
      const result = userService.getUser({
        context,
        user,
        projects: repository.projects,
        projectMembers: repository.projectMembers,
        timeEntries: repository.timeEntries,
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      return ok({ requestId, user: result.user });
    },

    async patch(request) {
      const { context, requestId } = requireContext(request);
      const user = getUser(repository, request.params.id, context);
      const result = userService.updateUser({
        context,
        user,
        patch: request.body,
        users: repository.users,
        projects: repository.projects,
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      replaceById(repository.users, result.persistedUser);
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, user: result.user });
    },

    async delete(request) {
      const { context, requestId } = requireContext(request);
      const user = getUser(repository, request.params.id, context);
      const result = userService.deleteUser({
        context,
        user,
        users: repository.users,
        projects: repository.projects,
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      replaceById(repository.users, result.persistedUser);
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, user: result.user });
    },

    async resetPassword(request) {
      const { context, requestId } = requireContext(request);
      const user = getUser(repository, request.params.id, context);
      const result = await userService.resetPassword({
        context,
        user,
        input: request.body,
        sessions: repository.sessions,
      });
      if (!result.ok) return error(result.status, result.message, requestId, result);
      replaceById(repository.users, result.persistedUser);
      repository.sessions = result.sessions;
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, user: sanitizeUser(result.persistedUser) });
    },
  };
}

function requireContext(request) {
  const user = request.user;
  const context = request.context || buildAccessContext(user, user.organizationId);
  request.context = context;
  return {
    context,
    requestId: request.requestId || cryptoRandomId(),
  };
}

function getUser(repository, id, context) {
  return repository.users.find((user) => user.id === id && user.organizationId === context.organizationId) || null;
}

function replaceById(list, nextItem) {
  const index = list.findIndex((item) => item.id === nextItem.id);
  if (index >= 0) list.splice(index, 1, nextItem);
}

function ok(body, status = 200) {
  return { status, body };
}

function error(status, message, requestId, result = {}) {
  return {
    status,
    body: {
      requestId,
      error: {
        code: status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : "REQUEST_ERROR",
        message,
        reason: result.reason,
        projects: result.projects,
      },
    },
  };
}

function cryptoRandomId() {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
