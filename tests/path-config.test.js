import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apiBasePath,
  appBasePath,
  storageKey,
  storageNamespace,
  stripAppBasePath,
  withAppBasePath,
} from "../src/services/appEnvironment.js";
import { apiBaseUrl } from "../src/services/apiClient.js";

const devEnv = {
  BASE_URL: "/tool/dev/project/",
  VITE_API_BASE_PATH: "/tool/dev/project/api/",
  VITE_APP_ENV: "dev",
};
const prodEnv = {
  BASE_URL: "/tool/project/",
  VITE_API_BASE_PATH: "/tool/project/api/",
  VITE_APP_ENV: "prod",
};

assert.equal(appBasePath(devEnv), "/tool/dev/project/");
assert.equal(appBasePath(prodEnv), "/tool/project/");
assert.equal(withAppBasePath("/login", devEnv), "/tool/dev/project/login");
assert.equal(withAppBasePath("/?view=dashboard", prodEnv), "/tool/project/?view=dashboard");
assert.equal(stripAppBasePath("/tool/dev/project/settings/profile", devEnv), "/settings/profile");

assert.equal(apiBasePath(devEnv), "/tool/dev/project/api");
assert.equal(apiBaseUrl(devEnv), "/tool/dev/project/api");
assert.equal(apiBaseUrl({ VITE_API_BASE_URL: "/api/" }), "/api");

assert.equal(storageNamespace(devEnv), "gridproject_dev");
assert.equal(storageNamespace(prodEnv), "gridproject_prod");
assert.equal(storageKey("kiviflow-platform-state-v1", devEnv), "gridproject_dev:kiviflow-platform-state-v1");
assert.equal(storageKey("kiviflow-platform-state-v1", prodEnv), "gridproject_prod:kiviflow-platform-state-v1");

const serverEnv = readFileSync(new URL("../server/src/config/env.ts", import.meta.url), "utf8");
const authMiddleware = readFileSync(new URL("../server/src/middleware/auth.ts", import.meta.url), "utf8");
assert(serverEnv.includes("SESSION_COOKIE_NAME"), "server config must support isolated cookie names");
assert(serverEnv.includes("SESSION_COOKIE_PATH"), "server config must support path-scoped cookies");
assert(authMiddleware.includes("config.cookieName"), "auth middleware must read the configured cookie name");
assert(authMiddleware.includes("config.cookiePath"), "auth middleware must set the configured cookie path");

console.log("path deployment config tests passed");
