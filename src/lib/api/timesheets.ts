import { apiRequest } from "./client";
import type { PageEnvelope, TimeEntryPayload } from "./types";
import type { TimeEntry } from "@/types/domain";

export const timesheetsApi = {
  list: (query: Record<string, string | number> = {}) => apiRequest<PageEnvelope<TimeEntry>>("/time-entries", { query }),
  create: (input: Partial<TimeEntry>) => apiRequest<TimeEntryPayload>("/time-entries", { method: "POST", body: input }),
  update: (entryId: string, patch: Partial<TimeEntry>) => apiRequest<TimeEntryPayload>(`/time-entries/${encodeURIComponent(entryId)}`, { method: "PATCH", body: patch }),
  delete: (entryId: string, correctionReason = "") => apiRequest<TimeEntryPayload>(`/time-entries/${encodeURIComponent(entryId)}`, { method: "DELETE", body: correctionReason ? { correctionReason } : undefined }),
  submit: (entryId: string) => apiRequest<TimeEntryPayload>(`/time-entries/${encodeURIComponent(entryId)}/submit`, { method: "POST" }),
  approve: (entryId: string, comment = "") => apiRequest<TimeEntryPayload>(`/time-entries/${encodeURIComponent(entryId)}/approve`, { method: "POST", body: comment ? { correctionReason: comment } : undefined }),
  reject: (entryId: string, correctionReason = "") => apiRequest<TimeEntryPayload>(`/time-entries/${encodeURIComponent(entryId)}/reject`, { method: "POST", body: { correctionReason } }),
};
