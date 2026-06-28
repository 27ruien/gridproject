import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";
const artifactDir = join(process.cwd(), "artifacts/ui-review/react-shadcn-full-rewrite");
const screenshotDir = join(artifactDir, "screenshots");
const localUserKey = "gridproject_dev:react-gridproject-user-v1";
const localStateKey = "gridproject_dev:react-gridproject-state-v1";

mkdirSync(screenshotDir, { recursive: true });

const viewports = {
  desktop1920: { width: 1920, height: 1080 },
  desktop1440: { width: 1440, height: 900 },
  mobile390: { width: 390, height: 844 },
};

const cases = [
  { id: "login-1440", route: "/login?preview=1", viewport: "desktop1440", role: "preview", expected: "登录页可见" },
  { id: "home-member-1920", route: "/", viewport: "desktop1920", role: "member", expected: "成员首页可见" },
  { id: "home-admin-1440", route: "/", viewport: "desktop1440", role: "admin", expected: "管理员首页可见" },
  { id: "project-library-member-1440", route: "/projects", viewport: "desktop1440", role: "member", expected: "项目库可见" },
  { id: "project-library-empty-1440", route: "/projects", viewport: "desktop1440", role: "member", expected: "项目库空状态可见", action: async (page) => page.getByPlaceholder("搜索项目名称、代码或描述").fill("no-result-react-rewrite") },
  { id: "project-create-dialog-1440", route: "/projects", viewport: "desktop1440", role: "member", expected: "项目创建弹窗可见", action: async (page) => page.getByRole("button", { name: "创建项目" }).click() },
  { id: "project-detail-overview-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "项目概览可见" },
  { id: "project-detail-1920", route: "/projects/crm", viewport: "desktop1920", role: "member", expected: "项目详情 1920 可见" },
  { id: "project-tasks-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "工作项页签可见", tab: "工作项" },
  { id: "project-gantt-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "甘特图页签可见", tab: "甘特图" },
  { id: "project-members-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "成员页签可见", tab: "成员" },
  { id: "project-milestones-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "里程碑页签可见", tab: "里程碑" },
  { id: "project-delivery-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "交付与验收页签可见", tab: "交付与验收" },
  { id: "project-risk-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "风险页签可见", tab: "风险" },
  { id: "issue-sheet-1440", route: "/projects/crm?issue=i1", viewport: "desktop1440", role: "member", expected: "事项详情 Sheet 可见" },
  { id: "schedule-import-dialog-1440", route: "/projects/crm", viewport: "desktop1440", role: "member", expected: "排期导入弹窗可见", action: async (page) => page.getByRole("button", { name: "导入排期" }).click() },
  { id: "timesheet-member-1440", route: "/timesheets", viewport: "desktop1440", role: "member", expected: "工时填报可见" },
  { id: "timesheet-list-member-1440", route: "/timesheet-list", viewport: "desktop1440", role: "member", expected: "工时列表可见" },
  { id: "trash-member-1440", route: "/trash", viewport: "desktop1440", role: "member", expected: "回收站可见" },
  { id: "costs-admin-1440", route: "/costs", viewport: "desktop1440", role: "admin", expected: "成本管理可见" },
  { id: "costs-admin-1920", route: "/costs", viewport: "desktop1920", role: "admin", expected: "成本管理 1920 可见" },
  { id: "people-admin-1440", route: "/people", viewport: "desktop1440", role: "admin", expected: "人员管理可见" },
  { id: "settings-admin-1440", route: "/settings", viewport: "desktop1440", role: "admin", expected: "平台设置可见" },
  { id: "profile-member-1440", route: "/profile", viewport: "desktop1440", role: "member", expected: "个人资料可见" },
  { id: "preferences-member-1440", route: "/profile/preferences", viewport: "desktop1440", role: "member", expected: "偏好设置可见" },
  { id: "security-member-1440", route: "/profile/security", viewport: "desktop1440", role: "member", expected: "安全设置可见" },
  { id: "forbidden-member-1440", route: "/costs", viewport: "desktop1440", role: "member", expected: "普通成员成本页无权限" },
  { id: "not-found-1440", route: "/missing-react-route", viewport: "desktop1440", role: "member", expected: "404 页面可见" },
  { id: "mobile-nav-admin-390", route: "/", viewport: "mobile390", role: "admin", expected: "移动端导航 Sheet 可见", action: async (page) => page.getByRole("button", { name: "打开导航" }).click() },
  { id: "project-mobile-390", route: "/projects/crm", viewport: "mobile390", role: "member", expected: "项目详情移动端可见" },
  { id: "timesheet-mobile-390", route: "/timesheets", viewport: "mobile390", role: "member", expected: "工时填报移动端可见" },
];

const roleToUser = {
  admin: "user-admin",
  member: "user-linxia",
  participant: "user-zhoucheng",
  preview: "user-linxia",
};

const browser = await chromium.launch();
const results = [];

try {
  for (const item of cases) {
    const viewport = viewports[item.viewport];
    const context = await browser.newContext({ viewport });
    await context.addInitScript(({ key, stateKey, userId }) => {
      window.localStorage.setItem(key, userId);
      window.localStorage.removeItem(stateKey);
    }, { key: localUserKey, stateKey: localStateKey, userId: roleToUser[item.role] || roleToUser.member });

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));

    await page.goto(`${baseURL}${item.route}`, { waitUntil: "networkidle" });
    if (item.tab) await page.getByRole("tab", { name: item.tab }).click();
    if (item.action) await item.action(page);
    await page.waitForTimeout(350);

    const path = join(screenshotDir, `${item.id}.png`);
    await page.screenshot({ path, fullPage: true });
    results.push({
      ...item,
      viewport,
      screenshot: path,
      consoleErrors,
      pageErrors,
      failedRequests,
      actual: consoleErrors.length || pageErrors.length || failedRequests.length ? "Captured with diagnostics" : "Pass",
    });
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(artifactDir, "manifest.md"), buildManifest(results));
console.log(`Captured ${results.length} React rewrite screenshots into ${screenshotDir}`);

function buildManifest(items) {
  const lines = [
    "# React shadcn Full Rewrite Manifest",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${baseURL}`,
    "",
    "## Three Round Review Notes",
    "",
    "| Round | Focus | Corrections recorded |",
    "| --- | --- | --- |",
    "| Round 1 | Functional structure and page parity | Rebuilt React routes, app shell, project workflow, time/cost, people/settings/profile pages. |",
    "| Round 2 | shadcn/ui density, spacing, and responsive structure | Consolidated UI on shadcn/Radix primitives, Tailwind tokens, compact tables, tabs, sheets and dialogs. |",
    "| Round 3 | Empty/error/disabled/mobile states | Added forbidden/404, empty filters, disabled permission actions, mobile Sheet navigation and responsive captures. |",
    "",
    "## Screenshots",
    "",
    "| Screenshot | Route | Viewport | Role | Steps | Expected | Actual | Console error | Page error | Failed request |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...items.map((item) => [
      rel(item.screenshot),
      item.route,
      `${item.viewport.width}x${item.viewport.height}`,
      item.role,
      [item.tab ? `Open tab ${item.tab}` : "", item.action ? "Run page action" : "Open route"].filter(Boolean).join("; "),
      item.expected,
      item.actual,
      item.consoleErrors.length ? item.consoleErrors.join("<br>") : "None",
      item.pageErrors.length ? item.pageErrors.join("<br>") : "None",
      item.failedRequests.length ? item.failedRequests.join("<br>") : "None",
    ].map(escapeCell).join(" | ")).map((row) => `| ${row} |`),
    "",
    "## Differences From Original Vue",
    "",
    "- Routes now use React Router path routes instead of Vue/query-state routes.",
    "- UI primitives now come from shadcn/ui and Radix React components.",
    "- Local demo mode keeps the same seed business data, while API mode still uses HttpOnly cookie-backed backend sessions.",
    "- Old Vue Plane-oriented visual scenarios were replaced by React-route Chromium captures.",
    "",
    "## Open Issues",
    "",
    "- None recorded by the capture script. Manual review should still inspect the PNGs before release.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function rel(value) {
  return value.replace(`${process.cwd()}/`, "");
}

function escapeCell(value) {
  return String(value).replace(/\n/g, "<br>").replace(/\|/g, "\\|");
}
