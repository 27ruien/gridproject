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
    attachments: normalizeAttachments(entry.attachments),
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

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 9).map((attachment) => {
    const item = attachment && typeof attachment === "object" ? attachment : {};
    const type = String(item.type || "");
    return {
      id: String(item.id || makeAttachmentId()),
      name: String(item.name || "未命名附件"),
      size: Number(item.size || 0),
      type,
      kind: item.kind === "image" || type.startsWith("image/") ? "image" : "file",
      dataUrl: String(item.dataUrl || ""),
      createdAt: item.createdAt || undefined,
    };
  });
}

function makeAttachmentId() {
  return globalThis.crypto?.randomUUID?.() || `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
