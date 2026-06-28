import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const serverEnv = readFileSync(new URL("../server/src/config/env.ts", import.meta.url), "utf8");
const authMiddleware = readFileSync(new URL("../server/src/middleware/auth.ts", import.meta.url), "utf8");

assert(env.includes("normalizeBasePath"), "React env helper should normalize app and API base paths");
assert(env.includes("import.meta.env.BASE_URL"), "React app base path should respect Vite BASE_URL");
assert(env.includes("import.meta.env.VITE_APP_BASE_PATH"), "React app base path should support deployment override");
assert(env.includes("import.meta.env.VITE_API_BASE_PATH"), "React API path should support deployment API override");
assert(env.includes("import.meta.env.VITE_API_BASE_URL"), "React API path should remain compatible with legacy API base URL variable");
assert(env.includes("storageNamespace"), "React local demo storage should be environment namespaced");
assert(viteConfig.includes("normalizeBasePath(process.env.VITE_APP_BASE_PATH)"), "Vite base should be deployment-path aware");

assert(serverEnv.includes("SESSION_COOKIE_NAME"), "server config must support isolated cookie names");
assert(serverEnv.includes("SESSION_COOKIE_PATH"), "server config must support path-scoped cookies");
assert(authMiddleware.includes("config.cookieName"), "auth middleware must read the configured cookie name");
assert(authMiddleware.includes("config.cookiePath"), "auth middleware must set the configured cookie path");

console.log("react path deployment config tests passed");
