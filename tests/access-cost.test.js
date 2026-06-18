import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_USERS, ORGANIZATION_ID, buildAccessContext } from "../src/domain/access.js";
import { calculateProjectCost, escapeExcelText } from "../src/domain/cost.js";
import { ProjectAccessPolicy } from "../src/server/policies/projectAccessPolicy.js";
import { TimeEntryAccessPolicy } from "../src/server/policies/timeEntryAccessPolicy.js";
import { CostAccessPolicy } from "../src/server/policies/costAccessPolicy.js";
import { createProjectCommand, changeProjectOwnerCommand } from "../src/server/services/projectCommandService.js";
import { costService } from "../src/services/costService.js";
import { canUserLogin } from "../src/services/userService.js";
import { isPasswordHash } from "../src/services/passwordService.js";
import { stateService } from "../src/services/stateService.js";
import { CostCalculationService } from "../src/server/services/costCalculationService.js";
import { buildCostRawDataWorkbook, costExportFileName } from "../src/server/services/costExportService.js";
import { createCostRecordsController } from "../src/server/api/costRecordsController.js";
import { createUsersController } from "../src/server/api/usersController.js";

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
  costRecord("cost-crm", "crm", linxia.id, 20, 8),
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
  timeEntries,
  issues,
  users: DEMO_USERS,
});
assert.equal(summary.plannedPersonDays, 20);
assert.equal(summary.actualHours, 12);
assert.equal(summary.actualPersonDays, 1.5);
assert.equal(summary.remainingPersonDays, 18.5);
assert.equal(summary.personDayBurnRate, 7.5);
assert.equal(summary.rawData.length, 2, "DRAFT, REJECTED and deleted time entries are excluded");
assert.equal(summary.rawData[0].plannedPersonDays, 20);
assert.equal(summary.rawData[0].personDays, 1);
assert.equal(summary.people[0].userId, linxia.id);
assert.equal(summary.people[0].share, "66.7");

const weeklySummary = calculateProjectCost({
  project: projects[0],
  record: costRecords[0],
  timeEntries,
  issues,
  users: DEMO_USERS,
  filter: { weekStart: "2026-05-12" },
});
assert.equal(weeklySummary.plannedPersonDays, 20, "week filter does not change plannedPersonDays");
assert.equal(weeklySummary.actualHours, 12);
assert.equal(weeklySummary.actualPersonDays, 1.5);
const emptyWeekSummary = calculateProjectCost({
  project: projects[0],
  record: costRecords[0],
  timeEntries,
  issues,
  users: DEMO_USERS,
  filter: { weekStart: "2026-05-25" },
});
assert.equal(emptyWeekSummary.plannedPersonDays, 20);
assert.equal(emptyWeekSummary.actualHours, 0);
assert.equal(emptyWeekSummary.actualPersonDays, 0);

const costListForAdmin = costService.listCostRecords({
  context: adminContext,
  projects,
  users: DEMO_USERS,
  records: costRecords,
  timeEntries,
  issues,
});
assert.equal(costListForAdmin.totalCount, 1);
const missingPlanned = costService.createCostRecord({
  context: adminContext,
  input: { projectId: "mall" },
  project: projects[1],
  records: costRecords,
});
assert.equal(missingPlanned.status, 400);
const invalidPlanned = costService.createCostRecord({
  context: adminContext,
  input: { projectId: "mall", plannedPersonDays: 0 },
  project: projects[1],
  records: costRecords,
});
assert.equal(invalidPlanned.status, 400);
const duplicateCost = costService.createCostRecord({
  context: ownerContext,
  input: { projectId: "crm", plannedPersonDays: 24 },
  project: projects[0],
  records: costRecords,
});
assert.equal(duplicateCost.status, 409);
const createdCost = costService.createCostRecord({
  context: adminContext,
  input: { projectId: "mall", plannedPersonDays: 16 },
  project: projects[1],
  records: costRecords,
});
assert.equal(createdCost.ok, true);
assert.equal(createdCost.record.standardHoursPerDay, 8);

const updateCost = costService.updateCostRecord({
  context: ownerContext,
  record: costRecords[0],
  project: projects[0],
  patch: { plannedPersonDays: 10, standardHoursPerDay: 6, actualPersonDays: 999, notes: "改计划" },
});
assert.equal(updateCost.ok, true);
assert.equal(updateCost.record.plannedPersonDays, 10);
assert.equal(updateCost.record.standardHoursPerDay, 6);
assert.equal(updateCost.record.actualPersonDays, undefined, "actualPersonDays cannot be persisted from client patch");
assert.equal(updateCost.auditLogs.some((log) => log.action === "cost_record.update"), true);
const deletedCost = costService.deleteCostRecord({ context: ownerContext, record: costRecords[0], project: projects[0] });
assert.equal(deletedCost.record.deletedById, ownerContext.userId);
assert.equal(deletedCost.auditLog.action, "cost_record.delete");

const overrunSummary = calculateProjectCost({
  project: projects[0],
  record: costRecord("cost-overrun", "crm", linxia.id, 1, 8),
  timeEntries,
  issues,
  users: DEMO_USERS,
});
assert.equal(overrunSummary.remainingPersonDays, -0.5);
assert.equal(overrunSummary.personDayBurnRate, 150);
assert.equal(overrunSummary.people[0].hours, 8, "Top people are ordered by actual hours");

const calculationService = new CostCalculationService({
  projects,
  records: costRecords,
  timeEntries,
  issues,
  users: DEMO_USERS,
});
assert.equal(calculationService.calculateProjectCost("crm").actualPersonDays, 1.5);
assert.equal(calculationService.calculatePersonCost("crm", linxia.id).personDays, 1);
assert.equal(calculationService.getTopPeopleCosts("crm")[0].userId, linxia.id);
assert.equal(calculationService.getCostRawData("crm").length, 2);

const workbook = await buildCostRawDataWorkbook({ summary, rawData: summary.rawData });
const worksheet = workbook.getWorksheet("项目工时 Raw Data");
assert.equal(worksheet.rowCount, 3);
assert.equal(worksheet.getRow(1).values.includes("项目计划总人天"), true);
assert.equal(worksheet.getRow(1).values.includes("实际工时"), true);
assert.equal(costExportFileName(summary, "2026-06-18"), "CRM_CRM_项目工时RawData_2026-06-18.xlsx");
assert.equal(escapeExcelText("=SUM(A1:A2)"), "'=SUM(A1:A2)");

const repository = {
  projects: [...projects],
  users: DEMO_USERS.map((user) => ({ ...user })),
  projectMembers: [...projectMembers],
  costRecords: [...costRecords],
  timeEntries: [...timeEntries],
  issues: [...issues],
  sessions: [
    { id: "session-1", organizationId: ORGANIZATION_ID, userId: zhoucheng.id, tokenHash: "token", expiresAt: "2026-07-01T00:00:00.000Z", revokedAt: null },
  ],
  auditLogs: [],
};
const controller = createCostRecordsController(repository);
assert.equal((await controller.list({ user: admin, query: {} })).status, 200);
assert.equal((await controller.summary({ user: memberContext.user, params: { id: "cost-crm" }, query: {} })).status, 403);
const exportResult = await controller.export({ user: ownerContext.user, params: { id: "cost-crm" }, query: { weekStart: "2026-05-12" } });
assert.equal(exportResult.status, 200);
assert.ok(exportResult.body.buffer.byteLength > 0);
assert.equal(repository.auditLogs.some((log) => log.action === "cost_record.export"), true);

const usersController = createUsersController(repository);
const listUsers = await usersController.list({ user: admin, query: {} });
assert.equal(listUsers.status, 200, "ADMIN can list users");
assert.equal(listUsers.body.rows.some((user) => "passwordHash" in user), false, "API does not return passwordHash");
assert.equal((await usersController.list({ user: zhoucheng, query: {} })).status, 403, "MEMBER cannot list users");

const createdMember = await usersController.create({
  user: admin,
  body: {
    name: "新成员",
    email: "new.member@gridproject.local",
    initialPassword: "Password1234",
    confirmInitialPassword: "Password1234",
    role: "MEMBER",
    status: "ACTIVE",
  },
});
assert.equal(createdMember.status, 201);
assert.equal(createdMember.body.user.role, "MEMBER");
assert.equal("passwordHash" in createdMember.body.user, false);
const persistedMember = repository.users.find((user) => user.email === "new.member@gridproject.local");
assert.equal(isPasswordHash(persistedMember.passwordHash), true, "database stores Argon2id passwordHash");
assert.notEqual(persistedMember.passwordHash, "Password1234", "database does not store plaintext password");

const createdAdmin = await usersController.create({
  user: admin,
  body: {
    name: "备份管理员",
    email: "backup.admin@gridproject.local",
    initialPassword: "Password1234",
    confirmInitialPassword: "Password1234",
    role: "ADMIN",
    status: "ACTIVE",
  },
});
assert.equal(createdAdmin.status, 201, "ADMIN can create another ADMIN");
assert.equal((await usersController.create({ user: admin, body: { name: "重复", email: "backup.admin@gridproject.local", initialPassword: "Password1234", confirmInitialPassword: "Password1234" } })).status, 409);

const patchedMember = await usersController.patch({
  user: admin,
  params: { id: persistedMember.id },
  body: { name: "新成员 A", email: "new.member.a@gridproject.local", role: "MEMBER", status: "ACTIVE" },
});
assert.equal(patchedMember.status, 200);
assert.equal(patchedMember.body.user.name, "新成员 A");

const resetPassword = await usersController.resetPassword({
  user: admin,
  params: { id: zhoucheng.id },
  body: { newPassword: "Password5678", confirmNewPassword: "Password5678" },
});
assert.equal(resetPassword.status, 200);
assert.equal(repository.sessions.find((session) => session.id === "session-1").revokedAt !== null, true, "reset password invalidates old sessions");
assert.equal(repository.auditLogs.some((log) => log.action === "user.reset_password" && !JSON.stringify(log.data).includes("Password5678")), true);

assert.equal((await usersController.patch({ user: admin, params: { id: admin.id }, body: { status: "INACTIVE" } })).status, 400, "ADMIN cannot disable self");
const onlyAdminRepo = {
  ...repository,
  users: repository.users.filter((user) => user.id !== createdAdmin.body.user.id),
};
const onlyAdminController = createUsersController(onlyAdminRepo);
assert.equal((await onlyAdminController.patch({ user: admin, params: { id: admin.id }, body: { role: "MEMBER" } })).status, 400, "cannot remove last ACTIVE ADMIN");
assert.equal((await usersController.patch({ user: admin, params: { id: linxia.id }, body: { status: "INACTIVE" } })).status, 409, "project owner must transfer projects before deactivation");
const inactiveUser = { ...chen, status: "INACTIVE" };
assert.equal(canUserLogin(inactiveUser), false, "inactive users cannot login");
assert.equal(TimeEntryAccessPolicy.canCreateTimeEntry(buildAccessContext(inactiveUser), { userId: chen.id }, projects[0], projectMembers), false, "inactive users cannot report time");
assert.equal(timeEntries.find((item) => item.userId === linxia.id).reporter, "林夏", "historical time entries retain user display name");
assert.equal(repository.auditLogs.some((log) => log.action === "user.create"), true);
assert.equal(repository.auditLogs.some((log) => log.action === "user.update"), true);
assert.equal(repository.auditLogs.some((log) => log.action === "user.reset_password"), true);

let savedLocalState = "";
stateService.save({
  projects,
  issues,
  timeEntries,
  projectMembers,
  costRecords,
  sessions: repository.sessions,
  auditLogs: repository.auditLogs,
  users: repository.users,
  organization: { id: ORGANIZATION_ID, name: "GridProject Dev Organization" },
  trash: [],
  settings: { platformName: "KiviFlow", logoText: "K" },
}, {
  write(_key, value) {
    savedLocalState = value;
  },
});
assert.equal(savedLocalState.includes("passwordHash"), false, "front-end localStorage payload does not include passwordHash");
assert.equal(savedLocalState.includes("Password5678"), false, "front-end localStorage payload does not include plaintext password");

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
assert.equal(schema.includes("ProjectCostRate"), false);
assert.equal(schema.includes("currency"), false);
assert.equal(schema.includes("amountPerPersonDay"), false);

console.log("access, user and cost tests passed");

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

function costRecord(id, projectId, userId, plannedPersonDays, standardHoursPerDay) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    projectId,
    plannedPersonDays,
    standardHoursPerDay,
    status: "ACTIVE",
    notes: "",
    createdById: userId,
    updatedById: userId,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
  };
}
