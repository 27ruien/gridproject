import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/composables/useKiviflowStore.js", import.meta.url), "utf8");
const apiClient = readFileSync(new URL("../src/services/apiClient.js", import.meta.url), "utf8");
const apiAdapter = readFileSync(new URL("../src/storage/apiAdapter.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.vue", import.meta.url), "utf8");

[
  "apiClient.projects.create",
  "apiClient.users.create",
  "apiClient.timeEntries.create",
  "apiClient.costRecords.create",
  "apiClient.projects.update",
  "apiClient.users.update",
  "apiClient.timeEntries.update",
  "apiClient.costRecords.update",
].forEach((needle) => assert(store.includes(needle), `store should call ${needle} in API mode`));

assert(store.includes("apiMode ? authState.user"), "API mode current user must come from authState");
assert(store.includes("localDemoUser(users.value)"), "local demo current user should be resolved separately from API auth");
assert(store.includes('user.id === "user-linxia"'), "local demo should preserve the project-manager persona used by visual baselines");
assert(store.includes("apiClient.me()"), "store should restore current user from /auth/me");
assert(store.includes("apiClient.onUnauthorized"), "401 responses should be centrally handled");
assert(apiClient.includes('credentials: "include"'), "API requests must include cookies");
assert(app.includes("LoginView"), "App should render a real login view");
assert(app.includes("store.login"), "App should call the API login action");
assert(!apiAdapter.includes("state.sessions"), "API bootstrap must not hydrate sessions");
assert(!apiAdapter.includes("state.auditLogs"), "API bootstrap must not hydrate auditLogs");
assert(!apiClient.includes("localStorage"), "API client must not persist tokens in localStorage");

console.log("api mode source tests passed");
