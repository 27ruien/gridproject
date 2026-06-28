import { apiRequest } from "./client";
import type { AppState, TrashItem } from "@/types/domain";

export const trashApi = {
  list(signal?: AbortSignal) {
    return apiRequest<{ trash: TrashItem[] }>("/trash", { signal });
  },
  restore(type: TrashItem["type"], id: string) {
    return apiRequest<Partial<AppState>>(`/trash/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, { method: "POST" });
  },
};
