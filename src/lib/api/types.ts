import type { AppState, CostRecord, Issue, IssueComment, Milestone, Organization, PlatformSettings, Project, ProjectMember, TimeEntry, TrashItem, User } from "@/types/domain";

export type BootstrapPayload = AppState & {
  currentUser?: User;
};

export type MePayload = {
  user: User;
  organization: Organization;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type PageEnvelope<T> = {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProjectPayload = { project: Project };
export type IssuePayload = { issue: Issue };
export type CommentPayload = { comment: IssueComment };
export type MilestonePayload = { milestone: Milestone };
export type TimeEntryPayload = { entry: TimeEntry };
export type CostRecordPayload = { record: CostRecord };
export type UserPayload = { user: User };
export type ProjectMemberPayload = { member: ProjectMember };
export type SettingsPayload = { settings: PlatformSettings };
export type TrashPayload = PageEnvelope<TrashItem>;
