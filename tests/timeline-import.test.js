import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { analyzeScheduleImport, parseScheduleText } from "../src/domain/scheduleImport.js";
import { issueService } from "../src/services/issueService.js";
import { projectService } from "../src/services/projectService.js";
import { parseScheduleFile } from "../src/services/scheduleFileService.js";

const timeline = [
  "阶段,事项名称,相关方,开始日期,结束日期,状态",
  "需求,需求确认,Kivisense,2026-07-03,2026-07-06,未完成",
  "需求,范围梳理,Kivisense,2026-07-01,2026-07-02,未完成",
  "程序开发,Web Development,Kivisense,2026-07-08,2026-07-15,未完成",
  "测试,UAT 测试,Kivisense,2026-07-20,2026-07-21,未完成",
  "测试,内部测试,Kivisense,2026-07-18,2026-07-19,未完成",
  "验收,UAT,Kivisense,2026-07-22,2026-07-23,未完成",
  "发布,Go Live,Kivisense,2026-07-25,2026-07-25,未完成",
  "客户协作,未匹配但保留,Kivisense,2026-07-05,2026-07-06,未完成",
  "设计,错误日期,Kivisense,2026-13-40,2天,未完成",
].join("\n");

const parsed = parseScheduleText(timeline);
assert.equal(parsed.tasks.length, 8);
assert.equal(parsed.warnings.length, 1);
assert.equal(parsed.unrecognizedTaskCount, 1);
assert.equal(parsed.keyDates.startDate.date, "2026-07-01");
assert.equal(parsed.keyDates.developmentDate.date, "2026-07-08");
assert.equal(parsed.keyDates.testDate.taskName, "内部测试");
assert.equal(parsed.keyDates.acceptanceDate.taskName, "UAT");
assert.equal(parsed.keyDates.releaseDate.taskName, "Go Live");
assert.equal(parsed.phases.find((phase) => phase.key === "requirements").tasks[0].name, "范围梳理");

const fallbackTest = parseScheduleText([
  "Model,事项名称,开始日期,结束日期",
  "Testing,系统测试,2026-08-02,2026-08-03",
].join("\n"));
assert.equal(fallbackTest.keyDates.testDate.date, "2026-08-03");

assert.equal(parseScheduleText("").errors[0].code, "EMPTY_FILE");
assert.equal(parseScheduleText("名称,责任人\n任务,Kivisense").errors[0].code, "HEADER_UNRECOGNIZED");
assert.equal(parseScheduleText("Model,事项名称,开始日期,结束日期\n设计,坏日期,not-a-date,2天").errors[0].code, "NO_VALID_TASKS");

const editedPreview = analyzeScheduleImport(parsed.tasks.map((task) => (
  task.name === "Go Live" ? { ...task, startDate: "2026-07-28" } : task
)));
assert.equal(editedPreview.keyDates.releaseDate.date, "2026-07-28");

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("项目 Timeline");
sheet.addRows([
  ["GridProject Timeline"],
  ["阶段", "事项名称", "相关方", "开始日期", "结束日期", "状态"],
  ["需求", "Excel 需求", "Kivisense", new Date(2026, 6, 1), new Date(2026, 6, 2), "未完成"],
]);
const workbookBuffer = await workbook.xlsx.writeBuffer();
const workbookResult = await parseScheduleFile({
  name: "timeline.xlsx",
  arrayBuffer: async () => workbookBuffer,
});
assert.equal(workbookResult.sheetName, "项目 Timeline");
assert.equal(workbookResult.tasks[0].name, "Excel 需求");

const badWorkbook = new ExcelJS.Workbook();
badWorkbook.addWorksheet("说明").addRow(["这里没有 Timeline 表头"]);
const badBuffer = await badWorkbook.xlsx.writeBuffer();
const badWorkbookResult = await parseScheduleFile({ name: "bad.xlsx", arrayBuffer: async () => badBuffer });
assert.equal(badWorkbookResult.errors[0].code, "HEADER_UNRECOGNIZED");

const project = projectService.createProject({ name: "导入测试", owner: "林夏", templateId: "agile" });
assert.deepEqual(project.executionTeams, []);
assert.equal(project.dueDate, "");
const firstImport = issueService.importSchedule(parsed, project, [], { behavior: "merge" });
assert.equal(firstImport.created.length, 8);

const manualIssue = issueService.createIssue({
  title: parsed.tasks[0].name,
  owner: "林夏",
  startDate: parsed.tasks[0].startDate,
  dueDate: parsed.tasks[0].dueDate,
}, project);
const mergeWithManual = issueService.importSchedule(parsed, project, [manualIssue], { behavior: "merge" });
assert.equal(mergeWithManual.updated.length, 0);
assert.equal(mergeWithManual.created.length, 8);

const editedImported = {
  ...firstImport.created[0],
  updatedAt: new Date(Date.parse(firstImport.created[0].scheduleImportedAt) + 5000).toISOString(),
};
const mergeEdited = issueService.importSchedule(parsed, project, [editedImported], { behavior: "merge" });
assert.equal(mergeEdited.skipped.length, 1);

const datesOnly = issueService.importSchedule(parsed, project, firstImport.created, { behavior: "dates-only" });
assert.equal(datesOnly.created.length, 0);
assert.equal(datesOnly.updated.length, 0);

const replacement = issueService.importSchedule(parsed, project, [...firstImport.created, manualIssue], { behavior: "replace" });
assert.equal(replacement.removed.length, firstImport.created.length);
assert.ok(!replacement.removed.some((issue) => issue.id === manualIssue.id));

console.log("timeline import tests passed");
