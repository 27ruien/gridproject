import {
  COST_RECORD_STATUS,
  DEFAULT_COST_CURRENCY,
  DEFAULT_STANDARD_HOURS_PER_DAY,
  calculateProjectCost,
  getCurrentRate,
} from "../domain/cost.js";
import { CostAccessPolicy } from "../server/policies/costAccessPolicy.js";

export const costService = {
  listCostRecords({ context, projects, users, records, rates, timeEntries, issues, search = "", page = 1, pageSize = 10, sort = "updatedAt:desc" }) {
    const allowed = CostAccessPolicy.costRecordWhereForUser(context, projects);
    const keyword = search.trim().toLowerCase();
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const rows = records
      .filter((record) => record.status === COST_RECORD_STATUS.ACTIVE && allowed(record))
      .map((record) => {
        const project = projectMap.get(record.projectId);
        if (!project) return null;
        const projectRates = rates.filter((rate) => rate.projectCostRecordId === record.id);
        const summary = calculateProjectCost({
          project,
          record,
          rates: projectRates,
          timeEntries,
          issues,
          users,
        });
        return {
          ...record,
          project,
          summary,
          currentRate: getCurrentRate(projectRates),
        };
      })
      .filter((row) => row && (!keyword || `${row.project.name}${row.project.code || row.project.id}`.toLowerCase().includes(keyword)));

    const sorted = sortCostRows(rows, sort);
    const currentPage = Math.max(1, Number(page) || 1);
    const start = (currentPage - 1) * pageSize;
    return {
      rows: sorted.slice(start, start + pageSize),
      totalCount: sorted.length,
      page: currentPage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    };
  },

  createCostRecord({ context, input, project, records, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限创建该项目成本记录。" };
    }

    if (records.some((record) => record.projectId === project.id && record.status === COST_RECORD_STATUS.ACTIVE && !record.deletedAt)) {
      return { ok: false, status: 409, reason: "duplicate", message: "该项目已有有效成本管理记录，请编辑现有记录。" };
    }

    const record = {
      id: `cost-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: context.organizationId,
      projectId: project.id,
      currency: input.currency || DEFAULT_COST_CURRENCY,
      standardHoursPerDay: Number(input.standardHoursPerDay) || DEFAULT_STANDARD_HOURS_PER_DAY,
      status: COST_RECORD_STATUS.ACTIVE,
      notes: input.notes || "",
      createdById: context.userId,
      updatedById: context.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedById: null,
    };
    const rate = {
      id: `rate-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectCostRecordId: record.id,
      amountPerPersonDay: normalizeMoney(input.amountPerPersonDay),
      effectiveFrom: input.effectiveFrom || now.slice(0, 10),
      effectiveTo: null,
      createdById: context.userId,
      createdAt: now,
    };
    return {
      ok: true,
      record,
      rate,
      auditLog: createAuditLog(context, "cost_record.create", record.id, { projectId: project.id }),
    };
  },

  updateCostRecord({ context, record, project, rates, patch, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限编辑该项目成本记录。" };
    }

    const updatedRecord = {
      ...record,
      currency: patch.currency || record.currency,
      standardHoursPerDay: Number(patch.standardHoursPerDay) || record.standardHoursPerDay,
      notes: patch.notes ?? record.notes,
      updatedById: context.userId,
      updatedAt: now,
    };
    const auditLogs = [createAuditLog(context, "cost_record.update", record.id, { before: record, after: updatedRecord })];
    const nextRates = [...rates];

    if (patch.amountPerPersonDay !== undefined) {
      const current = getCurrentRate(rates, patch.effectiveFrom || now.slice(0, 10));
      const nextAmount = normalizeMoney(patch.amountPerPersonDay);
      if (!current || Number(current.amountPerPersonDay) !== Number(nextAmount)) {
        const effectiveFrom = patch.effectiveFrom || now.slice(0, 10);
        const currentIndex = nextRates.findIndex((rate) => rate.id === current?.id);
        if (currentIndex >= 0) nextRates[currentIndex] = { ...nextRates[currentIndex], effectiveTo: effectiveFrom };
        nextRates.push({
          id: `rate-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          projectCostRecordId: record.id,
          amountPerPersonDay: nextAmount,
          effectiveFrom,
          effectiveTo: null,
          createdById: context.userId,
          createdAt: now,
        });
        auditLogs.push(createAuditLog(context, "cost_rate.change", record.id, { effectiveFrom, amountPerPersonDay: nextAmount }));
      }
    }

    return {
      ok: true,
      record: updatedRecord,
      rates: nextRates,
      auditLogs,
    };
  },

  deleteCostRecord({ context, record, project, now = new Date().toISOString() }) {
    if (!CostAccessPolicy.canManageCost(context, project)) {
      return { ok: false, status: 403, reason: "forbidden", message: "没有权限删除该项目成本记录。" };
    }

    return {
      ok: true,
      record: {
        ...record,
        status: "ARCHIVED",
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
  if (sort === "cost:desc") return [...rows].sort((a, b) => Number(b.summary.totalCost) - Number(a.summary.totalCost));
  if (sort === "hours:desc") return [...rows].sort((a, b) => Number(b.summary.totalHours) - Number(a.summary.totalHours));
  if (sort === "project:asc") return [...rows].sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN"));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : 0;
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
