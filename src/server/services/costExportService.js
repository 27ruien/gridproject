import ExcelJS from "exceljs";
import { escapeExcelText, isoWeekLabel } from "../../domain/cost.js";

export async function buildCostRawDataWorkbook({ summary, rawData, generatedAt = new Date() }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GridProject";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  const sheet = workbook.addWorksheet("成本工时明细");

  sheet.columns = [
    { header: "项目代码", key: "projectCode", width: 14 },
    { header: "项目名称", key: "projectName", width: 24 },
    { header: "项目 Owner", key: "ownerName", width: 16 },
    { header: "人员姓名", key: "personName", width: 16 },
    { header: "人员邮箱", key: "personEmail", width: 28 },
    { header: "工作日期", key: "workDate", width: 14 },
    { header: "ISO 周", key: "isoWeek", width: 12 },
    { header: "事项编号", key: "issueCode", width: 14 },
    { header: "事项标题", key: "issueTitle", width: 30 },
    { header: "工时", key: "hours", width: 10 },
    { header: "标准工时/人天", key: "standardHoursPerDay", width: 16 },
    { header: "折算人天", key: "personDays", width: 12 },
    { header: "当日生效人天成本", key: "amountPerPersonDay", width: 20 },
    { header: "计算成本", key: "cost", width: 14 },
    { header: "币种", key: "currency", width: 10 },
    { header: "工时状态", key: "status", width: 12 },
    { header: "填报人", key: "reporter", width: 16 },
    { header: "工时描述", key: "note", width: 30 },
    { header: "创建时间", key: "createdAt", width: 22 },
    { header: "更新时间", key: "updatedAt", width: 22 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rawData.forEach((entry) => {
    sheet.addRow({
      projectCode: escapeExcelText(entry.projectCode),
      projectName: escapeExcelText(entry.projectName),
      ownerName: escapeExcelText(summary.ownerName),
      personName: escapeExcelText(entry.personName),
      personEmail: escapeExcelText(entry.personEmail),
      workDate: entry.workDate,
      isoWeek: entry.isoWeek || isoWeekLabel(entry.workDate),
      issueCode: escapeExcelText(entry.issueCode),
      issueTitle: escapeExcelText(entry.issueTitle),
      hours: entry.hours,
      standardHoursPerDay: entry.standardHoursPerDay || summary.standardHoursPerDay,
      personDays: entry.personDays,
      amountPerPersonDay: entry.amountPerPersonDay,
      cost: entry.cost,
      currency: entry.currency,
      status: entry.status,
      reporter: escapeExcelText(entry.reporter),
      note: escapeExcelText(entry.note),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  });

  return workbook;
}

export function costExportFileName(summary, today = new Date().toISOString().slice(0, 10)) {
  const safeProjectName = String(summary.projectName || "项目").replace(/[\\/:*?"<>|]/g, "_");
  const safeProjectCode = String(summary.projectCode || "PROJECT").replace(/[\\/:*?"<>|]/g, "_");
  return `${safeProjectCode}_${safeProjectName}_成本工时明细_${today}.xlsx`;
}

