const TYPE_META = {
  Epic: { icon: "issueEpic", tone: "epic" },
  需求: { icon: "issueRequirement", tone: "requirement" },
  任务: { icon: "issueTask", tone: "task" },
  缺陷: { icon: "issueBug", tone: "bug" },
  技术债: { icon: "issueDebt", tone: "debt" },
  阶段: { icon: "milestone", tone: "phase" },
  交付物: { icon: "issueEpic", tone: "deliverable" },
  风险: { icon: "issueRisk", tone: "risk" },
  变更: { icon: "issueChange", tone: "change" },
  验收项: { icon: "issueTask", tone: "acceptance" },
};

export function issueTypeMeta(type) {
  return TYPE_META[type] || { icon: "issueTask", tone: "task" };
}

export function issueStatusTone(status) {
  if (/完成|验收/.test(status)) return "done";
  if (/进行|开发|测试/.test(status)) return "in-progress";
  if (/风险|阻塞/.test(status)) return "danger";
  return "neutral";
}

export function formatIssueDate(value) {
  if (!value) return "未设置";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isIssueOverdue(issue) {
  if (!issue.dueDate || /完成|验收/.test(issue.status)) return false;
  return new Date(`${issue.dueDate}T23:59:59`).getTime() < Date.now();
}

export function issueOwners(issue) {
  if (Array.isArray(issue.owners) && issue.owners.length) return issue.owners;
  return issue.owner && issue.owner !== "未分配" ? [issue.owner] : [];
}
