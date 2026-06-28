import { apiRequest } from "./client";
import type { CommentPayload, IssuePayload } from "./types";
import type { Issue } from "@/types/domain";

export const tasksApi = {
  detail: (issueId: string) => apiRequest<IssuePayload>(`/issues/${encodeURIComponent(issueId)}`),
  update: (issueId: string, patch: Partial<Issue>) => apiRequest<IssuePayload>(`/issues/${encodeURIComponent(issueId)}`, { method: "PATCH", body: patch }),
  delete: (issueId: string) => apiRequest<IssuePayload>(`/issues/${encodeURIComponent(issueId)}`, { method: "DELETE" }),
  comments: {
    create: (issueId: string, input: { text: string }) => apiRequest<CommentPayload>(`/issues/${encodeURIComponent(issueId)}/comments`, { method: "POST", body: input }),
  },
};
