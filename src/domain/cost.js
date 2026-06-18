import Decimal from "decimal.js";
import { normalizeTimeEntryStatus, TIME_ENTRY_STATUS } from "../server/policies/timeEntryAccessPolicy.js";

export const COST_RECORD_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
};

export const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
export const COST_INCLUDED_STATUSES = [TIME_ENTRY_STATUS.SUBMITTED, TIME_ENTRY_STATUS.APPROVED];

export function calculateProjectCost({
  project,
  record,
  timeEntries,
  issues = [],
  users = [],
  filter = {},
}) {
  const scopedEntries = getCostRawData({ project, record, timeEntries, issues, users, filter });
  const plannedPersonDays = decimal(record.plannedPersonDays);
  const standardHoursPerDay = decimal(record.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY);
  const peopleMap = new Map();

  scopedEntries.forEach((entry) => {
    const previous = peopleMap.get(entry.userId) || {
      userId: entry.userId,
      name: entry.personName,
      email: entry.personEmail,
      hours: new Decimal(0),
      days: new Decimal(0),
      entryCount: 0,
      lastWorkDate: "",
    };
    previous.hours = previous.hours.plus(entry.hoursDecimal);
    previous.days = previous.days.plus(entry.personDaysDecimal);
    previous.entryCount += 1;
    previous.lastWorkDate = [previous.lastWorkDate, entry.workDate].filter(Boolean).sort().at(-1) || "";
    peopleMap.set(entry.userId, previous);
  });

  const actualHours = scopedEntries.reduce((sum, entry) => sum.plus(entry.hoursDecimal), new Decimal(0));
  const actualPersonDays = standardHoursPerDay.gt(0) ? actualHours.div(standardHoursPerDay) : new Decimal(0);
  const remainingPersonDays = plannedPersonDays.minus(actualPersonDays);
  const personDayBurnRate = plannedPersonDays.gt(0) ? actualPersonDays.div(plannedPersonDays).mul(100) : new Decimal(0);
  const people = Array.from(peopleMap.values())
    .map((person) => formatCostPerson(person, actualHours))
    .sort((a, b) => Number(b.hours) - Number(a.hours));

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code || project.id,
    ownerName: userLabel(users, project.ownerId, project.owner),
    plannedPersonDays: formatDays(plannedPersonDays),
    standardHoursPerDay: standardHoursPerDay.toNumber(),
    actualHours: formatHours(actualHours),
    totalHours: formatHours(actualHours),
    actualPersonDays: formatDays(actualPersonDays),
    totalPersonDays: formatDays(actualPersonDays),
    remainingPersonDays: formatDays(remainingPersonDays),
    personDayBurnRate: formatPercent(personDayBurnRate),
    participantCount: people.length,
    people,
    rawData: scopedEntries.map((entry) => formatRawCostEntry(entry, plannedPersonDays)),
  };
}

export function calculatePersonCost(projectId, userId, input) {
  const summary = calculateProjectCost(input);
  return summary.people.find((person) => person.userId === userId && input.project.id === projectId) || null;
}

export function getTopPeopleCosts(projectId, input, limit = 5) {
  return calculateProjectCost(input).people
    .filter(() => input.project.id === projectId)
    .slice(0, limit);
}

export function getCostRawData({
  project,
  record,
  timeEntries,
  issues = [],
  users = [],
  filter = {},
}) {
  const standardHours = decimal(record.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY);
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  return timeEntries
    .filter((entry) => isCostIncludedEntry(entry, project.id, filter))
    .map((entry) => {
      const workDate = entry.workDate || entry.spentDate;
      const hoursDecimal = decimal(entry.hours || 0);
      const personDaysDecimal = standardHours.gt(0) ? hoursDecimal.div(standardHours) : new Decimal(0);
      const issue = issueMap.get(entry.issueId) || {};
      return {
        id: entry.id,
        userId: entry.userId || userIdByReporter(users, entry.reporter),
        personName: userLabel(users, entry.userId, entry.reporter),
        personEmail: userEmail(users, entry.userId),
        projectId: entry.projectId,
        projectCode: project.code || project.id,
        projectName: project.name,
        issueId: entry.issueId,
        issueCode: issue.code || entry.issueCode || "",
        issueTitle: issue.title || entry.issueTitle || "未关联事项",
        workDate,
        isoWeek: isoWeekLabel(workDate),
        hoursDecimal,
        personDaysDecimal,
        standardHoursPerDay: standardHours.toNumber(),
        status: normalizeTimeEntryStatus(entry.status),
        reporter: entry.reporter || userLabel(users, entry.userId),
        note: entry.note || entry.description || "",
        createdAt: entry.createdAt || "",
        updatedAt: entry.updatedAt || entry.createdAt || "",
      };
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || b.hoursDecimal.comparedTo(a.hoursDecimal));
}

export function isCostIncludedEntry(entry, projectId, filter = {}) {
  if (!entry || entry.projectId !== projectId || entry.deletedAt) return false;
  const status = normalizeTimeEntryStatus(entry.status);
  if (!(filter.statuses || COST_INCLUDED_STATUSES).includes(status)) return false;
  const workDate = entry.workDate || entry.spentDate;
  if (!workDate) return false;
  const week = normalizeWeekFilter(filter.weekStart);
  if (week && (workDate < week.start || workDate > week.end)) return false;
  if (filter.dateFrom && workDate < filter.dateFrom) return false;
  if (filter.dateTo && workDate > filter.dateTo) return false;
  return true;
}

export function normalizeWeekFilter(weekStart) {
  if (!weekStart) return null;
  const [year, month, dayOfMonth] = String(weekStart).split("-").map(Number);
  if (!year || !month || !dayOfMonth) return null;
  const start = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (Number.isNaN(start.getTime())) return null;
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: formatUtcDate(start),
    end: formatUtcDate(end),
  };
}

export function isoWeekLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function escapeExcelText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function formatHours(value) {
  return decimal(value).toDecimalPlaces(1).toNumber();
}

export function formatDays(value) {
  return decimal(value).toDecimalPlaces(2).toNumber();
}

export function formatPercent(value) {
  return decimal(value).toDecimalPlaces(1).toNumber();
}

function formatCostPerson(person, totalHours) {
  return {
    userId: person.userId,
    name: person.name,
    email: person.email,
    hours: formatHours(person.hours),
    personDays: formatDays(person.days),
    share: decimal(totalHours).gt(0) ? decimal(person.hours).div(totalHours).mul(100).toDecimalPlaces(1).toString() : "0",
    entryCount: person.entryCount,
    lastWorkDate: person.lastWorkDate,
  };
}

function formatRawCostEntry(entry, plannedPersonDays) {
  return {
    id: entry.id,
    userId: entry.userId,
    personName: entry.personName,
    personEmail: entry.personEmail,
    projectCode: entry.projectCode,
    projectName: entry.projectName,
    plannedPersonDays: formatDays(plannedPersonDays),
    issueId: entry.issueId,
    issueCode: entry.issueCode,
    issueTitle: entry.issueTitle,
    workDate: entry.workDate,
    isoWeek: entry.isoWeek,
    hours: formatHours(entry.hoursDecimal),
    standardHoursPerDay: entry.standardHoursPerDay,
    personDays: formatDays(entry.personDaysDecimal),
    status: entry.status,
    reporter: entry.reporter,
    note: entry.note,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function decimal(value) {
  return value instanceof Decimal ? value : new Decimal(value || 0);
}

function userIdByReporter(users, reporter) {
  return users.find((user) => user.name === reporter)?.id || reporter || "";
}

function userLabel(users, userId, fallback = "未知成员") {
  return users.find((user) => user.id === userId)?.name || fallback || "未知成员";
}

function userEmail(users, userId) {
  return users.find((user) => user.id === userId)?.email || "";
}

function formatUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
