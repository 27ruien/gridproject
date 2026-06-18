import assert from "node:assert/strict";
import { DEMO_USERS, ORGANIZATION_ID, buildAccessContext } from "../src/domain/access.js";
import { calculateProjectCost, escapeExcelText } from "../src/domain/cost.js";
import { ProjectAccessPolicy } from "../src/server/policies/projectAccessPolicy.js";
import { TimeEntryAccessPolicy } from "../src/server/policies/timeEntryAccessPolicy.js";
import { CostAccessPolicy } from "../src/server/policies/costAccessPolicy.js";
import { createProjectCommand, changeProjectOwnerCommand } from "../src/server/services/projectCommandService.js";
import { costService } from "../src/services/costService.js";
import { CostCalculationService } from "../src/server/services/costCalculationService.js";
import { buildCostRawDataWorkbook, costExportFileName } from "../src/server/services/costExportService.js";
import { createCostRecordsController } from "../src/server/api/costRecordsController.js";

const admin = DEMO_USERS.find((user) => user.role === "ADMIN");
const linxia = DEMO_USERS.find((user) => user.id === "user-linxia");
const zhoucheng = DEMO_USERS.find((user) => user.id === "user-zhoucheng");
const hanyue = DEMO_USERS.find((user) => user.id === "user-hanyue");
const chen = DEMO_USERS.find((user) => user.id === "user-chenche");

const adminContext = buildAccessContext(admin);
const ownerContext = buildAccessContext(linxia);
const memberContext = buildAccessContext(zhoucheng);
const nonMemberContext = buildAccessContext(chen);

const projects = [
  project("crm", "CRM", linxia.id),
  project("mall", "MALL", hanyue.id),
  { ...project("other-org", "XORG", linxia.id), organizationId: "org-other" },
];
const projectMembers = [
  member("crm", linxia.id),
  member("crm", zhoucheng.id),
  member("mall", hanyue.id),
  member("mall", linxia.id),
];
const issues = [
  { id: "i1", projectId: "crm", code: "CRM-1", title: "批量分配线索" },
  { id: "i2", projectId: "crm", code: "CRM-2", title: "燃尽图接口" },
  { id: "i3", projectId: "mall", code: "MALL-1", title: "客户验收" },
];
const timeEntries = [
  entry("te1", "crm", "i1", linxia.id, "林夏", "2026-05-12", 8, "APPROVED"),
  entry("te2", "crm", "i2", zhoucheng.id, "周程", "2026-05-16", 4, "SUBMITTED"),
  entry("te3", "crm", "i2", zhoucheng.id, "周程", "2026-05-17", 3, "DRAFT"),
  entry("te4", "crm", "i2", zhoucheng.id, "周程", "2026-05-18", 2, "REJECTED"),
  { ...entry("te5", "crm", "i2", zhoucheng.id, "周程", "2026-05-19", 2, "APPROVED"), deletedAt: "2026-05-20T00:00:00.000Z" },
  entry("te6", "mall", "i3", hanyue.id, "韩越", "2026-05-16", 5, "APPROVED"),
  entry("te7", "mall", "i3", linxia.id, "林夏", "2026-05-16", 2, "APPROVED"),
];
const costRecords = [
  costRecord("cost-crm", "crm", linxia.id),
];
const costRates = [
  rate("rate-1", "cost-crm", 1000, "2026-05-01", "2026-05-15"),
  rate("rate-2", "cost-crm", 1600, "2026-05-15", null),
];

assert.equal(ProjectAccessPolicy.canViewProject(adminContext, projects[0]), true, "ADMIN can view projects");
assert.equal(ProjectAccessPolicy.canViewProject(memberContext, projects[0]), true, "ACTIVE MEMBER can view org projects");
assert.equal(ProjectAccessPolicy.canCreateProject(memberContext), true, "ACTIVE MEMBER can create projects");
assert.equal(ProjectAccessPolicy.canViewProjectBoard(adminContext, projects[0], projectMembers), true);
assert.equal(ProjectAccessPolicy.canViewProjectBoard(ownerContext, projects[0], projectMembers), true);
assert.equal(ProjectAccessPolicy.canViewProjectBoard(memberContext, projects[0], projectMembers), true);
assert.equal(ProjectAccessPolicy.canViewProjectBoard(nonMemberContext, projects[0], projectMembers), false);
assert.equal(ProjectAccessPolicy.canUpdateProject(memberContext, projects[1]), false);
assert.equal(ProjectAccessPolicy.canDeleteProject(ownerContext, projects[0]), true);
assert.equal(ProjectAccessPolicy.canDeleteProject(adminContext, projects[1]), true);
assert.deepEqual(ProjectAccessPolicy.projectWhereForUser(ownerContext), { organizationId: ORGANIZATION_ID, deletedAt: null });

const createdProject = createProjectCommand({
  context: memberContext,
  input: { id: "new", code: "NEW", name: "新项目" },
  users: DEMO_USERS,
});
assert.equal(createdProject.ok, true);
assert.equal(createdProject.project.ownerId, memberContext.userId);
assert.equal(createdProject.project.createdById, memberContext.userId);
assert.equal(createdProject.projectMember.userId, memberContext.userId);
assert.equal(createdProject.auditLog.action, "project.create");

const ownerChanged = changeProjectOwnerCommand({
  context: ownerContext,
  project: projects[0],
  newOwnerId: zhoucheng.id,
  users: DEMO_USERS,
  projectMembers,
});
assert.equal(ownerChanged.ok, true);
assert.equal(ownerChanged.project.ownerId, zhoucheng.id);
assert.equal(ownerChanged.projectMember.status, "ACTIVE");

const adminWhere = TimeEntryAccessPolicy.timeEntryWhereForUser(adminContext, projects);
assert.equal(timeEntries.filter(adminWhere).length, 6, "ADMIN sees all non-deleted org time entries");
const ownerWhere = TimeEntryAccessPolicy.timeEntryWhereForUser(ownerContext, projects);
assert.deepEqual(timeEntries.filter(ownerWhere).map((item) => item.id).sort(), ["te1", "te2", "te3", "te4", "te7"]);
const memberWhere = TimeEntryAccessPolicy.timeEntryWhereForUser(memberContext, projects);
assert.deepEqual(timeEntries.filter(memberWhere).map((item) => item.id).sort(), ["te2", "te3", "te4"]);
assert.equal(TimeEntryAccessPolicy.canCreateTimeEntry(memberContext, { userId: zhoucheng.id }, projects[0], projectMembers), true);
assert.equal(TimeEntryAccessPolicy.canCreateTimeEntry(nonMemberContext, { userId: chen.id }, projects[0], projectMembers), false);
assert.equal(TimeEntryAccessPolicy.canEditTimeEntry(memberContext, timeEntries[2]), true);
assert.equal(TimeEntryAccessPolicy.canEditTimeEntry(memberContext, timeEntries[1]), false);
assert.equal(TimeEntryAccessPolicy.canApproveTimeEntry(ownerContext, timeEntries[1], projects[0]), true);
assert.equal(TimeEntryAccessPolicy.canApproveTimeEntry(memberContext, timeEntries[1], projects[0]), false);

assert.equal(CostAccessPolicy.canViewCost(adminContext, projects[0]), true);
assert.equal(CostAccessPolicy.canManageCost(ownerContext, projects[0]), true);
assert.equal(CostAccessPolicy.canViewCost(memberContext, projects[0]), false);
assert.equal(CostAccessPolicy.canExportCost(memberContext, projects[0]), false);
assert.equal(CostAccessPolicy.canViewCost(ownerContext, projects[2]), false, "cost queries are organization-scoped");

const summary = calculateProjectCost({
  project: projects[0],
  record: costRecords[0],
  rates: costRates,
  timeEntries,
  issues,
  users: DEMO_USERS,
});
assert.equal(summary.totalHours, 12);
assert.equal(summary.totalPersonDays, 1.5);
assert.equal(summary.totalCost, "1800.00");
assert.equal(summary.rawData.length, 2, "DRAFT, REJECTED and deleted time entries are excluded");
assert.equal(summary.rawData[0].amountPerPersonDay, "1000.00");
assert.equal(summary.rawData[1].amountPerPersonDay, "1600.00", "historical rate is selected by work date");
assert.equal(summary.people[0].cost, "1000.00");

const weeklySummary = calculateProjectCost({
  project: projects[0],
  record: costRecords[0],
  rates: costRates,
  timeEntries,
  issues,
  users: DEMO_USERS,
  filter: { weekStart: "2026-05-12" },
});
assert.equal(weeklySummary.totalCost, "1800.00");
const emptyWeekSummary = calculateProjectCost({
  project: projects[0],
  record: costRecords[0],
  rates: costRates,
  timeEntries,
  issues,
  users: DEMO_USERS,
  filter: { weekStart: "2026-05-25" },
});
assert.equal(emptyWeekSummary.totalCost, "0.00");

const costListForAdmin = costService.listCostRecords({
  context: adminContext,
  projects,
  users: DEMO_USERS,
  records: costRecords,
  rates: costRates,
  timeEntries,
  issues,
});
assert.equal(costListForAdmin.totalCount, 1);
const duplicateCost = costService.createCostRecord({
  context: ownerContext,
  input: { projectId: "crm", amountPerPersonDay: 1800 },
  project: projects[0],
  records: costRecords,
});
assert.equal(duplicateCost.status, 409);

const updateCost = costService.updateCostRecord({
  context: ownerContext,
  record: costRecords[0],
  project: projects[0],
  rates: costRates,
  patch: { amountPerPersonDay: 2000, effectiveFrom: "2026-06-01", notes: "六月调价" },
});
assert.equal(updateCost.ok, true);
assert.equal(updateCost.rates.at(-2).effectiveTo, "2026-06-01");
assert.equal(updateCost.auditLogs.some((log) => log.action === "cost_rate.change"), true);
const deletedCost = costService.deleteCostRecord({ context: ownerContext, record: costRecords[0], project: projects[0] });
assert.equal(deletedCost.record.deletedById, ownerContext.userId);
assert.equal(deletedCost.auditLog.action, "cost_record.delete");

const calculationService = new CostCalculationService({
  projects,
  records: costRecords,
  rates: costRates,
  timeEntries,
  issues,
  users: DEMO_USERS,
});
assert.equal(calculationService.calculateProjectCost("crm").totalCost, "1800.00");
assert.equal(calculationService.calculatePersonCost("crm", linxia.id).cost, "1000.00");
assert.equal(calculationService.getTopPeopleCosts("crm")[0].userId, linxia.id);
assert.equal(calculationService.getCostRawData("crm").length, 2);

const workbook = await buildCostRawDataWorkbook({ summary, rawData: summary.rawData });
const worksheet = workbook.getWorksheet("成本工时明细");
assert.equal(worksheet.rowCount, 3);
assert.equal(costExportFileName(summary, "2026-06-18"), "CRM_CRM_成本工时明细_2026-06-18.xlsx");
assert.equal(escapeExcelText("=SUM(A1:A2)"), "'=SUM(A1:A2)");

const repository = {
  projects: [...projects],
  users: DEMO_USERS,
  costRecords: [...costRecords],
  costRates: [...costRates],
  timeEntries: [...timeEntries],
  issues: [...issues],
  auditLogs: [],
};
const controller = createCostRecordsController(repository);
assert.equal((await controller.list({ user: admin, query: {} })).status, 200);
assert.equal((await controller.summary({ user: memberContext.user, params: { id: "cost-crm" }, query: {} })).status, 403);
const exportResult = await controller.export({ user: ownerContext.user, params: { id: "cost-crm" }, query: { weekStart: "2026-05-12" } });
assert.equal(exportResult.status, 200);
assert.ok(exportResult.body.buffer.byteLength > 0);
assert.equal(repository.auditLogs.some((log) => log.action === "cost_record.export"), true);

console.log("access and cost tests passed");

function project(id, code, ownerId) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    name: code,
    code,
    ownerId,
    createdById: ownerId,
    deletedAt: null,
  };
}

function member(projectId, userId) {
  return {
    id: `pm-${projectId}-${userId}`,
    organizationId: ORGANIZATION_ID,
    projectId,
    userId,
    status: "ACTIVE",
  };
}

function entry(id, projectId, issueId, userId, reporter, workDate, hours, status) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    projectId,
    issueId,
    userId,
    reporter,
    workDate,
    spentDate: workDate,
    hours,
    status,
    note: `${id} note`,
    createdAt: `${workDate}T09:00:00.000Z`,
    updatedAt: `${workDate}T10:00:00.000Z`,
    deletedAt: null,
  };
}

function costRecord(id, projectId, userId) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    projectId,
    currency: "CNY",
    standardHoursPerDay: 8,
    status: "ACTIVE",
    notes: "",
    createdById: userId,
    updatedById: userId,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
  };
}

function rate(id, projectCostRecordId, amountPerPersonDay, effectiveFrom, effectiveTo) {
  return {
    id,
    projectCostRecordId,
    amountPerPersonDay,
    effectiveFrom,
    effectiveTo,
    createdById: linxia.id,
    createdAt: `${effectiveFrom}T00:00:00.000Z`,
  };
}

