import { buildAccessContext } from "../../domain/access.js";
import { costService } from "../../services/costService.js";
import { CostAccessPolicy } from "../policies/costAccessPolicy.js";
import { CostCalculationService } from "../services/costCalculationService.js";
import { buildCostRawDataWorkbook, costExportFileName } from "../services/costExportService.js";

export function createCostRecordsController(repository) {
  return {
    async list(request) {
      const { context, requestId } = requireContext(request);
      const result = costService.listCostRecords({
        context,
        projects: repository.projects,
        users: repository.users,
        records: repository.costRecords,
        timeEntries: repository.timeEntries,
        issues: repository.issues,
        search: request.query.search || "",
        page: Number(request.query.page || 1),
        pageSize: Number(request.query.pageSize || 10),
        sort: request.query.sort || "updatedAt:desc",
      });
      return ok({ requestId, ...result });
    },

    async create(request) {
      const { context, requestId } = requireContext(request);
      const project = getProject(repository, request.body.projectId, context);
      if (!project) return notFound(requestId);
      const result = costService.createCostRecord({
        context,
        input: request.body,
        project,
        records: repository.costRecords,
      });
      if (!result.ok) return error(result.status, result.message, requestId);
      repository.costRecords.push(result.record);
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, record: result.record }, 201);
    },

    async get(request) {
      const { context, requestId } = requireContext(request);
      const record = getRecord(repository, request.params.id, context);
      if (!record) return notFound(requestId);
      const project = getProject(repository, record.projectId, context);
      if (!CostAccessPolicy.canViewCost(context, project)) return forbidden(requestId);
      return ok({ requestId, record });
    },

    async patch(request) {
      const { context, requestId } = requireContext(request);
      const record = getRecord(repository, request.params.id, context);
      if (!record) return notFound(requestId);
      const project = getProject(repository, record.projectId, context);
      const result = costService.updateCostRecord({ context, record, project, patch: request.body });
      if (!result.ok) return error(result.status, result.message, requestId);
      replaceById(repository.costRecords, result.record);
      repository.auditLogs.push(...result.auditLogs);
      return ok({ requestId, record: result.record });
    },

    async delete(request) {
      const { context, requestId } = requireContext(request);
      const record = getRecord(repository, request.params.id, context);
      if (!record) return notFound(requestId);
      const project = getProject(repository, record.projectId, context);
      const result = costService.deleteCostRecord({ context, record, project });
      if (!result.ok) return error(result.status, result.message, requestId);
      replaceById(repository.costRecords, result.record);
      repository.auditLogs.push(result.auditLog);
      return ok({ requestId, record: result.record });
    },

    async summary(request) {
      return costComputedResponse(repository, request, (service, projectId, query) => service.calculateProjectCost(projectId, query));
    },

    async people(request) {
      return costComputedResponse(repository, request, (service, projectId, query) => ({
        people: service.calculateProjectCost(projectId, query).people,
      }));
    },

    async rawData(request) {
      return costComputedResponse(repository, request, (service, projectId, query) => ({
        rows: service.getCostRawData(projectId, query),
      }));
    },

    async export(request) {
      const response = await costComputedResponse(repository, request, async (service, projectId, query) => {
        const summary = service.calculateProjectCost(projectId, query);
        const rawData = service.getCostRawData(projectId, query);
        const workbook = await buildCostRawDataWorkbook({ summary, rawData });
        const buffer = await workbook.xlsx.writeBuffer();
        repository.auditLogs.push(createAuditLog(request.context, "cost_record.export", request.params.id, { weekStart: query.weekStart || "" }));
        return {
          fileName: costExportFileName(summary),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer,
        };
      });
      return response;
    },
  };
}

async function costComputedResponse(repository, request, callback) {
  const { context, requestId } = requireContext(request);
  const record = getRecord(repository, request.params.id, context);
  if (!record) return notFound(requestId);
  const project = getProject(repository, record.projectId, context);
  if (!CostAccessPolicy.canViewCost(context, project)) return forbidden(requestId);
  const service = new CostCalculationService(repository);
  const payload = await callback(service, project.id, request.query || {});
  return ok({ requestId, ...payload });
}

function requireContext(request) {
  const user = request.user;
  const context = request.context || buildAccessContext(user, user.organizationId);
  request.context = context;
  return {
    context,
    requestId: request.requestId || cryptoRandomId(),
  };
}

function getProject(repository, projectId, context) {
  return repository.projects.find((project) => (
    project.id === projectId &&
    project.organizationId === context.organizationId &&
    !project.deletedAt
  )) || null;
}

function getRecord(repository, id, context) {
  return repository.costRecords.find((record) => (
    record.id === id &&
    record.organizationId === context.organizationId &&
    !record.deletedAt
  )) || null;
}

function replaceById(list, nextItem) {
  const index = list.findIndex((item) => item.id === nextItem.id);
  if (index >= 0) list.splice(index, 1, nextItem);
}

function ok(body, status = 200) {
  return { status, body };
}

function forbidden(requestId) {
  return error(403, "没有权限访问该资源。", requestId);
}

function notFound(requestId) {
  return error(404, "资源不存在。", requestId);
}

function error(status, message, requestId) {
  return {
    status,
    body: {
      requestId,
      error: {
        code: status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "REQUEST_ERROR",
        message,
      },
    },
  };
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

function cryptoRandomId() {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
