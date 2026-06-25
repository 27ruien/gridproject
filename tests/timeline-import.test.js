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
assert.deepEqual(workbookResult.missingRequiredFields, []);

const aliasWorkbook = new ExcelJS.Workbook();
const aliasSheet = aliasWorkbook.addWorksheet("别名表头");
aliasSheet.addRows([
  ["模块", "任务名称", "负责人", "开始日期", "结束日期或工作日数", "状态"],
  ["开发", "别名导入", "林夏", "2026-07-06", "3天", "进行中"],
]);
const aliasBuffer = await aliasWorkbook.xlsx.writeBuffer();
const aliasResult = await parseScheduleFile({ name: "alias.xlsx", arrayBuffer: async () => aliasBuffer });
assert.equal(aliasResult.tasks[0].model, "开发");
assert.equal(aliasResult.tasks[0].name, "别名导入");
assert.deepEqual(aliasResult.tasks[0].owners, ["林夏"]);
assert.equal(aliasResult.tasks[0].workdays, 3);

const horizontalWorkbook = new ExcelJS.Workbook();
const horizontalSheet = horizontalWorkbook.addWorksheet("Timeline");
horizontalSheet.addRow(["真实项目 Timeline"]);
horizontalSheet.addRow([]);
horizontalSheet.addRow(["工作内容", "事项", "弥知科技", "品牌方", "状态", "6月"]);
horizontalSheet.addRow(["", "", "", "", "", ...Array.from({ length: 20 }, (_, index) => index + 1)]);
horizontalSheet.addRow(["Proposal", "Requirement", "", "√", "完成"]);
horizontalSheet.addRow(["Development", "Frontend build", "√", "", "进行中"]);
horizontalSheet.addRow(["Launch", "Launch online", "√", "√", ""]);
horizontalSheet.getCell("F5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA9D08E" } };
["G6", "H6", "I6"].forEach((address) => {
  horizontalSheet.getCell(address).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8CBAD" } };
});
for (let column = 8; column <= 25; column += 1) {
  horizontalSheet.getCell(7, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };
}
const horizontalBuffer = await horizontalWorkbook.xlsx.writeBuffer();
const horizontalResult = await parseScheduleFile({
  name: "horizontal-timeline-2026.xlsx",
  arrayBuffer: async () => horizontalBuffer,
});
assert.equal(horizontalResult.sheetName, "Timeline");
assert.equal(horizontalResult.tasks.length, 3);
assert.equal(horizontalResult.tasks[0].model, "Proposal");
assert.equal(horizontalResult.tasks[0].name, "Requirement");
assert.deepEqual(horizontalResult.tasks[0].owners, ["Brands"]);
assert.equal(horizontalResult.tasks[0].startDate, "2026-06-01");
assert.equal(horizontalResult.tasks[0].dueDate, "2026-06-01");
assert.equal(horizontalResult.tasks[1].name, "Frontend build");
assert.deepEqual(horizontalResult.tasks[1].owners, ["Kivisense"]);
assert.equal(horizontalResult.tasks[1].startDate, "2026-06-02");
assert.equal(horizontalResult.tasks[1].dueDate, "2026-06-04");
assert.equal(horizontalResult.tasks[2].name, "Launch online");
assert.deepEqual(horizontalResult.tasks[2].owners, ["Kivisense", "Brands"]);
assert.equal(horizontalResult.tasks[2].startDate, "2026-06-03");
assert.equal(horizontalResult.tasks[2].dueDate, "2026-06-03");

const badWorkbook = new ExcelJS.Workbook();
badWorkbook.addWorksheet("说明").addRow(["这里没有 Timeline 表头"]);
const badBuffer = await badWorkbook.xlsx.writeBuffer();
const badWorkbookResult = await parseScheduleFile({ name: "bad.xlsx", arrayBuffer: async () => badBuffer });
assert.equal(badWorkbookResult.errors[0].code, "HEADER_UNRECOGNIZED");
assert.equal(badWorkbookResult.sheetName, "说明");
assert.ok(badWorkbookResult.detectedHeaders.includes("这里没有 Timeline 表头"));
assert.ok(badWorkbookResult.missingRequiredFields.includes("事项名称/任务名称"));

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
