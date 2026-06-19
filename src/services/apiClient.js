const DEFAULT_API_BASE_URL = "/api";
const unauthorizedHandlers = new Set();

export function isApiDataSource() {
  return String(import.meta.env.VITE_DATA_SOURCE || "local").toLowerCase() === "api";
}

export function apiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
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
    delete(entryId, input) {
      return request(`/time-entries/${encodeURIComponent(entryId)}`, { method: "DELETE", ...(input ? { body: input } : {}) });
    },
    submit(entryId) {
      return request(`/time-entries/${encodeURIComponent(entryId)}/submit`, { method: "POST" });
    },
    approve(entryId) {
      return request(`/time-entries/${encodeURIComponent(entryId)}/approve`, { method: "POST" });
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
