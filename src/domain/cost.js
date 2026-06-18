import Decimal from "decimal.js";
import { normalizeTimeEntryStatus, TIME_ENTRY_STATUS } from "../server/policies/timeEntryAccessPolicy.js";

export const COST_RECORD_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
};

export const DEFAULT_COST_CURRENCY = "CNY";
export const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
export const COST_INCLUDED_STATUSES = [TIME_ENTRY_STATUS.SUBMITTED, TIME_ENTRY_STATUS.APPROVED];

export function calculateProjectCost({
  project,
  record,
  rates,
  timeEntries,
  issues = [],
  users = [],
  filter = {},
}) {
  const scopedEntries = getCostRawData({ project, record, rates, timeEntries, issues, users, filter });
  const peopleMap = new Map();

  scopedEntries.forEach((entry) => {
    const previous = peopleMap.get(entry.userId) || {
      userId: entry.userId,
      name: entry.personName,
      email: entry.personEmail,
      hours: new Decimal(0),
      days: new Decimal(0),
      cost: new Decimal(0),
    };
    previous.hours = previous.hours.plus(entry.hoursDecimal);
    previous.days = previous.days.plus(entry.personDaysDecimal);
    previous.cost = previous.cost.plus(entry.costDecimal);
    peopleMap.set(entry.userId, previous);
  });

  const people = Array.from(peopleMap.values())
    .map((person) => formatCostPerson(person))
    .sort((a, b) => Number(b.cost) - Number(a.cost));
  const totalHours = people.reduce((sum, person) => sum.plus(person.hours), new Decimal(0));
  const totalDays = people.reduce((sum, person) => sum.plus(person.personDays), new Decimal(0));
  const totalCost = people.reduce((sum, person) => sum.plus(person.cost), new Decimal(0));

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code || project.id,
    ownerName: userLabel(users, project.ownerId, project.owner),
    currency: record.currency || DEFAULT_COST_CURRENCY,
    standardHoursPerDay: decimal(record.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY).toNumber(),
    currentAmountPerPersonDay: formatMoney(getCurrentRate(rates)?.amountPerPersonDay || 0),
    totalHours: formatHours(totalHours),
    totalPersonDays: formatDays(totalDays),
    totalCost: formatMoney(totalCost),
    people: people.map((person) => ({
      ...person,
      cost: formatMoney(person.cost),
      share: totalCost.gt(0) ? decimal(person.cost).div(totalCost).mul(100).toDecimalPlaces(1).toString() : "0",
    })),
    rawData: scopedEntries.map(formatRawCostEntry),
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
  rates,
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
      const rate = rateForWorkDate(rates, workDate);
      const hoursDecimal = decimal(entry.hours || 0);
      const personDaysDecimal = standardHours.gt(0) ? hoursDecimal.div(standardHours) : new Decimal(0);
      const amountPerPersonDayDecimal = decimal(rate?.amountPerPersonDay || 0);
      const costDecimal = personDaysDecimal.mul(amountPerPersonDayDecimal);
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
        amountPerPersonDayDecimal,
        costDecimal,
        standardHoursPerDay: standardHours.toNumber(),
        currency: record.currency || DEFAULT_COST_CURRENCY,
        status: normalizeTimeEntryStatus(entry.status),
        reporter: entry.reporter || userLabel(users, entry.userId),
        note: entry.note || entry.description || "",
        createdAt: entry.createdAt || "",
        updatedAt: entry.updatedAt || entry.createdAt || "",
      };
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || b.costDecimal.comparedTo(a.costDecimal));
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

export function rateForWorkDate(rates, workDate) {
  return [...rates]
    .filter((rate) => rate.effectiveFrom <= workDate && (!rate.effectiveTo || workDate < rate.effectiveTo))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
}

export function getCurrentRate(rates, today = new Date().toISOString().slice(0, 10)) {
  return rateForWorkDate(rates, today) || [...rates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
}

export function normalizeWeekFilter(weekStart) {
  if (!weekStart) return null;
  const start = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
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

export function formatMoney(value) {
  return decimal(value).toDecimalPlaces(2).toFixed(2);
}

export function formatHours(value) {
  return decimal(value).toDecimalPlaces(1).toNumber();
}

export function formatDays(value) {
  return decimal(value).toDecimalPlaces(2).toNumber();
}

function formatCostPerson(person) {
  return {
    userId: person.userId,
    name: person.name,
    email: person.email,
    hours: formatHours(person.hours),
    personDays: formatDays(person.days),
    cost: decimal(person.cost).toDecimalPlaces(2),
  };
}

function formatRawCostEntry(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    personName: entry.personName,
    personEmail: entry.personEmail,
    projectCode: entry.projectCode,
    projectName: entry.projectName,
    issueId: entry.issueId,
    issueCode: entry.issueCode,
    issueTitle: entry.issueTitle,
    workDate: entry.workDate,
    isoWeek: entry.isoWeek,
    hours: formatHours(entry.hoursDecimal),
    personDays: formatDays(entry.personDaysDecimal),
    amountPerPersonDay: formatMoney(entry.amountPerPersonDayDecimal),
    cost: formatMoney(entry.costDecimal),
    currency: entry.currency,
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
