import type { AppState, CostRecord, Issue, Milestone, Project, ProjectMember, TimeEntry, User } from "@/types/domain";
import { ORGANIZATION_ID } from "@/lib/permissions/policies";
import { getTemplateById, normalizeIssue } from "./calculations";

export const DEFAULT_PREFERENCES = {
  density: "comfortable",
  dateFormat: "yyyy-mm-dd",
  weekStart: "monday",
  defaultNav: "auto",
  homeDueRange: "all",
} as const;

export const DEMO_USERS: User[] = [
  { id: "user-admin", organizationId: ORGANIZATION_ID, name: "管理员", email: "admin@gridproject.local", role: "ADMIN", status: "ACTIVE", preferences: DEFAULT_PREFERENCES, lastLoginAt: "2026-06-18T08:30:00.000Z" },
  { id: "user-linxia", organizationId: ORGANIZATION_ID, name: "林夏", email: "linxia@gridproject.local", role: "MEMBER", status: "ACTIVE", preferences: DEFAULT_PREFERENCES, lastLoginAt: "2026-06-17T10:20:00.000Z" },
  { id: "user-zhoucheng", organizationId: ORGANIZATION_ID, name: "周程", email: "zhoucheng@gridproject.local", role: "MEMBER", status: "ACTIVE", preferences: DEFAULT_PREFERENCES, lastLoginAt: "2026-06-16T09:10:00.000Z" },
  { id: "user-hanyue", organizationId: ORGANIZATION_ID, name: "韩越", email: "hanyue@gridproject.local", role: "MEMBER", status: "ACTIVE", preferences: DEFAULT_PREFERENCES, lastLoginAt: "2026-06-15T13:00:00.000Z" },
  { id: "user-chenche", organizationId: ORGANIZATION_ID, name: "陈澈", email: "chenche@gridproject.local", role: "MEMBER", status: "ACTIVE", preferences: DEFAULT_PREFERENCES, lastLoginAt: null },
];

const projects: Project[] = [
  createProject({
    id: "crm",
    name: "CRM 线索协同",
    code: "CRM",
    templateId: "agile",
    ownerId: "user-linxia",
    owner: "林夏",
    createdById: "user-linxia",
    status: "开发阶段",
    startDate: "2026-05-01",
    dueDate: "2026-06-05",
    testDate: "2026-05-25",
    acceptanceDate: "2026-06-01",
    releaseDate: "2026-06-05",
    health: 78,
    description: "围绕销售线索协同进行迭代式研发交付。",
  }),
  createProject({
    id: "mall",
    name: "商场 AR 交付",
    code: "MALL",
    templateId: "waterfall",
    ownerId: "user-hanyue",
    owner: "韩越",
    createdById: "user-hanyue",
    status: "验收阶段",
    startDate: "2026-04-28",
    dueDate: "2026-06-20",
    testDate: "2026-06-08",
    acceptanceDate: "2026-06-16",
    releaseDate: "2026-06-20",
    health: 72,
    description: "面向客户交付的 AR 活动项目，按阶段推进交付物和验收。",
  }),
  createProject({
    id: "ai",
    name: "AI 试衣平台",
    code: "AI",
    templateId: "agile",
    ownerId: "user-zhoucheng",
    owner: "周程",
    createdById: "user-zhoucheng",
    status: "测试阶段",
    startDate: "2026-05-06",
    dueDate: "2026-06-12",
    testDate: "2026-06-02",
    acceptanceDate: "2026-06-08",
    releaseDate: "2026-06-12",
    health: 86,
    description: "围绕 AI 试衣核心能力持续迭代。",
  }),
];

const issues: Issue[] = [
  normalizeIssue({ id: "i1", code: "AGL-118", projectId: "crm", type: "需求", title: "批量分配线索", status: "未开始", owner: "林夏", ownerId: "user-linxia", creator: "林夏", creatorId: "user-linxia", priority: "P0", startDate: "2026-05-12", dueDate: "2026-05-18", estimatedHours: 32, actualHours: 8, next: "补齐验收标准并确认是否进入 v1.6.0", description: "支持销售主管按区域、客户等级、线索来源批量分配线索。" }),
  normalizeIssue({ id: "i2", code: "AGL-124", projectId: "crm", type: "任务", title: "迭代燃尽图数据接口", status: "进行中", owner: "周程", ownerId: "user-zhoucheng", creator: "林夏", creatorId: "user-linxia", priority: "P1", startDate: "2026-05-10", dueDate: "2026-05-22", estimatedHours: 48, actualHours: 26, next: "完成剩余工作量统计接口", description: "提供迭代维度的燃尽图数据。" }),
  normalizeIssue({ id: "i3", code: "AGL-130", projectId: "crm", type: "缺陷", title: "客户归属变更后看板未刷新", status: "未开始", owner: "韩越", ownerId: "user-hanyue", creator: "周程", creatorId: "user-zhoucheng", priority: "P1", startDate: "2026-05-13", dueDate: "2026-05-15", estimatedHours: 12, actualHours: 2, next: "确认缓存刷新策略", description: "客户归属字段被批量更新后，销售工作台仍展示旧数据。" }),
  normalizeIssue({ id: "i4", code: "WAT-203", projectId: "mall", type: "交付物", title: "客户需求确认书", status: "待验收", owner: "韩越", ownerId: "user-hanyue", creator: "韩越", creatorId: "user-hanyue", priority: "P0", startDate: "2026-05-11", dueDate: "2026-05-16", estimatedHours: 18, actualHours: 7, next: "补齐客户签字版和范围边界", description: "瀑布项目进入设计前必须冻结需求范围和验收口径。" }),
  normalizeIssue({ id: "i5", code: "WAT-219", projectId: "mall", type: "风险", title: "设计确认延期", status: "进行中", owner: "陈澈", ownerId: "user-chenche", creator: "韩越", creatorId: "user-hanyue", priority: "P1", startDate: "2026-05-09", dueDate: "2026-05-14", estimatedHours: 10, actualHours: 4, next: "确认客户反馈截止时间", description: "客户设计确认延期 2 天，影响后续开发实施窗口。" }),
];

const timeEntries: TimeEntry[] = [
  { id: "t1", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i1", userId: "user-linxia", reporter: "林夏", workDate: "2026-05-12", spentDate: "2026-05-12", hours: 4, status: "APPROVED", note: "补充批量分配业务规则" },
  { id: "t2", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i2", userId: "user-zhoucheng", reporter: "周程", workDate: "2026-05-13", spentDate: "2026-05-13", hours: 6, status: "SUBMITTED", note: "燃尽图接口联调" },
  { id: "t3", organizationId: ORGANIZATION_ID, projectId: "mall", issueId: "i4", userId: "user-hanyue", reporter: "韩越", workDate: "2026-05-11", spentDate: "2026-05-11", hours: 3, status: "APPROVED", note: "整理客户需求确认材料" },
  { id: "t4", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i3", userId: "user-hanyue", reporter: "韩越", workDate: "2026-05-14", spentDate: "2026-05-14", hours: 2, status: "DRAFT", note: "草稿不计入成本" },
];

const projectMembers: ProjectMember[] = [
  { id: "pm-crm-linxia", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-linxia", status: "ACTIVE", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "pm-crm-zhoucheng", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-zhoucheng", status: "ACTIVE", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "pm-crm-hanyue", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-hanyue", status: "ACTIVE", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "pm-mall-hanyue", organizationId: ORGANIZATION_ID, projectId: "mall", userId: "user-hanyue", status: "ACTIVE", createdAt: "2026-04-28T00:00:00.000Z" },
  { id: "pm-mall-chenche", organizationId: ORGANIZATION_ID, projectId: "mall", userId: "user-chenche", status: "ACTIVE", createdAt: "2026-04-28T00:00:00.000Z" },
  { id: "pm-ai-zhoucheng", organizationId: ORGANIZATION_ID, projectId: "ai", userId: "user-zhoucheng", status: "ACTIVE", createdAt: "2026-05-06T00:00:00.000Z" },
  { id: "pm-ai-linxia", organizationId: ORGANIZATION_ID, projectId: "ai", userId: "user-linxia", status: "ACTIVE", createdAt: "2026-05-06T00:00:00.000Z" },
];

const costRecords: CostRecord[] = [
  {
    id: "cost-crm",
    organizationId: ORGANIZATION_ID,
    projectId: "crm",
    plannedPersonDays: 120,
    standardHoursPerDay: 8,
    status: "ACTIVE",
    notes: "CRM 项目计划投入工时，默认纳入已提交工时。",
    createdById: "user-linxia",
    updatedById: "user-linxia",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    deletedAt: null,
    deletedById: null,
  },
];

export const seedState: AppState = {
  organization: { id: ORGANIZATION_ID, name: "GridProject Dev Organization" },
  settings: { platformName: "GridProject", logoText: "G" },
  users: DEMO_USERS,
  projects,
  projectMembers,
  issues,
  timeEntries,
  costRecords,
  trash: [],
};

function createProject(input: Omit<Project, "organizationId" | "executionTeams" | "milestones"> & { executionTeams?: string[] }) {
  const template = getTemplateById(input.templateId);
  const milestones: Milestone[] = template.milestones.map((milestone, index) => ({
    id: `${input.id}-milestone-${index + 1}`,
    name: milestone.name,
    title: milestone.name,
    window: milestone.window,
    focus: milestone.focus,
    status: index === 0 ? "进行中" : "未开始",
    dueDate: input.releaseDate,
  }));
  return {
    organizationId: ORGANIZATION_ID,
    executionTeams: input.executionTeams || ["产品", "研发"],
    milestones,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedById: null,
    ...input,
  };
}
