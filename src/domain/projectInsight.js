import { isClosedStatus } from "./workflow.js";

export function getProjectAlerts(issues, today = new Date()) {
  const todayStart = startOfDay(today);

  return issues
    .filter((issue) => !isClosedStatus(issue.status))
    .map((issue) => buildAlert(issue, todayStart))
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || dateWeight(a.dueDate) - dateWeight(b.dueDate))
    .slice(0, 6);
}

export function getProjectActivities(issues, limit = 8) {
  return issues
    .flatMap((issue) => (issue.activity || []).map((activity) => ({
      ...activity,
      issueId: issue.id,
      issueCode: issue.code,
      issueTitle: issue.title,
    })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

function buildAlert(issue, todayStart) {
  const days = daysUntil(issue.dueDate, todayStart);
  const isOverdue = Number.isFinite(days) && days < 0;
  const isDueSoon = Number.isFinite(days) && days >= 0 && days <= 3;
  const isRisk = issue.priority === "P0" || issue.type === "风险";

  if (isOverdue) {
    return {
      issueId: issue.id,
      tone: "danger",
      rank: 0,
      label: `逾期 ${Math.abs(days)} 天`,
      title: issue.title,
      owner: issue.owner,
      dueDate: issue.dueDate,
      next: issue.next,
    };
  }

  if (isRisk) {
    return {
      issueId: issue.id,
      tone: "warn",
      rank: 1,
      label: issue.type === "风险" ? "风险事项" : "P0 优先级",
      title: issue.title,
      owner: issue.owner,
      dueDate: issue.dueDate,
      next: issue.next,
    };
  }

  if (isDueSoon) {
    return {
      issueId: issue.id,
      tone: "info",
      rank: 2,
      label: days === 0 ? "今天到期" : `${days} 天后到期`,
      title: issue.title,
      owner: issue.owner,
      dueDate: issue.dueDate,
      next: issue.next,
    };
  }

  return null;
}

function daysUntil(dateValue, todayStart) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const dueDate = startOfDay(new Date(dateValue));
  return Math.ceil((dueDate.getTime() - todayStart.getTime()) / 86400000);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateWeight(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}
