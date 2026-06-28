import { apiBasePath, viteEnv } from "./appEnvironment.js";

const unauthorizedHandlers = new Set();

export function isApiDataSource(env = viteEnv()) {
  return String(env.VITE_DATA_SOURCE || "local").toLowerCase() === "api";
}

export function apiBaseUrl(env) {
  return apiBasePath(env);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error?.message || "API 请求失败。");
    error.status = response.status;
    error.payload = payload;
    if (response.status === 401) unauthorizedHandlers.forEach((handler) => handler(error));
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response;
}

export const apiClient = {
  onUnauthorized(handler) {
    unauthorizedHandlers.add(handler);
    return () => unauthorizedHandlers.delete(handler);
  },
  bootstrap() {
    return request("/bootstrap");
  },
  me() {
    return request("/auth/me");
  },
  login(input) {
    return request("/auth/login", { method: "POST", body: input });
  },
  logout() {
    return request("/auth/logout", { method: "POST" });
  },
  updateProfile(input) {
    return request("/auth/profile", { method: "PATCH", body: input });
  },
  updatePreferences(input) {
    return request("/auth/preferences", { method: "PATCH", body: input });
  },
  updatePassword(input) {
    return request("/auth/password", { method: "PATCH", body: input });
  },
  users: {
    list(query = "") {
      return request(`/users${query}`);
    },
    create(input) {
      return request("/users", { method: "POST", body: input });
    },
    update(userId, patch) {
      return request(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: patch });
    },
    delete(userId) {
      return request(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    },
    restore(userId) {
      return request(`/users/${encodeURIComponent(userId)}/restore`, { method: "POST" });
    },
    resetPassword(userId, input) {
      return request(`/users/${encodeURIComponent(userId)}/reset-password`, { method: "POST", body: input });
    },
  },
  projects: {
    list(query = "") {
      return request(`/projects${query}`);
    },
    create(input) {
      return request("/projects", { method: "POST", body: input });
    },
    update(projectId, patch) {
      return request(`/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: patch });
    },
    delete(projectId) {
      return request(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
    },
    board(projectId) {
      return request(`/projects/${encodeURIComponent(projectId)}/board`);
    },
  },
  projectMembers: {
    list(projectId) {
      return request(`/projects/${encodeURIComponent(projectId)}/members`);
    },
    create(projectId, input) {
      return request(`/projects/${encodeURIComponent(projectId)}/members`, { method: "POST", body: input });
    },
    update(projectId, memberId, patch) {
      return request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body: patch });
    },
    delete(projectId, memberId) {
      return request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
    },
  },
  issues: {
    list(projectId, query = "") {
      return request(`/projects/${encodeURIComponent(projectId)}/issues${query}`);
    },
    create(projectId, input) {
      return request(`/projects/${encodeURIComponent(projectId)}/issues`, { method: "POST", body: input });
    },
    detail(issueId) {
      return request(`/issues/${encodeURIComponent(issueId)}`);
    },
    update(issueId, patch) {
      return request(`/issues/${encodeURIComponent(issueId)}`, { method: "PATCH", body: patch });
    },
    delete(issueId) {
      return request(`/issues/${encodeURIComponent(issueId)}`, { method: "DELETE" });
    },
    restore(issueId) {
      return request(`/issues/${encodeURIComponent(issueId)}/restore`, { method: "POST" });
    },
  },
  issueComments: {
    list(issueId) {
      return request(`/issues/${encodeURIComponent(issueId)}/comments`);
    },
    create(issueId, input) {
      return request(`/issues/${encodeURIComponent(issueId)}/comments`, { method: "POST", body: input });
    },
    update(commentId, patch) {
      return request(`/comments/${encodeURIComponent(commentId)}`, { method: "PATCH", body: patch });
    },
    delete(commentId) {
      return request(`/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
    },
  },
  milestones: {
    list(projectId) {
      return request(`/projects/${encodeURIComponent(projectId)}/milestones`);
    },
    create(projectId, input) {
      return request(`/projects/${encodeURIComponent(projectId)}/milestones`, { method: "POST", body: input });
    },
    update(milestoneId, patch) {
      return request(`/milestones/${encodeURIComponent(milestoneId)}`, { method: "PATCH", body: patch });
    },
    delete(milestoneId) {
      return request(`/milestones/${encodeURIComponent(milestoneId)}`, { method: "DELETE" });
    },
    restore(milestoneId) {
      return request(`/milestones/${encodeURIComponent(milestoneId)}/restore`, { method: "POST" });
    },
  },
  settings: {
    get() {
      return request("/settings");
    },
    update(patch) {
      return request("/settings", { method: "PATCH", body: patch });
    },
  },
  trash: {
    list() {
      return request("/trash");
    },
    restore(type, id) {
      return request(`/trash/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, { method: "POST" });
    },
  },
  timeEntries: {
    list(query = "") {
      return request(`/time-entries${query}`);
    },
    create(input) {
      return request("/time-entries", { method: "POST", body: input });
    },
    update(entryId, patch) {
      return request(`/time-entries/${encodeURIComponent(entryId)}`, { method: "PATCH", body: patch });
    },
    move(entryId, input) {
      return request(`/time-entries/${encodeURIComponent(entryId)}/move`, { method: "POST", body: input });
    },
    delete(entryId, input) {
      return request(`/time-entries/${encodeURIComponent(entryId)}`, { method: "DELETE", ...(input ? { body: input } : {}) });
    },
    submit(entryId) {
      return request(`/time-entries/${encodeURIComponent(entryId)}/submit`, { method: "POST" });
    },
    approve(entryId, correctionReason = "") {
      return request(`/time-entries/${encodeURIComponent(entryId)}/approve`, { method: "POST", ...(correctionReason ? { body: { correctionReason } } : {}) });
    },
    reject(entryId, correctionReason = "") {
      return request(`/time-entries/${encodeURIComponent(entryId)}/reject`, { method: "POST", body: { correctionReason } });
    },
  },
  costRecords: {
    list(query = "") {
      return request(`/cost-records${query}`);
    },
    create(input) {
      return request("/cost-records", { method: "POST", body: input });
    },
    update(recordId, patch) {
      return request(`/cost-records/${encodeURIComponent(recordId)}`, { method: "PATCH", body: patch });
    },
    delete(recordId) {
      return request(`/cost-records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
    },
    restore(recordId) {
      return request(`/cost-records/${encodeURIComponent(recordId)}/restore`, { method: "POST" });
    },
    summary(recordId, query = "") {
      return request(`/cost-records/${encodeURIComponent(recordId)}/summary${query}`);
    },
    rawData(recordId, query = "") {
      return request(`/cost-records/${encodeURIComponent(recordId)}/raw-data${query}`);
    },
    export(recordId, query = "") {
      return request(`/cost-records/${encodeURIComponent(recordId)}/export${query}`);
    },
  },
};
