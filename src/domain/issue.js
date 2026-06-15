import { normalizeStatus } from "./workflow.js";
import { getIssueScheduleRisks } from "./scheduleImport.js";

export const PRIORITIES = ["P0", "P1", "P2", "P3"];

export const PRIORITY_TONE = {
  P0: "danger",
  P1: "warn",
  P2: "info",
  P3: "neutral",
};

export function normalizeIssue(issue) {
  return {
    id: issue.id,
    code: issue.code || "ISSUE",
    projectId: issue.projectId,
    type: issue.type || "任务",
    title: issue.title || "未命名事项",
    status: normalizeStatus(issue.status),
    owner: issue.owner || "未分配",
    creator: issue.creator || issue.createdBy || issue.owner || "本地用户",
    priority: PRIORITIES.includes(issue.priority) ? issue.priority : "P2",
    startDate: issue.startDate || issue.createdAt?.slice(0, 10) || "",
    dueDate: issue.dueDate || "",
    estimatedHours: normalizeHours(issue.estimatedHours, 8),
    actualHours: normalizeHours(issue.actualHours, 0),
    next: issue.next || "明确下一步并推进状态",
    description: issue.description || "暂无描述。",
    comments: Array.isArray(issue.comments) ? issue.comments : [],
    activity: Array.isArray(issue.activity) ? issue.activity : [],
    scheduleKey: issue.scheduleKey || "",
    scheduleModel: issue.scheduleModel || "",
    scheduleOwners: Array.isArray(issue.scheduleOwners) ? issue.scheduleOwners : [],
    scheduleWorkdays: Number(issue.scheduleWorkdays) || 0,
    scheduleImportedAt: issue.scheduleImportedAt || "",
    scheduleSource: issue.scheduleSource || "",
    createdAt: issue.createdAt || new Date().toISOString(),
    updatedAt: issue.updatedAt || new Date().toISOString(),
  };
}

export function isIssueRisky(issue) {
  return issue.priority === "P0" || issue.type === "风险" || getIssueScheduleRisks(issue).length > 0;
}

export function filterIssues(issues, filters = {}) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const dateFrom = filters.dateFrom || "";
  const dateTo = filters.dateTo || "";
  const owner = filters.owner || "";
  const creator = filters.creator || "";

  return issues.filter((issue) => {
    const searchable = `${issue.code} ${issue.title} ${issue.type} ${issue.description} ${issue.next}`.toLowerCase();
    if (keyword && !searchable.includes(keyword)) return false;
    if (owner && issue.owner !== owner) return false;
    if (creator && issue.creator !== creator) return false;
    if (dateFrom && issue.dueDate && issue.dueDate < dateFrom) return false;
    if (dateTo && issue.startDate && issue.startDate > dateTo) return false;
    if (dateFrom && !issue.dueDate && issue.startDate && issue.startDate < dateFrom) return false;
    return true;
  });
}

function normalizeHours(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}
