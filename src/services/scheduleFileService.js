import { analyzeScheduleImport, hasRecognizableScheduleHeader, parseScheduleRows, parseScheduleText } from "../domain/scheduleImport.js";

const TEXT_EXTENSIONS = new Set(["csv", "json", "txt", "tsv"]);
const WORKBOOK_EXTENSIONS = new Set(["xlsx", "xlsm"]);

export async function parseScheduleFile(file) {
  if (!file) return fileError("FILE_ERROR", "请选择 Timeline 文件。");
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";

  try {
    if (TEXT_EXTENSIONS.has(extension)) {
      return { ...parseScheduleText(await file.text()), fileName: file.name, sheetName: "" };
    }
    if (WORKBOOK_EXTENSIONS.has(extension)) {
      return parseWorkbook(await file.arrayBuffer(), file.name);
    }
    return fileError("FILE_ERROR", "文件格式不支持。请使用 XLSX、XLSM、CSV、TSV、JSON 或 TXT。", file.name);
  } catch (error) {
    return fileError("FILE_ERROR", `文件读取失败：${error.message || "无法解析文件"}`, file.name);
  }
}

async function parseWorkbook(buffer, fileName) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) return fileError("SHEET_MISSING", "工作簿中不存在可读取的 Sheet。", fileName);

  const sheetDiagnostics = [];
  for (const worksheet of workbook.worksheets) {
    const rows = worksheetRows(worksheet);
    const firstRow = rows[0] || [];
    const headerIndex = rows.findIndex((row) => hasRecognizableScheduleHeader(row));
    if (headerIndex < 0) continue;
    const result = parseScheduleRows(rows.slice(headerIndex), { requireHeader: true });
    return {
      ...analyzeScheduleImport(result),
      fileName,
      sheetName: worksheet.name,
      detectedHeaders: rows[headerIndex] || [],
      missingRequiredFields: missingRequiredHeaders(rows[headerIndex] || []),
      rowErrors: warningsToRowErrors(result.warnings),
    };
  }

  for (const worksheet of workbook.worksheets) {
    const rows = worksheetRows(worksheet);
    sheetDiagnostics.push({ sheetName: worksheet.name, detectedHeaders: rows[0] || [] });
  }

  return {
    ...fileError("HEADER_UNRECOGNIZED", "未在工作簿中找到可识别的 Timeline 表头。", fileName),
    sheetName: sheetDiagnostics[0]?.sheetName || "",
    detectedHeaders: sheetDiagnostics[0]?.detectedHeaders || [],
    missingRequiredFields: ["事项名称/任务名称", "开始日期", "结束日期或工作日数"],
    sheetDiagnostics,
  };
}

function worksheetRows(worksheet) {
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let index = 1; index <= Math.max(row.cellCount, row.actualCellCount); index += 1) {
      cells.push(cellText(row.getCell(index).value));
    }
    if (cells.some(Boolean)) rows.push(cells);
  });
  return rows;
}

function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return localDate(value);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
    if (value.result !== undefined) return cellText(value.result);
    if (value.text !== undefined) return String(value.text);
  }
  return String(value).trim();
}

function localDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fileError(code, message, fileName = "") {
  return {
    tasks: [],
    phases: [],
    warnings: [],
    errors: [{ code, message }],
    recognizedPhaseCount: 0,
    unrecognizedTaskCount: 0,
    keyDates: {},
    fileName,
    sheetName: "",
    detectedHeaders: [],
    missingRequiredFields: [],
    rowErrors: [],
  };
}

function warningsToRowErrors(warnings = []) {
  return warnings.map((warning) => {
    const match = String(warning).match(/第\s*(\d+)\s*行/);
    return { rowNumber: match ? Number(match[1]) : "", message: warning };
  });
}

function missingRequiredHeaders(headers = []) {
  const labels = headers.map((header) => String(header || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_\-/.()（）【】\[\]:：]+/g, ""));
  const hasAny = (aliases) => aliases.some((alias) => labels.includes(alias.normalize("NFKC").trim().toLowerCase().replace(/[\s_\-/.()（）【】\[\]:：]+/g, "")));
  const missing = [];
  if (!hasAny(["事项名称", "任务名称", "事项", "任务", "name", "task"])) missing.push("事项名称/任务名称");
  if (!hasAny(["开始日期", "开始时间", "start", "startdate"])) missing.push("开始日期");
  if (!hasAny(["结束日期", "截止日期", "工作日天数", "工作日数", "结束日期或工作日数", "工作日天数或结束日期", "duration", "workdays", "end", "enddate"])) {
    missing.push("结束日期或工作日数");
  }
  return missing;
}
