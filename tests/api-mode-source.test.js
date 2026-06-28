import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("../src/lib/state/app-store.tsx", import.meta.url), "utf8");
const apiClient = readFileSync(new URL("../src/lib/api/client.ts", import.meta.url), "utf8");
const env = readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../src/app/router/router.tsx", import.meta.url), "utf8");
const guards = readFileSync(new URL("../src/app/router/guards.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/features/auth/LoginPage.tsx", import.meta.url), "utf8");

[
  "projectsApi.create",
  "peopleApi.create",
  "timesheetsApi.create",
  "costsApi.create",
  "projectsApi.members.create",
  "projectsApi.issues.create",
  "tasksApi.comments.create",
  "projectsApi.update",
  "peopleApi.update",
  "timesheetsApi.update",
  "costsApi.update",
  "settingsApi.update",
].forEach((needle) => assert(store.includes(needle), `React store should call ${needle} in API mode`));

assert(store.includes("authApi.me"), "React store should restore current user from /auth/me");
assert(store.includes("authApi.bootstrap"), "React store should hydrate API bootstrap data");
assert(store.includes("onUnauthorized"), "401 responses should be centrally handled by the app store");
assert(store.includes("DEMO_USERS.find"), "local demo mode should resolve a current user independently from API auth");
assert(apiClient.includes('credentials: "include"'), "API requests must include HttpOnly session cookies");
assert(apiClient.includes("apiBasePath"), "API requests must use the shared API base path helper");
assert(apiClient.includes("AbortSignal") || apiClient.includes("RequestInit"), "API client must preserve standard request options");
assert(env.includes("VITE_API_BASE_PATH"), "API base path helper must read the deploy API path variable");
assert(env.includes("VITE_DATA_SOURCE"), "data-source switch must remain environment driven");
assert(login.includes("react-hook-form"), "login form should use React Hook Form");
assert(login.includes("zodResolver"), "login form should use Zod validation");
assert(router.includes("createBrowserRouter"), "React Router must own the page tree");
assert(guards.includes("<Navigate to=\"/login\""), "route guard should redirect unauthenticated users to login");
assert(!apiClient.includes("localStorage"), "API client must not persist tokens in localStorage");

console.log("react api mode source tests passed");
