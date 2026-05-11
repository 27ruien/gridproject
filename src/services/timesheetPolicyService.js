export const DAILY_WORK_HOURS = 8;

export function currentMonthValue(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function isInMonth(dateValue, monthValue) {
  return Boolean(dateValue && monthValue && dateValue.startsWith(monthValue));
}

export function getMonthDates(monthValue) {
  if (!monthValue) return [];
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const dates = [];

  while (date.getUTCMonth() === month - 1) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return dates;
}

export function isReportableDate(dateValue) {
  const day = new Date(`${dateValue}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

export function getReportableDates(monthValue) {
  return getMonthDates(monthValue).filter(isReportableDate);
}

export function calculateMonthlyTarget(monthValue) {
  return getReportableDates(monthValue).length * DAILY_WORK_HOURS;
}

export function getMissingSubmitDates(entries, reporter, monthValue) {
  if (!reporter) return [];
  const submitted = new Set(
    entries
      .filter((entry) => entry.reporter === reporter && isInMonth(entry.spentDate, monthValue))
      .map((entry) => entry.spentDate),
  );

  return getReportableDates(monthValue).filter((date) => !submitted.has(date));
}

export function createEntrySearchText(entry, projectName, issueName) {
  return [
    entry.id,
    entry.projectId,
    entry.issueId,
    entry.reporter,
    entry.spentDate,
    entry.hours,
    entry.note,
    entry.status,
    entry.createdAt,
    entry.updatedAt,
    projectName,
    issueName,
  ].join(" ");
}
