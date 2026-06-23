import { localStorageAdapter } from "../storage/localStorageAdapter.js";
import { normalizeIssue } from "../domain/issue.js";
import { normalizeTimeEntry } from "../domain/timeEntry.js";
import { PROJECT_STATUS_OPTIONS } from "../domain/project.js";
import { normalizeTrashItem } from "../domain/trash.js";
import { getTemplateById } from "../domain/template.js";
import { normalizeMilestones } from "../domain/milestone.js";
import { DEMO_USERS, ORGANIZATION_ID, PROJECT_MEMBER_STATUS, ensureProjectOwnerMembership, userIdForName, userNameForId } from "../domain/access.js";
import { normalizePreferences } from "../domain/preferences.js";
import { hasExplicitAppEnvironment, storageKey } from "./appEnvironment.js";

const UNSCOPED_STORAGE_KEY = "kiviflow-platform-state-v1";
const UNSCOPED_LEGACY_STORAGE_KEY = "kiviflow-vue-mvp-state";
export const STORAGE_KEY = storageKey(UNSCOPED_STORAGE_KEY);
const LEGACY_STORAGE_KEY = storageKey(UNSCOPED_LEGACY_STORAGE_KEY);

const seedState = {
  organization: {
    id: ORGANIZATION_ID,
    name: "GridProject Dev Organization",
  },
  users: DEMO_USERS,
  settings: {
    platformName: "GridProject",
    logoText: "G",
  },
  projects: [
    {
      id: "crm",
      organizationId: ORGANIZATION_ID,
      name: "CRM 线索协同",
      code: "CRM",
      templateId: "agile",
      ownerId: "user-linxia",
      owner: "林夏",
      status: "开发阶段",
      startDate: "2026-05-01",
      dueDate: "2026-06-05",
      testDate: "2026-05-25",
      acceptanceDate: "2026-06-01",
      releaseDate: "2026-06-05",
      health: 78,
      description: "围绕销售线索协同进行迭代式研发交付。",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "mall",
      organizationId: ORGANIZATION_ID,
      name: "商场 AR 交付",
      code: "MALL",
      templateId: "waterfall",
      ownerId: "user-hanyue",
      owner: "韩越",
      status: "验收阶段",
      startDate: "2026-04-28",
      dueDate: "2026-06-20",
      testDate: "2026-06-08",
      acceptanceDate: "2026-06-16",
      releaseDate: "2026-06-20",
      health: 72,
      description: "面向客户交付的 AR 活动项目，按阶段推进交付物和验收。",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "ai",
      organizationId: ORGANIZATION_ID,
      name: "AI 试衣平台",
      code: "AI",
      templateId: "agile",
      ownerId: "user-zhoucheng",
      owner: "周程",
      status: "测试阶段",
      startDate: "2026-05-06",
      dueDate: "2026-06-12",
      testDate: "2026-06-02",
      acceptanceDate: "2026-06-08",
      releaseDate: "2026-06-12",
      health: 86,
      description: "围绕 AI 试衣核心能力持续迭代。",
      createdAt: "2026-05-06T00:00:00.000Z",
      updatedAt: "2026-05-06T00:00:00.000Z",
    },
  ],
  issues: [
    {
      id: "i1",
      code: "AGL-118",
      projectId: "crm",
      type: "需求",
      title: "批量分配线索",
      status: "未开始",
      owner: "林夏",
      creator: "林夏",
      priority: "P0",
      startDate: "2026-05-12",
      dueDate: "2026-05-18",
      estimatedHours: 32,
      actualHours: 8,
      next: "补齐验收标准并确认是否进入 v1.6.0",
      description: "支持销售主管按区域、客户等级、线索来源批量分配线索。",
    },
    {
      id: "i2",
      code: "AGL-124",
      projectId: "crm",
      type: "任务",
      title: "迭代燃尽图数据接口",
      status: "进行中",
      owner: "周程",
      creator: "林夏",
      priority: "P1",
      startDate: "2026-05-10",
      dueDate: "2026-05-22",
      estimatedHours: 48,
      actualHours: 26,
      next: "完成剩余工作量统计接口",
      description: "提供迭代维度的燃尽图数据。",
    },
    {
      id: "i3",
      code: "AGL-130",
      projectId: "crm",
      type: "缺陷",
      title: "客户归属变更后看板未刷新",
      status: "未开始",
      owner: "韩越",
      creator: "周程",
      priority: "P1",
      startDate: "2026-05-13",
      dueDate: "2026-05-15",
      estimatedHours: 12,
      actualHours: 2,
      next: "确认缓存刷新策略",
      description: "客户归属字段被批量更新后，销售工作台仍展示旧数据。",
    },
    {
      id: "i4",
      code: "WAT-203",
      projectId: "mall",
      type: "交付物",
      title: "客户需求确认书",
      status: "未开始",
      owner: "韩越",
      creator: "韩越",
      priority: "P0",
      startDate: "2026-05-11",
      dueDate: "2026-05-16",
      estimatedHours: 18,
      actualHours: 7,
      next: "补齐客户签字版和范围边界",
      description: "瀑布项目进入设计前必须冻结需求范围和验收口径。",
    },
    {
      id: "i5",
      code: "WAT-219",
      projectId: "mall",
      type: "风险",
      title: "设计确认延期",
      status: "未开始",
      owner: "陈澈",
      creator: "韩越",
      priority: "P1",
      startDate: "2026-05-09",
      dueDate: "2026-05-14",
      estimatedHours: 10,
      actualHours: 4,
      next: "确认客户反馈截止时间",
      description: "客户设计确认延期 2 天，影响后续开发实施窗口。",
    },
  ],
  timeEntries: [
    { id: "t1", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i1", userId: "user-linxia", reporter: "林夏", workDate: "2026-05-12", spentDate: "2026-05-12", hours: 4, status: "APPROVED", note: "补充批量分配业务规则" },
    { id: "t2", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i2", userId: "user-zhoucheng", reporter: "周程", workDate: "2026-05-13", spentDate: "2026-05-13", hours: 6, status: "SUBMITTED", note: "燃尽图接口联调" },
    { id: "t3", organizationId: ORGANIZATION_ID, projectId: "mall", issueId: "i4", userId: "user-hanyue", reporter: "韩越", workDate: "2026-05-11", spentDate: "2026-05-11", hours: 3, status: "APPROVED", note: "整理客户需求确认材料" },
    { id: "t4", organizationId: ORGANIZATION_ID, projectId: "crm", issueId: "i3", userId: "user-hanyue", reporter: "韩越", workDate: "2026-05-14", spentDate: "2026-05-14", hours: 2, status: "DRAFT", note: "草稿不计入成本" },
  ],
  projectMembers: [
    { id: "pm-crm-linxia", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-linxia", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "pm-crm-zhoucheng", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-zhoucheng", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "pm-crm-hanyue", organizationId: ORGANIZATION_ID, projectId: "crm", userId: "user-hanyue", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "pm-mall-hanyue", organizationId: ORGANIZATION_ID, projectId: "mall", userId: "user-hanyue", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "pm-mall-chenche", organizationId: ORGANIZATION_ID, projectId: "mall", userId: "user-chenche", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "pm-ai-zhoucheng", organizationId: ORGANIZATION_ID, projectId: "ai", userId: "user-zhoucheng", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-05-06T00:00:00.000Z" },
    { id: "pm-ai-linxia", organizationId: ORGANIZATION_ID, projectId: "ai", userId: "user-linxia", status: PROJECT_MEMBER_STATUS.ACTIVE, createdAt: "2026-05-06T00:00:00.000Z" },
  ],
  costRecords: [
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
  ],
  sessions: [],
  auditLogs: [],
  trash: [],
};

export const stateService = {
  load(adapter = localStorageAdapter) {
    const saved = adapter.read(STORAGE_KEY, null)
      || adapter.read(LEGACY_STORAGE_KEY, null)
      || (!hasExplicitAppEnvironment()
        ? adapter.read(UNSCOPED_STORAGE_KEY, null) || adapter.read(UNSCOPED_LEGACY_STORAGE_KEY, null)
        : null);
    if (!saved) return normalizeState(seedState);

    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      return normalizeState(seedState);
    }
  },
  save(state, adapter = localStorageAdapter) {
    adapter.write(STORAGE_KEY, JSON.stringify({
      projects: state.projects,
      issues: state.issues,
      timeEntries: state.timeEntries,
      projectMembers: state.projectMembers,
      costRecords: state.costRecords,
      sessions: state.sessions,
      auditLogs: state.auditLogs,
      users: state.users.map(({ passwordHash, ...user }) => user),
      organization: state.organization,
      trash: state.trash,
      settings: state.settings,
    }));
  },
};

function normalizeState(rawState) {
  const issues = rawState.issues || rawState.items || seedState.issues;
  return {
    organization: rawState.organization || seedState.organization,
    users: normalizeUsers(rawState.users || seedState.users),
    settings: normalizeSettings(rawState.settings || seedState.settings),
    projects: (rawState.projects || seedState.projects).map(normalizeProject),
    issues: issues.map(normalizeIssue),
    timeEntries: (rawState.timeEntries || seedState.timeEntries).map(normalizeTimeEntry),
    projectMembers: normalizeProjectMembers(rawState.projectMembers, rawState.projects || seedState.projects),
    costRecords: normalizeCostRecords(rawState.costRecords || seedState.costRecords),
    sessions: normalizeSessions(rawState.sessions || seedState.sessions),
    auditLogs: rawState.auditLogs || seedState.auditLogs,
    trash: (rawState.trash || seedState.trash).map(normalizeTrashItem),
  };
}

function normalizeSettings(settings) {
  return {
    platformName: settings.platformName === "KiviFlow" ? "GridProject" : settings.platformName || "GridProject",
    logoText: ((settings.logoText === "K" ? "G" : settings.logoText) || "G").slice(0, 2),
  };
}

function normalizeProject(project) {
  const template = getTemplateById(project.templateId || "agile");
  const startDate = project.startDate || "";
  const ownerId = project.ownerId || userIdForName(seedState.users, project.owner) || "user-linxia";
  return {
    id: project.id,
    organizationId: project.organizationId || ORGANIZATION_ID,
    name: project.name || "未命名项目",
    code: project.code || project.id?.toUpperCase() || "PROJECT",
    templateId: template.id,
    ownerId,
    owner: project.owner || userNameForId(seedState.users, ownerId),
    status: normalizeProjectStatus(project.status),
    executionTeams: Array.isArray(project.executionTeams) ? [...new Set(project.executionTeams)] : [],
    startDate,
    dueDate: project.dueDate || "",
    testDate: project.testDate || "",
    acceptanceDate: project.acceptanceDate || "",
    releaseDate: project.releaseDate || "",
    milestones: normalizeMilestones(project.milestones, template, startDate),
    health: Number.isFinite(project.health) ? project.health : 90,
    description: project.description || "暂无项目概述。",
    createdById: project.createdById || ownerId,
    deletedAt: project.deletedAt || null,
    deletedById: project.deletedById || null,
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString(),
  };
}

function normalizeUsers(users) {
  return users.map((user) => ({
    id: user.id,
    organizationId: user.organizationId || ORGANIZATION_ID,
    name: user.name || "未命名成员",
    email: user.email || `${user.id || "user"}@gridproject.local`,
    preferences: normalizePreferences(user.preferences),
    passwordHash: user.passwordHash || "",
    role: user.role === "ADMIN" ? "ADMIN" : "MEMBER",
    status: user.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    lastLoginAt: user.lastLoginAt || null,
    deletedAt: user.deletedAt || null,
    deletedById: user.deletedById || null,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || user.createdAt || new Date().toISOString(),
  }));
}

function normalizeProjectMembers(projectMembers, rawProjects) {
  const normalizedProjects = rawProjects.map(normalizeProject);
  const baseMembers = (projectMembers || seedState.projectMembers).map((member) => ({
    id: member.id || `pm-${member.projectId}-${member.userId}`,
    organizationId: member.organizationId || ORGANIZATION_ID,
    projectId: member.projectId,
    userId: member.userId,
    status: member.status || PROJECT_MEMBER_STATUS.ACTIVE,
    createdAt: member.createdAt || new Date().toISOString(),
  }));
  return normalizedProjects.reduce((members, project) => ensureProjectOwnerMembership(project, members), baseMembers);
}

function normalizeCostRecords(records) {
  return records.map((record) => ({
    id: record.id,
    organizationId: record.organizationId || ORGANIZATION_ID,
    projectId: record.projectId,
    plannedPersonDays: Number(record.plannedPersonDays) > 0 ? Number(record.plannedPersonDays) : 120,
    standardHoursPerDay: Number(record.standardHoursPerDay) || 8,
    status: record.status || "ACTIVE",
    notes: record.notes || "",
    createdById: record.createdById || "user-linxia",
    updatedById: record.updatedById || record.createdById || "user-linxia",
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    deletedAt: record.deletedAt || null,
    deletedById: record.deletedById || null,
  }));
}

function normalizeSessions(sessions) {
  return sessions.map((session) => ({
    id: session.id,
    organizationId: session.organizationId || ORGANIZATION_ID,
    userId: session.userId,
    tokenHash: session.tokenHash || "",
    expiresAt: session.expiresAt || new Date().toISOString(),
    revokedAt: session.revokedAt || null,
    createdAt: session.createdAt || new Date().toISOString(),
  }));
}

function normalizeProjectStatus(status) {
  if (PROJECT_STATUS_OPTIONS.includes(status)) return status;
  const legacyStatusMap = {
    进行中: "开发阶段",
    立项: "规划中",
    设计确认: "验收阶段",
  };
  return legacyStatusMap[status] || "规划中";
}
