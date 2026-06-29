import { addDays, differenceInCalendarDays, endOfMonth, format, isBefore, isWeekend, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type { CostRecord, Issue, Project, ProjectTemplate, TimeEntry, User } from "@/types/domain";
import { normalizeTimeEntryStatus } from "@/lib/permissions/policies";

export const ISSUE_STATUSES = ["未开始", "进行中", "联调中", "待验收", "已验收", "已完成"];
export const PROJECT_STATUS_OPTIONS = ["规划中", "开发阶段", "测试阶段", "验收阶段", "上线阶段", "已暂停", "已完成"];
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "agile",
    name: "敏捷研发模板",
    badge: "敏捷",
    summary: "适合产品研发、SaaS 平台功能迭代和持续交付团队。",
    defaultView: "概览",
    views: ["概览", "工作项", "相关方事项", "交付与验收", "风险", "项目设置"],
    issueTypes: ["Epic", "需求", "任务", "相关方事项", "缺陷", "技术债"],
    defaultIssueType: "需求",
    workflow: ISSUE_STATUSES,
    emptyState: {
      title: "先建立需求池",
      description: "补充 Epic、需求和缺陷，再选择 P0/P1 进入迭代。",
      action: "新建需求",
    },
    milestones: [
      { name: "需求梳理", window: "第 1 周", focus: "收敛优先级和验收标准" },
      { name: "迭代交付", window: "第 2-3 周", focus: "完成核心需求与缺陷闭环" },
      { name: "版本复盘", window: "第 4 周", focus: "沉淀指标、问题和下一轮计划" },
    ],
  },
  {
    id: "waterfall",
    name: "瀑布交付模板",
    badge: "瀑布",
    summary: "适合客户项目、实施交付、硬期限上线和验收型项目。",
    defaultView: "概览",
    views: ["概览", "工作项", "相关方事项", "交付与验收", "风险", "项目设置"],
    issueTypes: ["阶段", "任务", "相关方事项", "交付物", "风险", "变更", "验收项"],
    defaultIssueType: "任务",
    workflow: ISSUE_STATUSES,
    emptyState: {
      title: "先确认阶段与交付物",
      description: "从范围确认、相关方事项、风险和验收项开始建立项目骨架。",
      action: "新建交付任务",
    },
    milestones: [
      { name: "立项与范围", window: "第 1 周", focus: "冻结范围、目标和客户联系人" },
      { name: "设计与实施", window: "第 2-4 周", focus: "完成方案、开发实施和联调" },
      { name: "测试与验收", window: "第 5 周", focus: "交付物确认、风险关闭、客户签收" },
    ],
  },
];

export function getTemplateById(templateId?: string) {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId) || PROJECT_TEMPLATES[0];
}

export function isClosedStatus(status?: string) {
  return ["已完成", "已关闭", "已验收", "APPROVED"].includes(status || "");
}

export function summarizeProject(project: Project, issues: Issue[]) {
  const openIssues = issues.filter((issue) => !isClosedStatus(issue.status));
  const doneCount = issues.length - openIssues.length;
  const overdueCount = openIssues.filter((issue) => issue.dueDate && daysUntil(issue.dueDate) < 0).length;
  const riskCount = issues.filter(isIssueRisky).length;
  const estimatedHours = issues.reduce((sum, issue) => sum + Number(issue.estimatedHours || 0), 0);
  const actualHours = issues.reduce((sum, issue) => sum + Number(issue.actualHours || 0), 0);
  return {
    progress: issues.length ? Math.round((doneCount / issues.length) * 100) : 0,
    health: Math.max(35, Math.min(98, Number(project.health || 88) - overdueCount * 6 - riskCount * 2)),
    totalCount: issues.length,
    openCount: openIssues.length,
    doneCount,
    overdueCount,
    riskCount,
    scheduleRiskCount: issues.filter((issue) => issue.scheduleWorkdays && daysUntil(issue.dueDate) < 2 && !isClosedStatus(issue.status)).length,
    actualHours,
    estimatedHours,
    remainingHours: Math.max(0, estimatedHours - actualHours),
    nextIssues: [...openIssues].sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || daysUntil(a.dueDate) - daysUntil(b.dueDate)).slice(0, 4),
  };
}

export function isIssueRisky(issue: Issue) {
  return issue.priority === "P0" || issue.type === "风险" || Boolean(issue.scheduleWorkdays && daysUntil(issue.dueDate) < 0);
}

export function daysUntil(value?: string | null) {
  if (!value) return 9999;
  const today = parseISO(format(new Date(), "yyyy-MM-dd"));
  return differenceInCalendarDays(parseISO(value.slice(0, 10)), today);
}

export function priorityWeight(priority?: string) {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as Record<string, number>)[priority || ""] ?? 4;
}

export function formatDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function weekDays(weekStartDate: Date) {
  const start = startOfWeek(weekStartDate, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_item, index) => {
    const date = addDays(start, index);
    return {
      date: formatDate(date),
      label: ["一", "二", "三", "四", "五"][index],
      shortDate: format(date, "MM-dd"),
    };
  });
}

export function monthWorkdays(monthValue: string) {
  const first = parseISO(`${monthValue}-01`);
  const dates: string[] = [];
  for (let date = startOfMonth(first); !isBefore(endOfMonth(first), date); date = addDays(date, 1)) {
    if (!isWeekend(date)) dates.push(formatDate(date));
  }
  return dates;
}

export function normalizeIssue(issue: Partial<Issue> & Pick<Issue, "id" | "projectId" | "title">): Issue {
  const now = new Date().toISOString();
  return {
    id: issue.id,
    code: issue.code || `TASK-${Math.floor(Math.random() * 900 + 100)}`,
    projectId: issue.projectId,
    type: issue.type || "任务",
    title: issue.title || "未命名事项",
    status: issue.status || "未开始",
    owner: issue.owner || "未分配",
    ownerLabel: issue.ownerLabel || issue.owner || "",
    ownerId: issue.ownerId || null,
    parentIssueId: issue.parentIssueId || null,
    creator: issue.creator || "本地用户",
    creatorId: issue.creatorId || null,
    priority: issue.priority || "P2",
    startDate: issue.startDate || formatDate(new Date()),
    dueDate: issue.dueDate || formatDate(addDays(new Date(), 7)),
    estimatedHours: Number(issue.estimatedHours || 8),
    actualHours: Number(issue.actualHours || 0),
    next: issue.next || "明确下一步并推进状态",
    description: issue.description || "暂无描述。",
    comments: issue.comments || [],
    activity: issue.activity || [{ id: `activity-${Date.now()}`, type: "created", text: "创建事项", at: now }],
    scheduleKey: issue.scheduleKey || "",
    scheduleModel: issue.scheduleModel || "",
    scheduleOwners: issue.scheduleOwners || [],
    scheduleWorkdays: Number(issue.scheduleWorkdays || 0),
    scheduleImportedAt: issue.scheduleImportedAt || "",
    scheduleSource: issue.scheduleSource || "",
    deletedAt: issue.deletedAt || null,
    deletedById: issue.deletedById || null,
    createdAt: issue.createdAt || now,
    updatedAt: issue.updatedAt || now,
  };
}

export function calculateCostSummary(record: CostRecord, project: Project, entries: TimeEntry[], issues: Issue[], users: User[], filter: { weekStart?: string } = {}) {
  const standardHoursPerDay = Number(record.standardHoursPerDay || 8);
  const scoped = entries
    .filter((entry) => entry.projectId === project.id && !entry.deletedAt)
    .filter((entry) => ["SUBMITTED", "APPROVED"].includes(normalizeTimeEntryStatus(entry.status)))
    .filter((entry) => {
      if (!filter.weekStart) return true;
      const start = parseISO(filter.weekStart);
      const end = addDays(start, 6);
      const work = parseISO(entry.workDate || entry.spentDate || "");
      return !Number.isNaN(work.getTime()) && work >= start && work <= end;
    });
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const actualHours = scoped.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const actualPersonDays = standardHoursPerDay ? actualHours / standardHoursPerDay : 0;
  const people = users
    .map((user) => {
      const userEntries = scoped.filter((entry) => entry.userId === user.id);
      const hours = userEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        hours: round(hours, 1),
        personDays: round(standardHoursPerDay ? hours / standardHoursPerDay : 0, 2),
        entryCount: userEntries.length,
        lastWorkDate: userEntries.map((entry) => entry.workDate).sort().at(-1) || "",
      };
    })
    .filter((person) => person.entryCount)
    .sort((a, b) => b.hours - a.hours);
  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code || project.id,
    ownerName: userMap.get(project.ownerId)?.name || project.owner || "未知成员",
    plannedPersonDays: Number(record.plannedPersonDays || 0),
    standardHoursPerDay,
    actualHours: round(actualHours, 1),
    actualPersonDays: round(actualPersonDays, 2),
    remainingPersonDays: round(Number(record.plannedPersonDays || 0) - actualPersonDays, 2),
    personDayBurnRate: record.plannedPersonDays ? round((actualPersonDays / record.plannedPersonDays) * 100, 1) : 0,
    participantCount: people.length,
    people,
    rawData: scoped.map((entry) => {
      const issue = issueMap.get(entry.issueId || "");
      const user = userMap.get(entry.userId);
      return {
        id: entry.id,
        userId: entry.userId,
        personName: user?.name || entry.reporter || "未知成员",
        projectCode: project.code || project.id,
        issueCode: issue?.code || "",
        issueTitle: issue?.title || "未关联事项",
        workDate: entry.workDate,
        hours: Number(entry.hours || 0),
        personDays: round(standardHoursPerDay ? Number(entry.hours || 0) / standardHoursPerDay : 0, 2),
        status: normalizeTimeEntryStatus(entry.status),
        note: entry.note || entry.description || "",
      };
    }),
  };
}

export function round(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}
