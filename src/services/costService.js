import {
  COST_RECORD_STATUS,
  DEFAULT_STANDARD_HOURS_PER_DAY,
  calculateProjectCost,
} from "../domain/cost.js";
import { CostAccessPolicy } from "../server/policies/costAccessPolicy.js";

export const costService = {
  listCostRecords({ context, projects, users, records, timeEntries, issues, search = "", page = 1, pageSize = 10, sort = "updatedAt:desc" }) {
    const allowed = CostAccessPolicy.costRecordWhereForUser(context, projects);
    const keyword = search.trim().toLowerCase();
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const rows = records
      .filter((record) => record.status === COST_RECORD_STATUS.ACTIVE && allowed(record))
      .map((record) => {
        const project = projectMap.get(record.projectId);
        if (!project) return null;
        const summary = calculateProjectCost({
          project,
          record,
          timeEntries,
          issues,
          users,
        });
        return {
          ...record,
          project,
          summary,
        };
      })
      .filter((row) => row && (!keyword || `${row.project.name}${row.project.code || row.project.id}`.toLowerCase().includes(keyword)));

    const sorted = sortCostRows(rows, sort);
    const currentPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Number(pageSize) || 10);
    const start = (currentPage - 1) * normalizedPageSize;
    return {
      rows: sorted.slice(start, start + normalizedPageSize),
      totalCount: sorted.length,
      page: currentPage,
      pageSize: normalizedPageSize,
      totalPages: Math.max(1, Math.ceil(sorted.length / normalizedPageSize)),
    };
  },

  createCostRecord({ context, input, project, records, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限创建该项目成本管理记录。" };
    }

    if (records.some((record) => record.projectId === project.id && record.status === COST_RECORD_STATUS.ACTIVE && !record.deletedAt)) {
      return { ok: false, status: 409, reason: "duplicate", message: "该项目已有有效成本管理记录，请编辑现有记录。" };
    }

    const plannedPersonDays = normalizePositiveNumber(input.plannedPersonDays);
    if (!plannedPersonDays) {
      return { ok: false, status: 400, reason: "invalid-planned-person-days", message: "项目总人天必须填写且大于 0。" };
    }

    const standardHoursPerDay = normalizeStandardHours(input.standardHoursPerDay);
    if (!standardHoursPerDay) {
      return { ok: false, status: 400, reason: "invalid-standard-hours", message: "标准每日工时必须大于 0 且不超过 24。" };
    }

    const record = {
      id: `cost-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: context.organizationId,
      projectId: project.id,
      plannedPersonDays,
      standardHoursPerDay,
      status: COST_RECORD_STATUS.ACTIVE,
      notes: input.notes || "",
      createdById: context.userId,
      updatedById: context.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedById: null,
    };
    return {
      ok: true,
      record,
      auditLog: createAuditLog(context, "cost_record.create", record.id, { projectId: project.id, plannedPersonDays }),
    };
  },

  updateCostRecord({ context, record, project, patch, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限编辑该项目成本管理记录。" };
    }

    const nextPlannedPersonDays = patch.plannedPersonDays === undefined
      ? Number(record.plannedPersonDays)
      : normalizePositiveNumber(patch.plannedPersonDays);
    if (!nextPlannedPersonDays) {
      return { ok: false, status: 400, reason: "invalid-planned-person-days", message: "项目总人天必须大于 0。" };
    }

    const nextStandardHours = patch.standardHoursPerDay === undefined
      ? Number(record.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY)
      : normalizeStandardHours(patch.standardHoursPerDay);
    if (!nextStandardHours) {
      return { ok: false, status: 400, reason: "invalid-standard-hours", message: "标准每日工时必须大于 0 且不超过 24。" };
    }

    const updatedRecord = {
      ...record,
      plannedPersonDays: nextPlannedPersonDays,
      standardHoursPerDay: nextStandardHours,
      notes: patch.notes ?? record.notes,
      updatedById: context.userId,
      updatedAt: now,
    };

    return {
      ok: true,
      record: updatedRecord,
      auditLogs: [createAuditLog(context, "cost_record.update", record.id, { before: scrubComputedFields(record), after: scrubComputedFields(updatedRecord) })],
    };
  },

  deleteCostRecord({ context, record, project, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限删除该项目成本管理记录。" };
    }

    return {
      ok: true,
      record: {
        ...record,
        status: COST_RECORD_STATUS.ARCHIVED,
        updatedById: context.userId,
        updatedAt: now,
        deletedAt: now,
        deletedById: context.userId,
      },
      auditLog: createAuditLog(context, "cost_record.delete", record.id, { projectId: project.id }),
    };
  },
};

function sortCostRows(rows, sort) {
  if (sort === "burnRate:desc") return [...rows].sort((a, b) => Number(b.summary.personDayBurnRate) - Number(a.summary.personDayBurnRate));
  if (sort === "actualHours:desc") return [...rows].sort((a, b) => Number(b.summary.actualHours) - Number(a.summary.actualHours));
  if (sort === "remaining:asc") return [...rows].sort((a, b) => Number(a.summary.remainingPersonDays) - Number(b.summary.remainingPersonDays));
  if (sort === "project:asc") return [...rows].sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN"));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(2)) : 0;
}

function normalizeStandardHours(value) {
  const number = Number(value || DEFAULT_STANDARD_HOURS_PER_DAY);
  return Number.isFinite(number) && number > 0 && number <= 24 ? Number(number.toFixed(2)) : 0;
}

function scrubComputedFields(record) {
  const { actualHours, actualPersonDays, totalHours, totalPersonDays, ...persisted } = record;
  return persisted;
}

function createAuditLog(context, action, entityId, data) {
  return {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: context.organizationId,
    actorId: context.userId,
    action,
    entityType: "ProjectCostRecord",
    entityId,
    data,
    createdAt: new Date().toISOString(),
  };
}
