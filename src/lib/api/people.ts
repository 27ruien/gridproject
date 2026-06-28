import { apiRequest } from "./client";
import type { PageEnvelope, UserPayload } from "./types";
import type { User } from "@/types/domain";

export const peopleApi = {
  list: (query: Record<string, string | number> = {}) => apiRequest<PageEnvelope<User>>("/users", { query }),
  create: (input: { name: string; email: string; role: string; initialPassword: string; confirmInitialPassword: string }) =>
    apiRequest<UserPayload>("/users", { method: "POST", body: input }),
  update: (userId: string, patch: Partial<User>) => apiRequest<UserPayload>(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: patch }),
  delete: (userId: string) => apiRequest<UserPayload>(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  resetPassword: (userId: string, input: { newPassword: string; confirmNewPassword: string }) =>
    apiRequest<UserPayload>(`/users/${encodeURIComponent(userId)}/reset-password`, { method: "POST", body: input }),
};
