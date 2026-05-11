export function normalizeTimeEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    projectId: entry.projectId,
    issueId: entry.issueId,
    reporter: entry.reporter || "本地用户",
    spentDate: entry.spentDate || now.slice(0, 10),
    hours: normalizeHours(entry.hours),
    note: entry.note || "",
    status: entry.status || "已提交",
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now,
  };
}

function normalizeHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number;
}
