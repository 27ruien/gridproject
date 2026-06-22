import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5174";
const outputDir = path.join(root, "artifacts/plane-r2-1");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const projectRoute = "/?qa=plane-r2-projects-20&view=projects";
const homeRoute = "/?qa=plane-r2-home&view=dashboard";
const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  captures: [],
  checks: [],
  releaseBlockers: ["全局写请求 Origin/CSRF 校验尚未实现；CORS allowlist 与 SameSite=Lax 不能替代服务端写请求校验。"],
};

try {
  for (const item of [
    ["projects-1440x900.png", projectRoute, 1440, 900],
    ["projects-1728x1117.png", projectRoute, 1728, 1117],
    ["projects-390x844.png", projectRoute, 390, 844],
    ["home-1440x900.png", homeRoute, 1440, 900],
    ["home-390x844.png", homeRoute, 390, 844],
    ["profile-settings-desktop.png", "/settings/profile", 1440, 900],
    ["preference-settings-desktop.png", "/settings/preferences", 1440, 900],
    ["security-settings-desktop.png", "/settings/security", 1440, 900],
    ["personal-settings-mobile.png", "/settings/profile", 390, 844],
  ]) report.captures.push(await capture(...item));

  report.captures.push(await capture("projects-filter-open.png", projectRoute, 1440, 900, async (page) => {
    await page.getByRole("button", { name: /^筛选/ }).click();
  }));
  report.captures.push(await capture("home-overdue.png", homeRoute, 1440, 900, async (page) => {
    await page.locator(".due-group.overdue").scrollIntoViewIfNeeded();
  }));
  report.captures.push(await capture("home-due-next-seven-days.png", homeRoute, 1440, 900, async (page) => {
    await page.locator(".due-group.upcoming").scrollIntoViewIfNeeded();
  }));
  report.captures.push(await capture("home-due-others.png", homeRoute, 1440, 900, async (page) => {
    await page.getByRole("tab", { name: /^其他成员/ }).click();
    await page.locator(".due-section").scrollIntoViewIfNeeded();
  }));
  report.captures.push(await capture("account-menu-desktop.png", projectRoute, 1440, 900, async (page) => {
    await page.locator(".desktop-account-menu .account-trigger").click();
    await page.locator(".account-popover").waitFor();
  }));
  report.captures.push(await capture("account-menu-mobile.png", projectRoute, 390, 844, openMobileAccount));
  report.captures.push(await capture("account-menu-mobile-overlay-check.png", projectRoute, 390, 844, openMobileAccount));

  report.checks.push(await checkProjectLayout(1440, 3));
  report.checks.push(await checkProjectLayout(1728, 4));
  report.checks.push(await checkProjectLayout(390, 1));
  report.checks.push(await checkMobileHome());
  report.checks.push(await checkMobileAccountOverlay());
  report.checks.push(await checkSettingsLayout());
  report.checks.push(await checkDueSemantics());
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
  if (action) await action(page);
  await page.waitForTimeout(180);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  await page.close();
  return { filename, route, viewport: { width, height }, horizontalOverflow, ...diagnostics };
}

async function createPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addInitScript(() => window.localStorage.setItem("gridproject.navCollapsed", "false"));
  return page;
}

async function openMobileAccount(page) {
  await page.locator(".mobile-account-menu .account-trigger").click();
  await page.locator(".account-sheet").waitFor();
}

async function checkProjectLayout(width, expectedColumns) {
  const page = await createPage(width, width === 1728 ? 1117 : 900);
  await page.goto(`${baseURL}${projectRoute}`, { waitUntil: "networkidle" });
  const actual = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
    };
    return {
      columns: getComputedStyle(document.querySelector(".project-card-grid")).gridTemplateColumns.split(" ").length,
      visibleCreateEntries: [...document.querySelectorAll("button")].filter((element) => element.getAttribute("aria-label") === "创建项目" && visible(element)).length,
      minimumCardWidth: Math.min(...[...document.querySelectorAll(".project-card")].slice(0, 8).map((element) => element.getBoundingClientRect().width)),
    };
  });
  await page.close();
  return { name: `project-layout-${width}`, expectedColumns, ...actual, passed: actual.columns === expectedColumns && actual.visibleCreateEntries === 1 && actual.minimumCardWidth >= (width < 768 ? 300 : 300) };
}

async function checkMobileHome() {
  const page = await createPage(390, 844);
  await page.goto(`${baseURL}${homeRoute}`, { waitUntil: "networkidle" });
  const actual = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
    };
    return {
      visibleProjectCards: [...document.querySelectorAll(".home-projects-section .project-card")].filter(visible).length,
      dueSectionTop: document.querySelector(".due-section").getBoundingClientRect().top,
    };
  });
  await page.close();
  return { name: "mobile-home-hierarchy", ...actual, passed: actual.visibleProjectCards <= 2 && actual.dueSectionTop <= 844 };
}

async function checkMobileAccountOverlay() {
  const page = await createPage(390, 844);
  await page.goto(`${baseURL}${projectRoute}`, { waitUntil: "networkidle" });
  await openMobileAccount(page);
  const actual = await page.evaluate(() => {
    const rect = document.querySelector(".account-sheet").getBoundingClientRect();
    return {
      sheetVisible: rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth,
      drawerOpen: document.querySelector(".sidebar").classList.contains("open"),
      drawerScrims: document.querySelectorAll(".sidebar-scrim").length,
      accountScrims: document.querySelectorAll(".account-sheet-scrim").length,
    };
  });
  await page.close();
  return { name: "mobile-account-overlay", ...actual, passed: actual.sheetVisible && !actual.drawerOpen && actual.drawerScrims === 0 && actual.accountScrims === 1 };
}

async function checkSettingsLayout() {
  const page = await createPage(1440, 900);
  await page.goto(`${baseURL}/settings/profile`, { waitUntil: "networkidle" });
  const actual = await page.evaluate(() => {
    const view = document.querySelector(".personal-settings-view").getBoundingClientRect();
    const sidebar = document.querySelector(".personal-settings-sidebar").getBoundingClientRect();
    const form = document.querySelector(".settings-panel-form").getBoundingClientRect();
    return { view: { x: view.x, y: view.y, width: view.width, height: view.height }, sidebarWidth: sidebar.width, contentWidth: form.width };
  });
  await page.close();
  return { name: "desktop-settings-layout", ...actual, passed: actual.view.x === 0 && actual.view.y === 0 && actual.view.width === 1440 && actual.view.height === 900 && actual.sidebarWidth >= 240 && actual.sidebarWidth <= 280 && actual.contentWidth >= 720 && actual.contentWidth <= 880 };
}

async function checkDueSemantics() {
  const page = await createPage(1440, 900);
  await page.goto(`${baseURL}${homeRoute}`, { waitUntil: "networkidle" });
  const actual = await page.evaluate(() => ({
    title: document.querySelector(".due-section h2")?.textContent?.trim(),
    overdueCount: document.querySelectorAll(".due-group.overdue .due-issue-card").length,
    upcomingCount: document.querySelectorAll(".due-group.upcoming .due-issue-card").length,
    oldTitlePresent: [...document.querySelectorAll("h2")].some((element) => element.textContent?.trim() === "即将到期"),
  }));
  await page.close();
  return { name: "due-semantics", ...actual, passed: actual.title === "待关注事项" && actual.overdueCount > 0 && actual.upcomingCount > 0 && !actual.oldTitlePresent };
}

function observe(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}
