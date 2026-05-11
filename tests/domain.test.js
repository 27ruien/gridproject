import assert from "node:assert/strict";
import { PROJECT_TEMPLATES, getTemplateById } from "../src/domain/template.js";
import { filterIssues } from "../src/domain/issue.js";
import { getNextStatus, ISSUE_STATUSES } from "../src/domain/workflow.js";
import { projectService } from "../src/services/projectService.js";
import { issueService } from "../src/services/issueService.js";
import { timeEntryService } from "../src/services/timeEntryService.js";
import { calculateMonthlyTarget, getMissingSubmitDates } from "../src/services/timesheetPolicyService.js";
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
});
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
assert.ok(summary.health > 0);

const commented = issueService.addComment(issue, "需要确认范围", "林夏");
assert.equal(commented.comments.length, 1);
assert.equal(commented.comments[0].text, "需要确认范围");

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
