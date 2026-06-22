import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5174";
const outputDir = path.join(root, "artifacts/plane-r3-1");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const routes = {
  gantt: "/?qa=plane-r3&view=project&project=crm&tab=甘特图",
  timesheet: "/?qa=plane-r3&view=timesheets",
  costs: "/?qa=plane-r3&view=costs",
  users: "/?qa=plane-r3&view=users",
  home: "/?qa=plane-r2-home&view=dashboard",
  projects: "/?qa=plane-r2-projects-20&view=projects",
  board: "/?qa=plane-r1-board-dense&view=project&project=crm&tab=看板",
};

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  captures: [],
  checks: [],
  notes: [
    "R3.1 only covers UI acceptance fixes for filters, mobile Gantt controls, and timesheet status display.",
    "Origin/CSRF remains an independent security branch task.",
  ],
};

try {
  for (const item of [
    ["cost-management-1440x900.png", routes.costs, 1440, 900],
    ["cost-management-390x844.png", routes.costs, 390, 844],
    ["cost-filter-desktop-open.png", routes.costs, 1440, 900, openFilter("成本筛选")],
    ["cost-filter-mobile-open.png", routes.costs, 390, 844, openFilter("成本筛选")],
    ["people-management-1440x900.png", routes.users, 1440, 900],
    ["people-management-390x844.png", routes.users, 390, 844],
    ["people-filter-desktop-open.png", routes.users, 1440, 900, openFilter("人员筛选")],
    ["people-filter-mobile-open.png", routes.users, 390, 844, openFilter("人员筛选")],
    ["gantt-1440x900-regression.png", routes.gantt, 1440, 900],
    ["gantt-390x844.png", routes.gantt, 390, 844],
    ["gantt-mobile-filter-open.png", routes.gantt, 390, 844, openFilter("甘特筛选")],
    ["timesheet-1440x900.png", routes.timesheet, 1440, 900],
    ["timesheet-390x844.png", routes.timesheet, 390, 844],
    ["home-regression.png", routes.home, 1440, 900],
    ["projects-regression.png", routes.projects, 1440, 900],
    ["board-regression.png", routes.board, 1440, 900],
  ]) report.captures.push(await capture(...item));

  report.checks.push(await checkCostMobileFirstRecord());
  report.checks.push(await checkPeopleMobileFirstRecord());
  report.checks.push(await checkGanttMobileControls());
  report.checks.push(await checkTimesheetStatuses());
  report.checks.push(await checkDesktopGanttRegression());
  report.passed = report.captures.every((item) => item.horizontalOverflow <= 0 && !item.consoleErrors.length && !item.pageErrors.length)
    && report.checks.every((item) => item.passed);
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}

function openFilter(name) {
  return async (page) => {
    await page.getByRole("button", { name }).click();
    await page.getByRole("dialog", { name }).waitFor();
  };
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

async function checkCostMobileFirstRecord() {
  return checkMobileRecord("cost-mobile-first-record", routes.costs, ".cost-mobile-card");
}

async function checkPeopleMobileFirstRecord() {
  return checkMobileRecord("people-mobile-first-record", routes.users, ".people-mobile-card");
}

async function checkMobileRecord(name, route, selector) {
  const page = await createPage(390, 844);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await settle(page);
  const actual = await page.evaluate((target) => {
    const element = document.querySelector(target);
    const rect = element?.getBoundingClientRect();
    return {
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
      top: rect ? Math.round(rect.top) : null,
      inViewport: Boolean(rect && rect.top < window.innerHeight && rect.bottom > 0),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, selector);
  await page.close();
  return {
    name,
    ...actual,
    ...diagnostics,
    passed: actual.visible && actual.inViewport && actual.horizontalOverflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
  };
}

async function checkGanttMobileControls() {
  const page = await createPage(390, 844);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${routes.gantt}`, { waitUntil: "networkidle" });
  await settle(page);
  const actual = await page.evaluate(() => {
    const controls = document.querySelector(".gantt-mobile-controls")?.getBoundingClientRect();
    const firstCard = document.querySelector(".gantt-mobile-card")?.getBoundingClientRect();
    const desktopText = document.body.innerText.includes("任务身份固定在左侧");
    return {
      controlsVisible: Boolean(controls && controls.width > 0 && controls.height > 0),
      firstCardVisible: Boolean(firstCard && firstCard.width > 0 && firstCard.height > 0),
      internalHeight: controls && firstCard ? Math.round(firstCard.top - controls.top) : null,
      desktopDescriptionVisible: desktopText,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await page.close();
  return {
    name: "gantt-mobile-compact-controls",
    ...actual,
    ...diagnostics,
    passed: actual.controlsVisible && actual.firstCardVisible && actual.internalHeight <= 220 && !actual.desktopDescriptionVisible && actual.horizontalOverflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
  };
}

async function checkTimesheetStatuses() {
  const page = await createPage(1440, 900);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${routes.timesheet}`, { waitUntil: "networkidle" });
  await settle(page);
  const actual = await page.evaluate(() => {
    const text = document.querySelector(".timesheet-view")?.innerText || "";
    const summary = document.querySelector(".timesheet-status-summary")?.innerText || "";
    return {
      hasEnglishStatus: /\b(DRAFT|SUBMITTED|APPROVED|REJECTED)\b/.test(text),
      hasChineseSummary: summary.includes("草稿") && summary.includes("已提交") && summary.includes("已通过"),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await page.close();
  return {
    name: "timesheet-localized-statuses",
    ...actual,
    ...diagnostics,
    passed: !actual.hasEnglishStatus && actual.hasChineseSummary && actual.horizontalOverflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
  };
}

async function checkDesktopGanttRegression() {
  const page = await createPage(1440, 900);
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
      desktopGanttVisible: visible(".gantt-workspace"),
      mobileControlsVisible: visible(".gantt-mobile-controls"),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await page.close();
  return {
    name: "desktop-gantt-regression",
    ...actual,
    ...diagnostics,
    passed: actual.desktopGanttVisible && !actual.mobileControlsVisible && actual.horizontalOverflow <= 0 && !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length,
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
  await page.waitForTimeout(200);
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
