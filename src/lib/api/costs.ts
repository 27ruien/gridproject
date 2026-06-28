import { apiRequest } from "./client";
import type { CostRecordPayload, PageEnvelope } from "./types";
import type { CostRecord } from "@/types/domain";

export const costsApi = {
  list: (query: Record<string, string | number> = {}) => apiRequest<PageEnvelope<CostRecord>>("/cost-records", { query }),
  create: (input: Partial<CostRecord>) => apiRequest<CostRecordPayload>("/cost-records", { method: "POST", body: input }),
  update: (recordId: string, patch: Partial<CostRecord>) => apiRequest<CostRecordPayload>(`/cost-records/${encodeURIComponent(recordId)}`, { method: "PATCH", body: patch }),
  delete: (recordId: string) => apiRequest<CostRecordPayload>(`/cost-records/${encodeURIComponent(recordId)}`, { method: "DELETE" }),
  export: (recordId: string, query: Record<string, string | number> = {}) => apiRequest<Response>(`/cost-records/${encodeURIComponent(recordId)}/export`, { query }),
};
