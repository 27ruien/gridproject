import { apiRequest } from "./client";
import type { BootstrapPayload, LoginInput, MePayload, UserPayload } from "./types";
import type { Preferences } from "@/types/domain";

export const authApi = {
  me: () => apiRequest<MePayload>("/auth/me"),
  bootstrap: () => apiRequest<BootstrapPayload>("/bootstrap"),
  login: (input: LoginInput) => apiRequest<UserPayload>("/auth/login", { method: "POST", body: input }),
  logout: () => apiRequest<{ ok: true }>("/auth/logout", { method: "POST" }),
  updateProfile: (input: { name: string; avatarColor?: string }) => apiRequest<UserPayload>("/auth/profile", { method: "PATCH", body: input }),
  updatePreferences: (input: Preferences) => apiRequest<UserPayload>("/auth/preferences", { method: "PATCH", body: input }),
  updatePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    apiRequest<UserPayload>("/auth/password", { method: "PATCH", body: input }),
};
