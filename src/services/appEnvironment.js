const DEFAULT_APP_BASE_PATH = "/";
const DEFAULT_API_BASE_PATH = "/api/";
const DEFAULT_APP_ENV = "dev";

export function viteEnv() {
  return import.meta.env || {};
}

export function normalizeBasePath(value = DEFAULT_APP_BASE_PATH) {
  const path = String(value || DEFAULT_APP_BASE_PATH).trim() || DEFAULT_APP_BASE_PATH;
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function appBasePath(env = viteEnv()) {
  return normalizeBasePath(env.BASE_URL || env.VITE_APP_BASE_PATH || DEFAULT_APP_BASE_PATH);
}

export function apiBasePath(env = viteEnv()) {
  const configured = env.VITE_API_BASE_PATH || env.VITE_API_BASE_URL || DEFAULT_API_BASE_PATH;
  return normalizeBasePath(configured).replace(/\/$/, "");
}

export function appEnvironment(env = viteEnv()) {
  return String(env.VITE_APP_ENV || DEFAULT_APP_ENV).trim().toLowerCase();
}

export function hasExplicitAppEnvironment(env = viteEnv()) {
  return Boolean(String(env.VITE_APP_ENV || "").trim());
}

export function storageNamespace(env = viteEnv()) {
  const value = appEnvironment(env);
  if (["prod", "production"].includes(value)) return "gridproject_prod";
  if (["dev", "development"].includes(value)) return "gridproject_dev";
  return `gridproject_${value.replace(/[^a-z0-9_-]/g, "_") || DEFAULT_APP_ENV}`;
}

export function storageKey(key, env = viteEnv()) {
  return `${storageNamespace(env)}:${key}`;
}

export function withAppBasePath(path = "/", env = viteEnv()) {
  const base = appBasePath(env);
  const target = String(path || "/");
  if (target === "/") return base;
  if (target.startsWith("?") || target.startsWith("#")) return `${base}${target}`;
  return `${base}${target.replace(/^\/+/, "")}`;
}

export function stripAppBasePath(pathname = "/", env = viteEnv()) {
  const base = appBasePath(env);
  const path = pathname || "/";
  if (base === "/") return path;

  const baseWithoutSlash = base.replace(/\/$/, "");
  if (path === base || path === baseWithoutSlash) return "/";
  if (path.startsWith(base)) return `/${path.slice(base.length)}`;
  return path;
}

export function isAppRoutePath(pathname, routePath, env = viteEnv()) {
  return stripAppBasePath(pathname, env) === routePath;
}
