import { analyzeScheduleImport, hasRecognizableScheduleHeader, parseHorizontalTimelineRows, parseScheduleRows, parseScheduleText } from "../domain/scheduleImport.js";

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
  const workbook = await readWorkbook(buffer);
  if (!workbook.sheets.length) return fileError("SHEET_MISSING", "工作簿中不存在可读取的 Sheet。", fileName);

  const sheetDiagnostics = [];
  for (const worksheet of workbook.sheets) {
    const rows = worksheet.rows;
    const firstRow = rows[0] || [];
    const headerIndex = rows.findIndex((row) => hasRecognizableScheduleHeader(row));
    if (headerIndex >= 0) {
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

    const horizontal = parseHorizontalTimelineRows(rows, { cellMeta: worksheet.cellMeta, fileName });
    if (horizontal.tasks.length) {
      return {
        ...horizontal,
        fileName,
        sheetName: worksheet.name,
        detectedHeaders: detectedHorizontalHeaders(rows),
        missingRequiredFields: [],
        rowErrors: warningsToRowErrors(horizontal.warnings),
      };
    }
  }

  for (const worksheet of workbook.sheets) {
    const rows = worksheet.rows;
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

async function readWorkbook(buffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const styles = await readStyles(zip);
  const sheetRefs = await readSheetRefs(zip);
  const sheets = [];

  for (const sheetRef of sheetRefs) {
    const xml = await zip.file(sheetRef.path)?.async("string");
    if (!xml) continue;
    sheets.push(readSheet(xml, sheetRef.name, sharedStrings, styles));
  }
  return { sheets };
}

async function readSharedStrings(zip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => (
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1])).join("")
  ));
}

async function readStyles(zip) {
  const xml = await zip.file("xl/styles.xml")?.async("string");
  if (!xml) return { fills: [], cellFills: [] };
  const fillsSection = xml.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/)?.[1] || "";
  const fills = [...fillsSection.matchAll(/<fill\b[^>]*>([\s\S]*?)<\/fill>/g)].map((match) => {
    const fg = match[1].match(/<fgColor\b[^>]*(?:rgb="([^"]+)"|indexed="([^"]+)"|theme="([^"]+)")[^>]*\/?>/);
    return fg?.[1] || fg?.[2] || fg?.[3] || "";
  });
  const xfsSection = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || "";
  const cellFills = [...xfsSection.matchAll(/<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g)].map((match) => {
    const attrs = readXmlAttrs(match[1]);
    return fills[Number(attrs.fillId || 0)] || "";
  });
  return { fills, cellFills };
}

async function readSheetRefs(zip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) return [];

  const rels = Object.fromEntries([...relsXml.matchAll(/<Relationship\b([^>]+?)\/>/g)].map((match) => {
    const attrs = readXmlAttrs(match[1]);
    return [attrs.Id, normalizeSheetPath(attrs.Target)];
  }));

  return [...workbookXml.matchAll(/<sheet\b([^>]+?)\/>/g)].map((match) => {
    const attrs = readXmlAttrs(match[1]);
    const relationshipId = attrs["r:id"];
    return {
      name: decodeXml(attrs.name || "Sheet"),
      path: rels[relationshipId] || "",
    };
  }).filter((sheet) => sheet.path);
}

function readSheet(xml, name, sharedStrings, styles) {
  const rawRows = [];
  const cellMeta = {};
  let maxColumn = 0;

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = readXmlAttrs(rowMatch[1]);
    const rowNumber = Number(rowAttrs.r || rawRows.length + 1);
    const row = rawRows[rowNumber - 1] || [];

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = readXmlAttrs(cellMatch[1]);
      const ref = attrs.r || "";
      const colIndex = columnIndexFromRef(ref);
      if (!colIndex) continue;
      const text = cellValue(cellMatch[2] || "", attrs, sharedStrings);
      const styleIndex = Number(attrs.s || 0);
      const fill = styles.cellFills[styleIndex] || "";
      row[colIndex - 1] = text;
      cellMeta[`${rowNumber - 1}:${colIndex - 1}`] = { fill, styleIndex };
      maxColumn = Math.max(maxColumn, colIndex);
    }
    rawRows[rowNumber - 1] = row;
  }

  applyMerges(xml, rawRows, cellMeta);
  const rows = Array.from({ length: rawRows.length }, (_, rowIndex) => {
    const row = rawRows[rowIndex] || [];
    return Array.from({ length: maxColumn }, (_, index) => row[index] || "");
  });
  return { name, rows, cellMeta };
}

function applyMerges(xml, rows, cellMeta) {
  const refs = [...xml.matchAll(/<mergeCell\b[^>]*ref="([^"]+)"[^>]*\/>/g)].map((match) => match[1]);
  refs.forEach((ref) => {
    const [startRef, endRef] = ref.split(":");
    const start = cellPosition(startRef);
    const end = cellPosition(endRef);
    if (!start || !end) return;
    const masterValue = rows[start.row - 1]?.[start.col - 1] || "";
    const masterMeta = cellMeta[`${start.row - 1}:${start.col - 1}`] || {};
    for (let row = start.row; row <= end.row; row += 1) {
      rows[row - 1] ||= [];
      for (let col = start.col; col <= end.col; col += 1) {
        if (!rows[row - 1][col - 1]) rows[row - 1][col - 1] = masterValue;
        cellMeta[`${row - 1}:${col - 1}`] ||= masterMeta;
      }
    }
  });
}

function cellValue(innerXml, attrs, sharedStrings) {
  if (attrs.t === "inlineStr") {
    return [...innerXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
  }
  const value = decodeXml(innerXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || "");
  if (attrs.t === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function readXmlAttrs(source = "") {
  return Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1], decodeXml(match[2])]));
}

function decodeXml(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function normalizeSheetPath(target = "") {
  const path = target.replace(/^\/+/, "");
  return path.startsWith("xl/") ? path : `xl/${path}`;
}

function columnIndexFromRef(ref) {
  return cellPosition(ref)?.col || 0;
}

function cellPosition(ref = "") {
  const match = String(ref).match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const col = match[1].toUpperCase().split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
  return { col, row: Number(match[2]) };
}

function detectedHorizontalHeaders(rows) {
  const index = rows.findIndex((row, rowIndex) => rowIndex < rows.length - 1 && row.some(Boolean) && (rows[rowIndex + 1] || []).some((cell) => /^\d{1,2}$/.test(String(cell || ""))));
  return index >= 0 ? rows[index] : [];
}
