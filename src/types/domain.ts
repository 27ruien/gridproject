export type OrganizationRole = "ADMIN" | "MEMBER";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type ProjectMemberStatus = "ACTIVE" | "INACTIVE";
export type ProjectMemberRole = "MANAGER" | "MEMBER" | "VIEWER";
export type TimeEntryStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "草稿" | "已提交" | "已审批" | "已驳回";
export type CostRecordStatus = "ACTIVE" | "ARCHIVED";

export type TimeEntryAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "image" | "file";
  dataUrl: string;
  createdAt?: string | null;
};

export type Preferences = {
  density: "compact" | "comfortable";
  dateFormat: "yyyy-mm-dd" | "mm-dd-yyyy" | "dd-mm-yyyy";
  weekStart: "monday" | "sunday";
  defaultNav: "expanded" | "collapsed" | "auto";
  homeDueRange: "all" | "mine" | "others";
  avatarColor?: string;
  avatarUrl?: string;
};

export type User = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  status: UserStatus;
  preferences?: Partial<Preferences>;
  lastLoginAt?: string | null;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  stats?: UserStats;
};

export type Organization = {
  id: string;
  name: string;
  settings?: PlatformSettings;
};

export type PlatformSettings = {
  platformName: string;
  logoText: string;
  logoUrl?: string;
};

export type ProjectTemplateId = "agile" | "waterfall";

export type Milestone = {
  id?: string;
  name: string;
  title?: string;
  window?: string;
  focus?: string;
  status: string;
  dueDate?: string;
  completedAt?: string | null;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  coverUrl?: string;
  templateId: ProjectTemplateId;
  ownerId: string;
  owner?: string;
  createdById?: string;
  commercialOwnerId?: string | null;
  projectManagerId?: string | null;
  designGroupId?: string | null;
  contentGroupId?: string | null;
  effectsGroupId?: string | null;
  qaId?: string | null;
  status: string;
  executionTeams: string[];
  startDate?: string;
  dueDate?: string;
  testDate?: string;
  acceptanceDate?: string;
  releaseDate?: string;
  milestones: Milestone[];
  health?: number;
  description?: string;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectMember = {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  status: ProjectMemberStatus;
  role?: ProjectMemberRole;
  createdAt?: string;
};

export type IssueComment = {
  id: string;
  actor?: string;
  authorName?: string;
  authorId?: string;
  text: string;
  at?: string;
  createdAt?: string;
};

export type IssueActivity = {
  id: string;
  type: string;
  text: string;
  actor?: string;
  at?: string;
};

export type Issue = {
  id: string;
  code: string;
  projectId: string;
  type: string;
  title: string;
  status: string;
  owner?: string;
  ownerLabel?: string;
  ownerId?: string | null;
  parentIssueId?: string | null;
  creator?: string;
  creatorId?: string | null;
  priority: "P0" | "P1" | "P2" | "P3";
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number | null;
  actualHours?: number | null;
  next?: string;
  description?: string;
  comments?: IssueComment[];
  activity?: IssueActivity[];
  scheduleKey?: string;
  scheduleModel?: string;
  scheduleOwners?: string[];
  scheduleWorkdays?: number;
  scheduleImportedAt?: string;
  scheduleSource?: string;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TimeEntry = {
  id: string;
  organizationId: string;
  projectId: string;
  issueId?: string | null;
  userId: string;
  reporter?: string;
  workDate: string;
  spentDate?: string;
  hours: number;
  note?: string;
  description?: string;
  attachments?: TimeEntryAttachment[];
  status: TimeEntryStatus;
  correctionReason?: string;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CostRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  plannedPersonDays: number;
  standardHoursPerDay: number;
  status: CostRecordStatus;
  notes?: string;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TrashItem = {
  id: string;
  type: "project" | "issue" | "milestone" | "costRecord" | "user";
  entityId?: string;
  entity?: unknown;
  deletedAt?: string;
};

export type UserStats = {
  ownerProjectCount: number;
  participantProjectCount: number;
  ownerProjects: Project[];
  participantProjects: Project[];
  totalHours: number;
  lastTimeEntryAt: string;
};

export type AppState = {
  organization: Organization;
  settings: PlatformSettings;
  users: User[];
  projects: Project[];
  projectMembers: ProjectMember[];
  issues: Issue[];
  timeEntries: TimeEntry[];
  costRecords: CostRecord[];
  trash: TrashItem[];
};

export type AuthContext = {
  organizationId: string;
  user: User | null;
  userId: string;
  isAdmin: boolean;
  isActiveUser: boolean;
};

export type ProjectPermissions = {
  canView: boolean;
  canViewBoard: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canChangeOwner: boolean;
  canManageMembers: boolean;
  canManageMemberRoles: boolean;
  canCreateIssue: boolean;
  canManageMilestones: boolean;
  canManageSchedule: boolean;
  canCreateTimeEntries: boolean;
  canViewProjectTimeEntries: boolean;
  canApproveTimeEntries: boolean;
  canViewCost: boolean;
  canManageCost: boolean;
  canExportCost: boolean;
};

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  badge: string;
  summary: string;
  defaultView: string;
  views: string[];
  issueTypes: string[];
  defaultIssueType: string;
  workflow: string[];
  emptyState: {
    title: string;
    description: string;
    action: string;
  };
  milestones: Array<Pick<Milestone, "name" | "window" | "focus">>;
};
