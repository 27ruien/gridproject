const DEFAULT_APP_BASE_PATH = "/";
const DEFAULT_API_BASE_PATH = "/api/";
const DEFAULT_APP_ENV = "dev";

export function normalizeBasePath(value = DEFAULT_APP_BASE_PATH) {
  const path = String(value || DEFAULT_APP_BASE_PATH).trim() || DEFAULT_APP_BASE_PATH;
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function appBasePath() {
  return normalizeBasePath(import.meta.env.BASE_URL || import.meta.env.VITE_APP_BASE_PATH || DEFAULT_APP_BASE_PATH);
}

export function apiBasePath() {
  const configured = import.meta.env.VITE_API_BASE_PATH || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_PATH;
  return normalizeBasePath(configured).replace(/\/$/, "");
}

export function isApiDataSource() {
  return String(import.meta.env.VITE_DATA_SOURCE || "local").toLowerCase() === "api";
}

export function appEnvironment() {
  return String(import.meta.env.VITE_APP_ENV || DEFAULT_APP_ENV).trim().toLowerCase();
}

export function storageNamespace() {
  const value = appEnvironment();
  if (["prod", "production"].includes(value)) return "gridproject_prod";
  if (["dev", "development"].includes(value)) return "gridproject_dev";
  return `gridproject_${value.replace(/[^a-z0-9_-]/g, "_") || DEFAULT_APP_ENV}`;
}

export function storageKey(key: string) {
  return `${storageNamespace()}:${key}`;
}
