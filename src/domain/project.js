import { isClosedStatus } from "./workflow.js";

export const WORKSPACE = {
  id: "default-workspace",
  name: "Kivisense 组织工作区",
  plan: "商业化前端雏形",
};

export function calculateProjectProgress(issues) {
  if (!issues.length) return 0;
  const doneCount = issues.filter((issue) => isClosedStatus(issue.status)).length;
  return Math.round((doneCount / issues.length) * 100);
}

export function calculateProjectHealth(project, issues) {
  if (!issues.length) return project.health || 90;

  const openCount = issues.filter((issue) => !isClosedStatus(issue.status)).length;
  const p0Count = issues.filter((issue) => issue.priority === "P0").length;
  const overdueCount = issues.filter((issue) => issue.dueDate && !isClosedStatus(issue.status) && new Date(issue.dueDate) < startOfToday()).length;
  const progress = calculateProjectProgress(issues);
  const score = 88 + Math.round(progress * 0.08) - openCount * 2 - p0Count * 6 - overdueCount * 8;

  return Math.max(35, Math.min(98, score));
}

export function summarizeProject(project, issues) {
  const openIssues = issues.filter((issue) => !isClosedStatus(issue.status));
  const doneIssues = issues.filter((issue) => isClosedStatus(issue.status));
  const risks = issues.filter((issue) => issue.priority === "P0" || issue.type === "风险");
  const overdueIssues = issues.filter((issue) => issue.dueDate && !isClosedStatus(issue.status) && new Date(issue.dueDate) < startOfToday());
  const nextIssue = openIssues.find((issue) => issue.priority === "P0") || openIssues[0];
  const nextIssues = [...openIssues]
    .sort((a, b) => priorityWeight(a) - priorityWeight(b) || dateWeight(a.dueDate) - dateWeight(b.dueDate))
    .slice(0, 3)
    .map((issue) => ({
      id: issue.id,
      title: issue.title,
      owner: issue.owner,
      dueDate: issue.dueDate,
      priority: issue.priority,
      next: issue.next,
    }));
  const actualHours = issues.reduce((sum, issue) => sum + (Number(issue.actualHours) || 0), 0);
  const estimatedHours = issues.reduce((sum, issue) => sum + (Number(issue.estimatedHours) || 0), 0);

  return {
    progress: calculateProjectProgress(issues),
    health: calculateProjectHealth(project, issues),
    totalCount: issues.length,
    openCount: openIssues.length,
    doneCount: doneIssues.length,
    overdueCount: overdueIssues.length,
    riskCount: risks.length,
    actualHours,
    estimatedHours,
    remainingHours: Math.max(0, estimatedHours - actualHours),
    nextIssues,
    nextStep: nextIssue?.next || "暂无阻塞事项，可以补充下一批工作。",
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function priorityWeight(issue) {
  const weights = { P0: 0, P1: 1, P2: 2, P3: 3 };
  if (issue.type === "风险") return -1;
  return weights[issue.priority] ?? 4;
}

function dateWeight(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}
