import type { Prisma } from "../../generated/prisma/client.js";

export function toIsoDateTime(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function toDateOnly(value: unknown) {
  const dateTime = toIsoDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : null;
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function toJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function sanitizeUserDto(user: any) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    lastLoginAt: toIsoDateTime(safeUser.lastLoginAt),
    deletedAt: toIsoDateTime(safeUser.deletedAt),
    createdAt: toIsoDateTime(safeUser.createdAt),
    updatedAt: toIsoDateTime(safeUser.updatedAt),
  };
}

export function projectDto(project: any) {
  const config = toJsonObject(project.config);
  return {
    ...project,
    templateId: String(config.templateId || "agile"),
    startDate: toDateOnly(project.startDate),
    dueDate: toDateOnly(project.dueDate),
    testDate: toDateOnly(project.testDate),
    acceptanceDate: toDateOnly(project.acceptanceDate),
    releaseDate: toDateOnly(project.releaseDate),
    deletedAt: toIsoDateTime(project.deletedAt),
    createdAt: toIsoDateTime(project.createdAt),
    updatedAt: toIsoDateTime(project.updatedAt),
    owner: project.owner?.name || project.owner || "",
  };
}

export function issueDto(issue: any) {
  return {
    ...issue,
    startDate: toDateOnly(issue.startDate),
    dueDate: toDateOnly(issue.dueDate),
    estimatedHours: issue.estimatedHours == null ? null : toNumber(issue.estimatedHours),
    actualHours: issue.actualHours == null ? null : toNumber(issue.actualHours),
    deletedAt: toIsoDateTime(issue.deletedAt),
    createdAt: toIsoDateTime(issue.createdAt),
    updatedAt: toIsoDateTime(issue.updatedAt),
  };
}

export function projectMemberDto(member: any) {
  return {
    ...member,
    user: member.user ? sanitizeUserDto(member.user) : undefined,
    joinedAt: toIsoDateTime(member.joinedAt),
    createdAt: toIsoDateTime(member.createdAt),
    updatedAt: toIsoDateTime(member.updatedAt),
  };
}

export function milestoneDto(milestone: any) {
  return {
    ...milestone,
    dueDate: toDateOnly(milestone.dueDate),
    completedAt: toIsoDateTime(milestone.completedAt),
    createdAt: toIsoDateTime(milestone.createdAt),
    updatedAt: toIsoDateTime(milestone.updatedAt),
  };
}

export function timeEntryDto(entry: any) {
  return {
    ...entry,
    reporter: entry.user?.name || entry.reporter?.name || entry.reporter || "",
    workDate: toDateOnly(entry.workDate),
    spentDate: toDateOnly(entry.workDate),
    hours: toNumber(entry.hours),
    approvedAt: toIsoDateTime(entry.approvedAt),
    deletedAt: toIsoDateTime(entry.deletedAt),
    createdAt: toIsoDateTime(entry.createdAt),
    updatedAt: toIsoDateTime(entry.updatedAt),
  };
}

export function costRecordDto(record: any) {
  return {
    ...record,
    plannedPersonDays: toNumber(record.plannedPersonDays),
    standardHoursPerDay: toNumber(record.standardHoursPerDay),
    project: record.project ? projectDto(record.project) : undefined,
    deletedAt: toIsoDateTime(record.deletedAt),
    createdAt: toIsoDateTime(record.createdAt),
    updatedAt: toIsoDateTime(record.updatedAt),
  };
}

export function auditLogDto(log: any) {
  return {
    ...log,
    createdAt: toIsoDateTime(log.createdAt),
  };
}

export function parseDateOnly(value: unknown) {
  if (!value) return undefined;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function pagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function pageEnvelope<T>(rows: T[], totalCount: number, page: number, pageSize: number) {
  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
