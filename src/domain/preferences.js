export const DEFAULT_PREFERENCES = Object.freeze({
  density: "comfortable",
  dateFormat: "yyyy-mm-dd",
  weekStart: "monday",
  defaultNav: "auto",
  homeDueRange: "all",
  avatarColor: "#315a9f",
});

export function normalizePreferences(value = {}) {
  return {
    density: ["compact", "comfortable"].includes(value.density) ? value.density : DEFAULT_PREFERENCES.density,
    dateFormat: ["yyyy-mm-dd", "mm-dd-yyyy", "dd-mm-yyyy"].includes(value.dateFormat) ? value.dateFormat : DEFAULT_PREFERENCES.dateFormat,
    weekStart: ["monday", "sunday"].includes(value.weekStart) ? value.weekStart : DEFAULT_PREFERENCES.weekStart,
    defaultNav: ["expanded", "collapsed", "auto"].includes(value.defaultNav) ? value.defaultNav : DEFAULT_PREFERENCES.defaultNav,
    homeDueRange: ["all", "mine", "others"].includes(value.homeDueRange) ? value.homeDueRange : DEFAULT_PREFERENCES.homeDueRange,
    avatarColor: /^#[0-9a-f]{6}$/i.test(value.avatarColor || "") ? value.avatarColor : DEFAULT_PREFERENCES.avatarColor,
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
