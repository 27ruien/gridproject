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

  for (const worksheet of workbook.worksheets) {
    const rows = worksheetRows(worksheet);
    const headerIndex = rows.findIndex((row) => hasRecognizableScheduleHeader(row));
    if (headerIndex < 0) continue;
    const result = parseScheduleRows(rows.slice(headerIndex), { requireHeader: true });
    return { ...analyzeScheduleImport(result), fileName, sheetName: worksheet.name };
  }

  return fileError("HEADER_UNRECOGNIZED", "未在工作簿中找到可识别的 Timeline 表头。", fileName);
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
  };
}
