import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5174";
const outputDir = path.join(root, "artifacts/plane-r3");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const routes = {
  gantt: "/?qa=plane-r3&view=project&project=crm&tab=甘特图",
  timesheet: "/?qa=plane-r3&view=timesheets",
  costs: "/?qa=plane-r3&view=costs",
  users: "/?qa=plane-r3&view=users",
  settings: "/?qa=plane-r3&view=settings",
  home: "/?qa=plane-r2-home&view=dashboard",
  projects: "/?qa=plane-r2-projects-20&view=projects",
  projectList: "/?qa=plane-r1-list-dense&view=project&project=crm&tab=迭代",
  board: "/?qa=plane-r1-board-dense&view=project&project=crm&tab=看板",
  personalSettings: "/settings/profile",
};
const viewports = [
  [1920, 1080],
  [1728, 1117],
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [390, 844],
];
const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  captures: [],
  checks: [],
  releaseBlockers: ["Origin/CSRF 写请求校验仍是独立发布前安全分支任务，不属于 R3 UI 收口。"],
};

try {
  for (const item of [
    ["gantt-1440x900.png", routes.gantt, 1440, 900],
    ["gantt-390x844.png", routes.gantt, 390, 844],
    ["timesheet-1440x900.png", routes.timesheet, 1440, 900],
    ["timesheet-390x844.png", routes.timesheet, 390, 844],
    ["cost-management-1440x900.png", routes.costs, 1440, 900],
    ["cost-management-390x844.png", routes.costs, 390, 844],
    ["people-management-1440x900.png", routes.users, 1440, 900],
    ["people-management-390x844.png", routes.users, 390, 844],
    ["platform-settings-1440x900.png", routes.settings, 1440, 900],
    ["platform-settings-390x844.png", routes.settings, 390, 844],
    ["home-regression-1440x900.png", routes.home, 1440, 900],
    ["projects-regression-1440x900.png", routes.projects, 1440, 900],
    ["project-list-regression-1440x900.png", routes.projectList, 1440, 900],
    ["board-regression-1440x900.png", routes.board, 1440, 900],
  ]) report.captures.push(await capture(...item));

  report.captures.push(await capture("account-regression.png", routes.projects, 1440, 900, async (page) => {
    await page.locator(".desktop-account-menu .account-trigger").click();
    await page.locator(".account-popover").waitFor();
  }));
  report.captures.push(await capture("personal-settings-regression.png", routes.personalSettings, 1440, 900));

  report.checks.push(...await checkResponsiveMatrix());
  report.checks.push(await checkMobileR3Surfaces());
  report.checks.push(await checkRegressionSurfaces());
  report.passed = report.captures.every((item) => item.horizontalOverflow <= 0 && !item.consoleErrors.length && !item.pageErrors.length)
    && report.checks.every((item) => item.passed);
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}

async function capture(filename, route, width, height, action) {
  const page = await createPage(width, height);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await settle(page);
  if (action) {
    await action(page);
    await settle(page);
  }
  const horizontalOverflow = await horizontalOverflowFor(page);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  await page.close();
  return { filename, route, viewport: { width, height }, horizontalOverflow, ...diagnostics };
}

async function createPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.localStorage.removeItem("kiviflow-platform-state-v1");
    window.localStorage.removeItem("kiviflow-vue-mvp-state");
    window.localStorage.setItem("gridproject.navCollapsed", "false");
  });
  return page;
}

async function checkResponsiveMatrix() {
  const checks = [];
  for (const [width, height] of viewports) {
    for (const [name, route, selector] of [
      ["gantt", routes.gantt, width < 768 ? ".gantt-mobile-list" : ".gantt-workspace"],
      ["timesheet", routes.timesheet, width < 768 ? ".timesheet-mobile-list" : ".timesheet-week-table"],
      ["cost", routes.costs, width < 768 ? ".cost-mobile-list" : ".cost-table"],
      ["people", routes.users, width < 768 ? ".people-mobile-list" : ".people-table"],
      ["settings", routes.settings, ".platform-settings-shell"],
    ]) {
      checks.push(await checkPage(`${name}-${width}x${height}`, route, width, height, selector));
    }
  }
  return checks;
}

async function checkMobileR3Surfaces() {
  const page = await createPage(390, 844);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${routes.gantt}`, { waitUntil: "networkidle" });
  await settle(page);
  const actual = await page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return {
      ganttMobile: visible(".gantt-mobile-list"),
      ganttDesktopVisible: visible(".gantt-workspace"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await page.close();
  return {
    name: "mobile-r3-purpose-built-surfaces",
    ...actual,
    ...diagnostics,
    passed: actual.ganttMobile && !actual.ganttDesktopVisible && actual.overflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
  };
}

async function checkRegressionSurfaces() {
  const checks = [];
  for (const [name, route, selector] of [
    ["home-regression", routes.home, ".due-section"],
    ["projects-regression", routes.projects, ".project-card-grid"],
    ["project-list-regression", routes.projectList, ".issue-table-row"],
    ["board-regression", routes.board, ".board"],
    ["personal-settings-regression", routes.personalSettings, ".personal-settings-view"],
  ]) checks.push(await checkPage(name, route, 1440, 900, selector));
  return {
    name: "r1-r2-regression-surfaces",
    children: checks,
    passed: checks.every((item) => item.passed),
  };
}

async function checkPage(name, route, width, height, selector) {
  const page = await createPage(width, height);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await settle(page);
  const actual = await page.evaluate((target) => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return {
      selectorVisible: visible(target),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, selector);
  await page.close();
  return {
    name,
    route,
    viewport: { width, height },
    selector,
    ...actual,
    ...diagnostics,
    passed: actual.selectorVisible && actual.horizontalOverflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
  };
}

async function settle(page) {
  await page.addStyleTag({
    content: `
      :root, body, button, input, select, textarea {
        font-family: Arial, Helvetica, sans-serif !important;
      }
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.waitForTimeout(180);
}

async function horizontalOverflowFor(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

function observe(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}
