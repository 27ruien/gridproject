import { apiRequest } from "./client";
import type { IssuePayload, MilestonePayload, PageEnvelope, ProjectMemberPayload, ProjectPayload } from "./types";
import type { Issue, Milestone, Project, ProjectMember } from "@/types/domain";

export const projectsApi = {
  list: (query: Record<string, string | number> = {}) => apiRequest<PageEnvelope<Project>>("/projects", { query }),
  create: (input: Partial<Project>) => apiRequest<ProjectPayload>("/projects", { method: "POST", body: input }),
  update: (projectId: string, patch: Partial<Project>) => apiRequest<ProjectPayload>(`/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: patch }),
  delete: (projectId: string) => apiRequest<ProjectPayload>(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" }),
  board: (projectId: string) => apiRequest<{
    project: Project;
    issues: Issue[];
    timeEntries: unknown[];
    members: ProjectMember[];
    milestones: Milestone[];
  }>(`/projects/${encodeURIComponent(projectId)}/board`),
  members: {
    list: (projectId: string) => apiRequest<PageEnvelope<ProjectMember>>(`/projects/${encodeURIComponent(projectId)}/members`),
    create: (projectId: string, input: { userId: string }) =>
      apiRequest<ProjectMemberPayload>(`/projects/${encodeURIComponent(projectId)}/members`, { method: "POST", body: input }),
    update: (projectId: string, memberId: string, patch: Partial<ProjectMember>) =>
      apiRequest<ProjectMemberPayload>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body: patch }),
    delete: (projectId: string, memberId: string) =>
      apiRequest<ProjectMemberPayload>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" }),
  },
  milestones: {
    update: (milestoneId: string, patch: Partial<Milestone>) =>
      apiRequest<MilestonePayload>(`/milestones/${encodeURIComponent(milestoneId)}`, { method: "PATCH", body: patch }),
  },
  issues: {
    create: (projectId: string, input: Partial<Issue>) =>
      apiRequest<IssuePayload>(`/projects/${encodeURIComponent(projectId)}/issues`, { method: "POST", body: input }),
  },
};
