export function normalizeTimeEntry(entry) {
  const now = new Date().toISOString();
  const spentDate = entry.spentDate || entry.workDate || now.slice(0, 10);
  return {
    id: entry.id,
    organizationId: entry.organizationId || "org-default",
    projectId: entry.projectId,
    issueId: entry.issueId,
    userId: entry.userId || "",
    reporter: entry.reporter || "本地用户",
    workDate: entry.workDate || spentDate,
    spentDate,
    hours: normalizeHours(entry.hours),
    note: entry.note || "",
    status: entry.status || "已提交",
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now,
    deletedAt: entry.deletedAt || null,
    deletedById: entry.deletedById || null,
  };
}

function normalizeHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number;
}
