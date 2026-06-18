import { toDateOnly, toNumber } from "../utils/dto.js";

export const COST_INCLUDED_STATUSES = ["SUBMITTED", "APPROVED"];

type CostInput = {
  project: any;
  record: any;
  timeEntries: any[];
  issues?: any[];
  users?: any[];
  filter?: Record<string, unknown>;
};

export function calculateProjectCost({ project, record, timeEntries, issues = [], users = [], filter = {} }: CostInput) {
  const rawData = getCostRawData({ project, record, timeEntries, issues, users, filter });
  const plannedPersonDays = roundDays(toNumber(record.plannedPersonDays));
  const standardHoursPerDay = toNumber(record.standardHoursPerDay) || 8;
  const actualHours = rawData.reduce((sum, entry) => sum + entry.hours, 0);
  const actualPersonDays = standardHoursPerDay > 0 ? actualHours / standardHoursPerDay : 0;
  const remainingPersonDays = plannedPersonDays - actualPersonDays;
  const personDayBurnRate = plannedPersonDays > 0 ? (actualPersonDays / plannedPersonDays) * 100 : 0;
  const peopleMap = new Map<string, any>();

  rawData.forEach((entry) => {
    const current = peopleMap.get(entry.userId) || {
      userId: entry.userId,
      name: entry.personName,
      email: entry.personEmail,
      hours: 0,
      personDays: 0,
      entryCount: 0,
      lastWorkDate: "",
    };
    current.hours += entry.hours;
    current.personDays += entry.personDays;
    current.entryCount += 1;
    current.lastWorkDate = [current.lastWorkDate, entry.workDate].filter(Boolean).sort().at(-1) || "";
    peopleMap.set(entry.userId, current);
  });

  const people = Array.from(peopleMap.values())
    .map((person) => ({
      ...person,
      hours: roundHours(person.hours),
      personDays: roundDays(person.personDays),
      share: actualHours > 0 ? ((person.hours / actualHours) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code || project.id,
    ownerName: project.owner?.name || userLabel(users, project.ownerId, project.owner || "未知成员"),
    plannedPersonDays,
    standardHoursPerDay,
    actualHours: roundHours(actualHours),
    totalHours: roundHours(actualHours),
    actualPersonDays: roundDays(actualPersonDays),
    totalPersonDays: roundDays(actualPersonDays),
    remainingPersonDays: roundDays(remainingPersonDays),
    personDayBurnRate: roundPercent(personDayBurnRate),
    participantCount: people.length,
    people,
    rawData,
  };
}

export function getCostRawData({ project, record, timeEntries, issues = [], users = [], filter = {} }: CostInput) {
  const standardHoursPerDay = toNumber(record.standardHoursPerDay) || 8;
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  return timeEntries
    .filter((entry) => isCostIncludedEntry(entry, project.id, filter))
    .map((entry) => {
      const issue = issueMap.get(entry.issueId) || {};
      const user = userMap.get(entry.userId) || entry.user || {};
      const hours = toNumber(entry.hours);
      const workDate = toDateOnly(entry.workDate) || "";
      return {
        id: entry.id,
        userId: entry.userId,
        personName: user.name || entry.reporter || "未知成员",
        personEmail: user.email || "",
        projectId: project.id,
        projectCode: project.code || project.id,
        projectName: project.name,
        issueId: entry.issueId || "",
        issueCode: issue.code || "",
        issueTitle: issue.title || "未关联事项",
        workDate,
        isoWeek: isoWeekLabel(workDate),
        hours: roundHours(hours),
        standardHoursPerDay,
        personDays: roundDays(standardHoursPerDay > 0 ? hours / standardHoursPerDay : 0),
        status: entry.status,
        reporter: user.name || entry.reporter || "未知成员",
        note: entry.description || entry.note || "",
        createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt || ""),
        updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : String(entry.updatedAt || ""),
      };
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || b.hours - a.hours);
}

export function isCostIncludedEntry(entry: any, projectId: string, filter: Record<string, unknown> = {}) {
  if (!entry || entry.projectId !== projectId || entry.deletedAt) return false;
  const statuses = Array.isArray(filter.statuses) ? filter.statuses.map(String) : COST_INCLUDED_STATUSES;
  if (!statuses.includes(String(entry.status))) return false;
  const workDate = toDateOnly(entry.workDate);
  if (!workDate) return false;
  const week = normalizeWeekFilter(filter.weekStart);
  if (week && (workDate < week.start || workDate > week.end)) return false;
  if (filter.dateFrom && workDate < String(filter.dateFrom)) return false;
  if (filter.dateTo && workDate > String(filter.dateTo)) return false;
  return true;
}

export function normalizeWeekFilter(weekStart: unknown) {
  if (!weekStart) return null;
  const text = String(weekStart);
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return null;
  const dayOfWeek = start.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: formatUtcDate(start), end: formatUtcDate(end) };
}

export function isoWeekLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function userLabel(users: any[], userId: string, fallback = "未知成员") {
  return users.find((user) => user.id === userId)?.name || fallback;
}

function roundHours(value: number) {
  return Number(value.toFixed(1));
}

function roundDays(value: number) {
  return Number(value.toFixed(2));
}

function roundPercent(value: number) {
  return Number(value.toFixed(1));
}

function formatUtcDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
