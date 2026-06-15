import assert from "node:assert/strict";
import { PROJECT_TEMPLATES, getTemplateById } from "../src/domain/template.js";
import { filterIssues } from "../src/domain/issue.js";
import { getIssueScheduleRisks, parseScheduleText } from "../src/domain/scheduleImport.js";
import { getNextStatus, ISSUE_STATUSES } from "../src/domain/workflow.js";
import { getProjectActivities, getProjectAlerts } from "../src/domain/projectInsight.js";
import { createProjectMilestones, summarizeMilestones } from "../src/domain/milestone.js";
import { projectService } from "../src/services/projectService.js";
import { issueService } from "../src/services/issueService.js";
import { timeEntryService } from "../src/services/timeEntryService.js";
import { calculateMonthlyTarget, getMissingSubmitDates } from "../src/services/timesheetPolicyService.js";
import { TRASH_RETENTION_DAYS, createTrashItem, isTrashRestorable } from "../src/domain/trash.js";
import { createStorageAdapter } from "../src/storage/storageAdapter.js";

const agile = getTemplateById("agile");
const waterfall = getTemplateById("waterfall");

assert.equal(PROJECT_TEMPLATES.length, 2);
assert.deepEqual(agile.workflow, ISSUE_STATUSES);
assert.ok(agile.views.includes("看板"));
assert.ok(waterfall.views.includes("阶段计划"));

const project = projectService.createProject({
  name: "测试项目",
  owner: "林夏",
  templateId: "agile",
  status: "开发阶段",
});
assert.equal(project.status, "开发阶段");
assert.equal(project.milestones.length, agile.milestones.length);
assert.equal(summarizeMilestones(project.milestones).totalCount, agile.milestones.length);
assert.equal(createProjectMilestones(waterfall, "2026-05-01")[0].dueDate, "2026-05-08");
assert.equal(projectService.updateProject(project, { status: "测试阶段" }).status, "测试阶段");
assert.equal(projectService.updateProject(project, {
  milestones: project.milestones.map((milestone, index) => index === 0 ? { ...milestone, status: "已完成" } : milestone),
}).milestones[0].status, "已完成");

const scheduleText = [
  "Model,事项名称,相关方,开始日期,工作日天数或结束日期,状态",
  "需求,Scope addendum,Kivisense,2026-06-18,4天,未完成",
  "设计,Creative Proposal,Kivisense,brand,2026-06-22,2026-07-03,未完成",
].join("\n");
const parsedSchedule = parseScheduleText(scheduleText);
assert.equal(parsedSchedule.tasks.length, 2);
assert.equal(parsedSchedule.tasks[0].model, "需求");
assert.equal(parsedSchedule.tasks[0].dueDate, "2026-06-24");
assert.deepEqual(parsedSchedule.tasks[1].owners, ["Kivisense", "Brands"]);
assert.equal(parsedSchedule.tasks[1].status, "未完成");
assert.equal(parseScheduleText("事项名称，Kivisense，开始日期 2026-06-01，周期 5天").tasks[0].dueDate, "2026-06-05");

const scheduleImport = issueService.importSchedule(scheduleText, project, []);
assert.equal(scheduleImport.created.length, 2);
assert.equal(scheduleImport.created[0].scheduleSource, "gridtimeline");
assert.equal(scheduleImport.created[0].estimatedHours, 32);
const scheduleMerge = issueService.importSchedule(scheduleText, project, scheduleImport.created);
assert.equal(scheduleMerge.created.length, 0);
assert.equal(scheduleMerge.updated.length, 2);
const delayedScheduleIssue = {
  ...scheduleImport.created[0],
  startDate: "2026-06-10",
  dueDate: "2026-06-14",
  status: "未开始",
};
assert.equal(getIssueScheduleRisks(delayedScheduleIssue, new Date("2026-06-16"))[0].label, "排期逾期 2 天");

const issue = issueService.createIssue({
  title: "测试事项",
  type: "需求",
  priority: "P1",
  owner: "林夏",
  creator: "周程",
  startDate: "2026-05-11",
  dueDate: "2026-05-18",
}, project);

assert.equal(issue.projectId, project.id);
assert.equal(issue.status, "未开始");
assert.equal(issue.creator, "周程");
assert.equal(issue.startDate, "2026-05-11");
assert.equal(getNextStatus(issue.status), "进行中");
assert.equal(filterIssues([issue], { keyword: "测试", owner: "林夏", creator: "周程", dateFrom: "2026-05-12", dateTo: "2026-05-20" }).length, 1);
assert.equal(filterIssues([issue], { owner: "韩越" }).length, 0);
assert.ok(agile.views.includes("甘特图"));

const advanced = issueService.advanceIssue(issue, agile);
assert.equal(advanced.status, "进行中");
assert.equal(advanced.activity[0].type, "status");

const summary = projectService.summarize(project, [advanced]);
assert.equal(summary.openCount, 1);
assert.equal(summary.progress, 0);
assert.equal(summary.actualHours, 0);
assert.equal(summary.estimatedHours, 8);
assert.equal(summary.remainingHours, 8);
assert.equal(summary.nextIssues.length, 1);
assert.equal(summary.milestoneSummary.totalCount, agile.milestones.length);
assert.ok(summary.health > 0);

const commented = issueService.addComment(issue, "需要确认范围", "林夏");
assert.equal(commented.comments.length, 1);
assert.equal(commented.comments[0].text, "需要确认范围");
assert.equal(getProjectActivities([commented])[0].issueTitle, "测试事项");

const overdueIssue = issueService.createIssue({
  title: "逾期风险",
  type: "风险",
  priority: "P0",
  owner: "林夏",
  dueDate: "2026-05-10",
}, project);
const alerts = getProjectAlerts([overdueIssue], new Date("2026-05-12"));
assert.equal(alerts[0].tone, "danger");
assert.equal(alerts[0].label, "逾期 2 天");

const timeEntry = timeEntryService.create({
  reporter: "林夏",
  spentDate: "2026-05-12",
  hours: 2,
  note: "补充验收口径",
}, issue, project);
assert.equal(timeEntry.issueId, issue.id);
assert.equal(timeEntry.projectId, project.id);
assert.equal(timeEntry.hours, 2);
const updatedTimeEntry = timeEntryService.update(timeEntry, { hours: 3.5, note: "补充联调工时" });
assert.equal(updatedTimeEntry.hours, 3.5);
assert.equal(updatedTimeEntry.note, "补充联调工时");
assert.ok(updatedTimeEntry.updatedAt);

assert.equal(calculateMonthlyTarget("2026-05"), 168);
assert.ok(getMissingSubmitDates([timeEntry], "林夏", "2026-05").includes("2026-05-11"));
assert.ok(!getMissingSubmitDates([timeEntry], "林夏", "2026-05").includes("2026-05-12"));

const trashItem = createTrashItem("issue", issue);
assert.equal(trashItem.type, "issue");
assert.ok(isTrashRestorable(trashItem));
assert.equal(TRASH_RETENTION_DAYS, 30);

const memory = new Map();
const adapter = createStorageAdapter({
  read: (key) => memory.get(key) ?? null,
  write: (key, value) => memory.set(key, value),
  remove: (key) => memory.delete(key),
});
adapter.write("k", "v");
assert.equal(adapter.read("k", "fallback"), "v");
adapter.remove("k");
assert.equal(adapter.read("k", "fallback"), "fallback");

console.log("domain tests passed");
