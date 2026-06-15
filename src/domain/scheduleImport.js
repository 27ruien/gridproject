import { isClosedStatus } from "./workflow.js";

export const TIMELINE_IMPORT_FIELDS = [
  "Model",
  "事项名称",
  "相关方",
  "开始日期",
  "工作日天数或结束日期",
  "状态",
  "分类",
  "颜色",
];

const FIELD_ALIASES = {
  model: ["model", "module", "工作内容", "模块", "阶段"],
  name: ["name", "task", "description", "事项", "事项名称", "任务", "任务名称"],
  owners: ["owners", "owner", "相关方", "参与方", "责任人", "负责人"],
  start: ["start", "startdate", "开始", "开始日期", "开始时间"],
  end: ["end", "enddate", "结束", "结束日期", "截止日期"],
  workdays: ["workdays", "duration", "days", "周期", "天数", "工作日", "工作日天数"],
  durationOrEnd: ["工作日天数或结束日期", "周期或结束日期", "durationorend"],
  status: ["status", "状态", "完成状态"],
  category: ["category", "类别", "分类", "类型"],
  color: ["color", "颜色", "色值"],
};

const CHINA_PUBLIC_HOLIDAYS_2026 = new Set([
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
]);

const CHINA_ADJUSTED_WORKDAYS_2026 = new Set([
  "2026-01-04",
  "2026-02-14", "2026-02-28",
  "2026-05-09",
  "2026-09-20", "2026-10-10",
]);

export function parseScheduleText(source) {
  const text = String(source || "").trim();
  if (!text) return { tasks: [], warnings: ["排期内容为空"] };

  const jsonResult = parseJsonSchedule(text);
  if (jsonResult) return jsonResult;

  const warnings = [];
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!rows.length) return { tasks: [], warnings: ["没有可解析的排期行"] };

  const table = rows.map(splitDelimitedRow).filter((cells) => cells.some(Boolean));
  const headerMap = buildHeaderMap(table[0] || []);
  const hasHeader = isImportHeader(headerMap);
  const bodyRows = hasHeader ? table.slice(1) : table;

  const tasks = bodyRows.flatMap((cells, index) => {
    try {
      const raw = hasHeader ? parseHeaderRow(cells, headerMap) : parsePositionalRow(cells);
      return [normalizeScheduleTask(raw, index + 1)];
    } catch (error) {
      warnings.push(`第 ${index + 1} 行未导入：${error.message}`);
      return [];
    }
  });

  return { tasks, warnings };
}

export function createScheduleIssueInput(task, project, template) {
  const issueType = inferIssueType(task, template);
  const owner = inferIssueOwner(task, project);
  const priority = inferPriority(task);
  const status = mapTimelineStatus(task.status);

  return {
    type: issueType,
    title: task.name,
    status,
    owner,
    creator: project.owner,
    priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedHours: Math.max(1, task.workdays) * 8,
    actualHours: 0,
    next: buildNextStep(task, status),
    description: buildDescription(task),
    scheduleKey: buildScheduleKey(project.id, task),
    scheduleModel: task.model,
    scheduleOwners: task.owners,
    scheduleWorkdays: task.workdays,
    scheduleImportedAt: new Date().toISOString(),
    scheduleSource: "gridtimeline",
  };
}

export function buildScheduleKey(projectId, task) {
  return [projectId, task.model || "未分类", task.name]
    .map((part) => String(part || "").trim().toLowerCase().replace(/\s+/g, "-"))
    .join(":");
}

export function getIssueScheduleRisks(issue, today = new Date()) {
  if (!issue?.scheduleKey || isClosedStatus(issue.status)) return [];

  const todayStart = startOfDay(today);
  const signals = [];
  const startDays = daysUntil(issue.startDate, todayStart);
  const dueDays = daysUntil(issue.dueDate, todayStart);

  if (Number.isFinite(dueDays) && dueDays < 0) {
    signals.push({
      tone: "danger",
      rank: 0,
      label: `排期逾期 ${Math.abs(dueDays)} 天`,
      reason: `${issue.scheduleModel || "排期"} 已超过计划截止日期，需要调整责任人、范围或交付窗口。`,
    });
  }

  if (issue.status === "未开始" && Number.isFinite(startDays) && startDays < 0 && (!Number.isFinite(dueDays) || dueDays >= 0)) {
    signals.push({
      tone: "warn",
      rank: 1,
      label: `应启动未启动 ${Math.abs(startDays)} 天`,
      reason: `${issue.scheduleModel || "排期"} 已到计划执行期，但事项仍未开始。`,
    });
  }

  if (Number.isFinite(dueDays) && dueDays >= 0 && dueDays <= 3 && issue.status !== "进行中") {
    signals.push({
      tone: "info",
      rank: 2,
      label: dueDays === 0 ? "排期今天截止" : `排期 ${dueDays} 天后截止`,
      reason: "临近计划截止日，建议确认剩余工作和验收口径。",
    });
  }

  if ((Number(issue.scheduleWorkdays) || 0) >= 10 && issue.status === "未开始" && Number.isFinite(startDays) && startDays <= 3) {
    signals.push({
      tone: "info",
      rank: 3,
      label: "长周期排期",
      reason: "该事项周期较长，适合拆分中间交付点或里程碑检查点。",
    });
  }

  return signals.sort((a, b) => a.rank - b.rank);
}

function parseJsonSchedule(text) {
  try {
    const payload = JSON.parse(text);
    const rawTasks = Array.isArray(payload) ? payload : payload.tasks;
    if (!Array.isArray(rawTasks)) return null;

    const warnings = [];
    const tasks = rawTasks.flatMap((raw, index) => {
      try {
        return [normalizeScheduleTask(normalizeJsonRow(raw), index + 1)];
      } catch (error) {
        warnings.push(`第 ${index + 1} 行未导入：${error.message}`);
        return [];
      }
    });
    return { tasks, warnings };
  } catch {
    return null;
  }
}

function normalizeJsonRow(raw) {
  return {
    model: raw.model || raw.module || raw["工作内容"] || raw["模块"] || "",
    name: raw.name || raw.task || raw["事项名称"] || raw["任务名称"] || raw["事项"] || "",
    owners: raw.owners || raw.owner || raw["相关方"] || raw["责任人"] || "",
    start: raw.start || raw.start_date || raw.startDate || raw["开始日期"],
    end: raw.end || raw.end_date || raw.endDate || raw["结束日期"] || raw["截止日期"],
    workdays: raw.workdays || raw.duration || raw["工作日"] || raw["工作日天数"] || raw["周期"] || raw["天数"],
    status: raw.status || raw["状态"],
    category: raw.category || raw["分类"] || raw["类别"] || "",
    color: raw.color || raw["颜色"] || "",
  };
}

function splitDelimitedRow(line) {
  const normalized = line.replace(/\s+\/\s+/g, ",");
  const cells = [];
  let current = "";
  let quoted = false;

  for (const char of normalized) {
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && [",", "，", "\t", ";", "；", "|"].includes(char)) {
      cells.push(cleanCell(current));
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(cleanCell(current));

  return cells.filter((cell) => cell !== "");
}

function cleanCell(value) {
  return String(value || "").trim().replace(/^["'“”]|["'“”]$/g, "");
}

function buildHeaderMap(cells) {
  return cells.reduce((map, cell, index) => {
    const key = resolveFieldKey(cell);
    if (key) map[key] = index;
    return map;
  }, {});
}

function isImportHeader(headerMap) {
  return headerMap.name !== undefined && (headerMap.start !== undefined || headerMap.durationOrEnd !== undefined);
}

function resolveFieldKey(label) {
  const normalized = normalizeLabel(label);
  return Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.map(normalizeLabel).includes(normalized))?.[0] || "";
}

function normalizeLabel(label) {
  return String(label || "").trim().toLowerCase().replace(/[\s_/-]/g, "");
}

function parseHeaderRow(cells, headerMap) {
  const raw = Object.entries(headerMap).reduce((result, [key, index]) => ({
    ...result,
    [key]: cells[index] || "",
  }), {});
  const dateIndex = cells.findIndex((cell) => Boolean(extractDate(cell)));

  if (headerMap.owners !== undefined && dateIndex > headerMap.owners) {
    raw.owners = cells.slice(headerMap.owners, dateIndex);
    raw.start = cells[dateIndex];
    if (headerMap.durationOrEnd !== undefined) {
      raw.durationOrEnd = cells[dateIndex + 1] || "";
      raw.status = cells[dateIndex + 2] || raw.status || "";
      raw.category = cells[dateIndex + 3] || raw.category || "";
      raw.color = cells[dateIndex + 4] || raw.color || "";
    }
  }

  if (raw.durationOrEnd) {
    if (extractDate(raw.durationOrEnd)) raw.end = raw.durationOrEnd;
    else raw.workdays = raw.durationOrEnd;
  }

  return raw;
}

function parsePositionalRow(cells) {
  const dateIndex = cells.findIndex((cell) => Boolean(extractDate(cell)));
  if (dateIndex < 0) throw new Error("缺少开始日期");

  const hasModel = dateIndex >= 3;
  const durationOrEnd = cells[dateIndex + 1] || "";

  return {
    model: hasModel ? stripListMarker(cells[0]) : "",
    name: hasModel ? cells[1] : stripListMarker(cells[0]),
    owners: hasModel ? cells.slice(2, dateIndex) : cells.slice(1, dateIndex),
    start: cells[dateIndex],
    end: extractDate(durationOrEnd) ? durationOrEnd : "",
    workdays: extractDate(durationOrEnd) ? "" : durationOrEnd,
    status: cells.slice(dateIndex + 2).find(looksLikeStatus) || "",
    category: cells.slice(dateIndex + 2).find((cell) => !looksLikeStatus(cell)) || "",
  };
}

function normalizeScheduleTask(raw, index) {
  const name = cleanCell(raw.name);
  if (!name) throw new Error("缺少事项名称");

  const startDate = nextWorkday(parseDateIso(extractDate(raw.start) || raw.start));
  const endInput = extractDate(raw.end);
  const durationText = raw.workdays || raw.duration;
  const duration = extractDuration(durationText);
  let dueDate = "";
  let workdays = 0;

  if (endInput) {
    dueDate = nextWorkday(parseDateIso(endInput));
    if (dueDate < startDate) throw new Error("结束日期早于开始日期");
    workdays = countWorkdays(startDate, dueDate);
  } else if (duration) {
    workdays = duration;
    dueDate = addWorkdays(startDate, duration);
  } else {
    throw new Error("缺少工作日天数或结束日期");
  }

  return {
    model: cleanCell(raw.model || "") || "未分类",
    name,
    owners: normalizeOwners(raw.owners),
    startDate: formatDate(startDate),
    dueDate: formatDate(dueDate),
    workdays,
    status: raw.status || "incomplete",
    category: cleanCell(raw.category || ""),
    color: cleanCell(raw.color || ""),
    originalIndex: index,
  };
}

function normalizeOwners(owners) {
  const values = Array.isArray(owners) ? owners : String(owners || "").split(/[,，/+&、\s]+/);
  const normalized = values.map((owner) => {
    const token = String(owner || "").trim();
    const lower = token.toLowerCase();
    if (["kivisense", "kv", "我方"].includes(lower)) return "Kivisense";
    if (["brand", "brands", "client", "客户", "品牌方"].includes(lower)) return "Brands";
    return token;
  }).filter(Boolean);

  return [...new Set(normalized)];
}

function parseDateIso(value) {
  const dateText = extractDate(value);
  if (!dateText) throw new Error("日期格式不支持");
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function extractDate(value) {
  const match = String(value || "").match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractDuration(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function looksLikeStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["未完成", "pending", "todo", "not done", "完成", "已完成", "done", "complete", "√", "进行中", "in progress"].includes(text);
}

function stripListMarker(value) {
  return String(value || "").trim().replace(/^\d+[\s.)、-]+/, "");
}

function mapTimelineStatus(status) {
  const text = String(status || "").trim().toLowerCase();
  if (["完成", "已完成", "done", "complete", "√"].includes(text)) return "已完成";
  if (["进行中", "in progress", "doing"].includes(text)) return "进行中";
  return "未开始";
}

function inferIssueType(task, template) {
  const text = `${task.model} ${task.name} ${task.category}`.toLowerCase();
  if (/(risk|风险|延期|阻塞|block)/i.test(text) && template.issueTypes.includes("风险")) return "风险";
  if (/(验收|uat|testing|test)/i.test(text) && template.issueTypes.includes("验收项")) return "验收项";
  if (/(交付物|deliverable|proposal|quotation)/i.test(text) && template.issueTypes.includes("交付物")) return "交付物";
  return template.issueTypes.includes("任务") ? "任务" : template.defaultIssueType;
}

function inferPriority(task) {
  const text = `${task.model} ${task.name} ${task.category}`.toLowerCase();
  if (/(risk|风险|延期|阻塞|privacy|compliance|legal)/i.test(text)) return "P1";
  if ((Number(task.workdays) || 0) >= 10) return "P1";
  return "P2";
}

function inferIssueOwner(task, project) {
  if (!task.owners.length) return project.owner;
  if (task.owners.includes("Kivisense")) return project.owner;
  if (task.owners.includes("Brands")) return "品牌方";
  return task.owners[0];
}

function buildNextStep(task, status) {
  if (status === "已完成") return "确认交付物归档和验收记录";
  return `${task.model || "排期"}：按 ${task.dueDate} 前完成并同步风险变化`;
}

function buildDescription(task) {
  return [
    `排期导入模型：${task.model || "未分类"}`,
    `排期相关方：${task.owners.length ? task.owners.join("、") : "未标注"}`,
    `排期周期：${task.startDate} 至 ${task.dueDate}，${task.workdays} 个工作日`,
    task.category ? `分类：${task.category}` : "",
    task.color ? `颜色：${task.color}` : "",
  ].filter(Boolean).join("\n");
}

function isChinaWorkday(date) {
  const key = formatDate(date);
  if (CHINA_ADJUSTED_WORKDAYS_2026.has(key)) return true;
  if (CHINA_PUBLIC_HOLIDAYS_2026.has(key)) return false;
  return date.getDay() !== 0 && date.getDay() !== 6;
}

function nextWorkday(date) {
  const next = new Date(date);
  while (!isChinaWorkday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function addWorkdays(start, workdays) {
  let current = nextWorkday(start);
  let remaining = Math.max(1, workdays) - 1;
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    if (isChinaWorkday(current)) remaining -= 1;
  }
  return current;
}

function countWorkdays(start, end) {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isChinaWorkday(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysUntil(dateValue, todayStart) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const date = startOfDay(new Date(dateValue));
  return Math.ceil((date.getTime() - todayStart.getTime()) / 86400000);
}

function formatDate(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
