import { localStorageAdapter } from "../storage/localStorageAdapter.js";
import { normalizeIssue } from "../domain/issue.js";
import { normalizeTimeEntry } from "../domain/timeEntry.js";

export const STORAGE_KEY = "kiviflow-platform-state-v1";
const LEGACY_STORAGE_KEY = "kiviflow-vue-mvp-state";

const seedState = {
  projects: [
    {
      id: "crm",
      name: "CRM 线索协同",
      templateId: "agile",
      owner: "林夏",
      status: "进行中",
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
      name: "商场 AR 交付",
      templateId: "waterfall",
      owner: "韩越",
      status: "设计确认",
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
      name: "AI 试衣平台",
      templateId: "agile",
      owner: "周程",
      status: "规划中",
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
      description: "提供 Sprint 维度的燃尽图数据。",
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
    { id: "t1", projectId: "crm", issueId: "i1", reporter: "林夏", spentDate: "2026-05-12", hours: 4, note: "补充批量分配业务规则" },
    { id: "t2", projectId: "crm", issueId: "i2", reporter: "周程", spentDate: "2026-05-13", hours: 6, note: "燃尽图接口联调" },
    { id: "t3", projectId: "mall", issueId: "i4", reporter: "韩越", spentDate: "2026-05-11", hours: 3, note: "整理客户需求确认材料" },
  ],
};

export const stateService = {
  load(adapter = localStorageAdapter) {
    const saved = adapter.read(STORAGE_KEY, null) || adapter.read(LEGACY_STORAGE_KEY, null);
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
    }));
  },
};

function normalizeState(rawState) {
  const issues = rawState.issues || rawState.items || seedState.issues;
  return {
    projects: (rawState.projects || seedState.projects).map(normalizeProject),
    issues: issues.map(normalizeIssue),
    timeEntries: (rawState.timeEntries || seedState.timeEntries).map(normalizeTimeEntry),
  };
}

function normalizeProject(project) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: project.id,
    name: project.name || "未命名项目",
    templateId: project.templateId || "agile",
    owner: project.owner || "未分配",
    status: project.status || "规划中",
    startDate: project.startDate || today,
    dueDate: project.dueDate || today,
    testDate: project.testDate || project.dueDate || today,
    acceptanceDate: project.acceptanceDate || project.dueDate || today,
    releaseDate: project.releaseDate || project.dueDate || today,
    health: Number.isFinite(project.health) ? project.health : 90,
    description: project.description || "暂无项目说明。",
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString(),
  };
}
