export const DEFAULT_PREFERENCES = Object.freeze({
  density: "comfortable",
  dateFormat: "yyyy-mm-dd",
  weekStart: "monday",
  defaultNav: "auto",
  homeDueRange: "all",
});

export function normalizePreferences(value = {}) {
  const preferences = value ?? {};
  return {
    density: ["compact", "comfortable"].includes(preferences.density) ? preferences.density : DEFAULT_PREFERENCES.density,
    dateFormat: ["yyyy-mm-dd", "mm-dd-yyyy", "dd-mm-yyyy"].includes(preferences.dateFormat) ? preferences.dateFormat : DEFAULT_PREFERENCES.dateFormat,
    weekStart: ["monday", "sunday"].includes(preferences.weekStart) ? preferences.weekStart : DEFAULT_PREFERENCES.weekStart,
    defaultNav: ["expanded", "collapsed", "auto"].includes(preferences.defaultNav) ? preferences.defaultNav : DEFAULT_PREFERENCES.defaultNav,
    homeDueRange: ["all", "mine", "others"].includes(preferences.homeDueRange) ? preferences.homeDueRange : DEFAULT_PREFERENCES.homeDueRange,
  };
}

export function formatPreferenceDate(value, format = DEFAULT_PREFERENCES.dateFormat) {
  if (!value) return "未设置";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  if (format === "mm-dd-yyyy") return `${month}-${day}-${year}`;
  if (format === "dd-mm-yyyy") return `${day}-${month}-${year}`;
  return `${year}-${month}-${day}`;
}
