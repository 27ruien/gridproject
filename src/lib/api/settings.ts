import { apiRequest } from "./client";
import type { SettingsPayload, TrashPayload } from "./types";
import type { PlatformSettings } from "@/types/domain";

export const settingsApi = {
  get: () => apiRequest<SettingsPayload>("/settings"),
  update: (patch: Partial<PlatformSettings>) => apiRequest<SettingsPayload>("/settings", { method: "PATCH", body: patch }),
  trash: {
    list: () => apiRequest<TrashPayload>("/trash"),
    restore: (type: string, id: string) => apiRequest<{ type: string; entity: unknown }>(`/trash/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, { method: "POST" }),
  },
};
