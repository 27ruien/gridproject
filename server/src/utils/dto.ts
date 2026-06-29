import type { Prisma } from "../../generated/prisma/client.js";
import { randomUUID } from "node:crypto";

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
  const { owner, createdBy, milestones, ...safeProject } = project;
  const config = toJsonObject(project.config);
  return {
    ...safeProject,
    templateId: String(config.templateId || "agile"),
    coverUrl: String(config.coverUrl || ""),
    executionTeams: Array.isArray(config.executionTeams) ? config.executionTeams.map(String) : [],
    commercialOwnerId: String(config.commercialOwnerId || ""),
    projectManagerId: String(config.projectManagerId || ""),
    designGroupId: String(config.designGroupId || ""),
    contentGroupId: String(config.contentGroupId || ""),
    effectsGroupId: String(config.effectsGroupId || ""),
    qaId: String(config.qaId || ""),
    milestones: Array.isArray(milestones) ? milestones.map(milestoneDto) : milestones,
    startDate: toDateOnly(project.startDate),
    dueDate: toDateOnly(project.dueDate),
    testDate: toDateOnly(project.testDate),
    acceptanceDate: toDateOnly(project.acceptanceDate),
    releaseDate: toDateOnly(project.releaseDate),
    deletedAt: toIsoDateTime(project.deletedAt),
    createdAt: toIsoDateTime(project.createdAt),
    updatedAt: toIsoDateTime(project.updatedAt),
    owner: owner?.name || project.owner || "",
  };
}

export function issueDto(issue: any) {
  const { comments, activities, scheduleData, ...safeIssue } = issue;
  const schedule = toJsonObject(scheduleData);
  return {
    ...safeIssue,
    owner: issue.owner || String(schedule.ownerLabel || ""),
    ownerLabel: String(schedule.ownerLabel || issue.owner || ""),
    parentIssueId: String(schedule.parentIssueId || ""),
    scheduleKey: String(schedule.scheduleKey || ""),
    scheduleModel: String(schedule.scheduleModel || ""),
    scheduleOwners: Array.isArray(schedule.scheduleOwners) ? schedule.scheduleOwners.map(String) : [],
    scheduleWorkdays: toNumber(schedule.scheduleWorkdays),
    scheduleImportedAt: String(schedule.scheduleImportedAt || ""),
    scheduleSource: String(schedule.scheduleSource || ""),
    comments: Array.isArray(comments) ? comments.map(issueCommentDto) : [],
    activity: Array.isArray(activities) ? activities.map(issueActivityDto) : [],
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
  const { user, ...safeMember } = member;
  return {
    ...safeMember,
    role: ["MANAGER", "MEMBER", "VIEWER"].includes(String(member.role)) ? member.role : "MEMBER",
    user: user ? minimalUserDto(user) : undefined,
    joinedAt: toIsoDateTime(member.joinedAt),
    createdAt: toIsoDateTime(member.createdAt),
    updatedAt: toIsoDateTime(member.updatedAt),
  };
}

export function milestoneDto(milestone: any) {
  return {
    ...milestone,
    name: milestone.name || milestone.title,
    window: milestone.window || "",
    focus: milestone.focus || "",
    dueDate: toDateOnly(milestone.dueDate),
    completedAt: toIsoDateTime(milestone.completedAt),
    deletedAt: toIsoDateTime(milestone.deletedAt),
    createdAt: toIsoDateTime(milestone.createdAt),
    updatedAt: toIsoDateTime(milestone.updatedAt),
  };
}

export function issueCommentDto(comment: any) {
  return {
    id: comment.id,
    issueId: comment.issueId,
    authorId: comment.authorId,
    actor: comment.authorName || comment.actor || "",
    text: comment.text,
    at: toIsoDateTime(comment.createdAt),
    deletedAt: toIsoDateTime(comment.deletedAt),
    createdAt: toIsoDateTime(comment.createdAt),
    updatedAt: toIsoDateTime(comment.updatedAt),
  };
}

export function issueActivityDto(activity: any) {
  return {
    id: activity.id,
    issueId: activity.issueId,
    actorId: activity.actorId,
    actor: activity.actorName || activity.actor || "",
    type: activity.type,
    text: activity.text,
    data: activity.data || undefined,
    at: toIsoDateTime(activity.createdAt),
    createdAt: toIsoDateTime(activity.createdAt),
  };
}

export function timeEntryDto(entry: any) {
  const { user, project, issue, ...safeEntry } = entry;
  const issueWasIncluded = Object.prototype.hasOwnProperty.call(entry, "issue");
  const issueIsConsistent = !issueWasIncluded || !issue || (
    issue.organizationId === entry.organizationId &&
    issue.projectId === entry.projectId &&
    !issue.deletedAt
  );
  return {
    ...safeEntry,
    issueId: issueIsConsistent ? entry.issueId : null,
    reporter: user?.name || entry.reporter?.name || entry.reporter || "",
    workDate: toDateOnly(entry.workDate),
    spentDate: toDateOnly(entry.workDate),
    hours: toNumber(entry.hours),
    note: entry.description || "",
    attachments: normalizeAttachments(entry.attachments),
    approvedAt: toIsoDateTime(entry.approvedAt),
    deletedAt: toIsoDateTime(entry.deletedAt),
    createdAt: toIsoDateTime(entry.createdAt),
    updatedAt: toIsoDateTime(entry.updatedAt),
  };
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 9).map((attachment) => {
    const item = attachment && typeof attachment === "object" ? attachment as Record<string, unknown> : {};
    const type = String(item.type || "");
    return {
      id: String(item.id || randomUUID()),
      name: String(item.name || "未命名附件"),
      size: toNumber(item.size),
      type,
      kind: item.kind === "image" || type.startsWith("image/") ? "image" : "file",
      dataUrl: String(item.dataUrl || ""),
      createdAt: item.createdAt ? toIsoDateTime(item.createdAt) : undefined,
    };
  });
}

export function costRecordDto(record: any) {
  const { project, createdBy, updatedBy, deletedBy, ...safeRecord } = record;
  return {
    ...safeRecord,
    plannedPersonDays: toNumber(record.plannedPersonDays),
    standardHoursPerDay: toNumber(record.standardHoursPerDay),
    project: project ? projectDto(project) : undefined,
    deletedAt: toIsoDateTime(record.deletedAt),
    createdAt: toIsoDateTime(record.createdAt),
    updatedAt: toIsoDateTime(record.updatedAt),
  };
}

export function minimalUserDto(user: any) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
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
