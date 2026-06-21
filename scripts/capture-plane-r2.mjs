import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const afterBase = process.env.BASE_URL || "http://127.0.0.1:5174";
const beforeBase = process.env.BEFORE_BASE_URL || "http://127.0.0.1:5175";
const outputDir = path.join(root, "artifacts/plane-r2");
const beforeDir = path.join(outputDir, "before");
const comparisonDir = path.join(outputDir, "comparison");
await Promise.all([outputDir, beforeDir, comparisonDir].map((directory) => mkdir(directory, { recursive: true })));

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), afterBase, beforeBase, captures: [], comparisons: [], notes: ["Plane reference assets are official public screenshots; no matching Plane image file was attached to the R2 text brief."] };
const homeRoute = "/?qa=plane-r2-home&view=dashboard";
const projectRoute = "/?qa=plane-r2-projects-20&view=projects";

try {
  const cases = [
    ["home-1440x900.png", homeRoute, 1440, 900],
    ["home-1280x800.png", homeRoute, 1280, 800],
    ["home-390x844.png", homeRoute, 390, 844],
    ["projects-1440x900.png", projectRoute, 1440, 900],
    ["projects-1280x800.png", projectRoute, 1280, 800],
    ["projects-390x844.png", projectRoute, 390, 844],
    ["projects-dense-20.png", projectRoute, 1440, 900],
    ["projects-empty.png", "/?qa=plane-r2-projects-empty&view=projects", 1440, 900],
  ];
  for (const captureCase of cases) report.captures.push(await capturePage(afterBase, outputDir, ...captureCase));

  report.captures.push(await captureAction("home-due-all.png", homeRoute, 1440, 900, async (page) => page.getByRole("tab", { name: /^全部/ }).click()));
  report.captures.push(await captureAction("home-due-others.png", homeRoute, 1440, 900, async (page) => page.getByRole("tab", { name: /^其他成员/ }).click()));
  report.captures.push(await captureAction("projects-filter-open.png", projectRoute, 1440, 900, async (page) => page.getByRole("button", { name: /^筛选/ }).click()));
  report.captures.push(await captureAction("account-menu-open.png", projectRoute, 1440, 900, openDesktopAccount));
  report.captures.push(await captureAction("account-menu-mobile.png", projectRoute, 390, 844, openMobileAccount));
  report.captures.push(await capturePage(afterBase, outputDir, "profile-settings.png", "/settings/profile", 1440, 900));
  report.captures.push(await capturePage(afterBase, outputDir, "preference-settings.png", "/settings/preferences", 1440, 900));
  report.captures.push(await capturePage(afterBase, outputDir, "security-settings.png", "/settings/security", 1440, 900));
  report.captures.push(await capturePage(afterBase, outputDir, "personal-settings-mobile.png", "/settings/profile", 390, 844));

  const beforeHome = await capturePage(beforeBase, beforeDir, "home-1440x900.png", "/?view=dashboard", 1440, 900);
  const beforeProjects = await capturePage(beforeBase, beforeDir, "projects-1440x900.png", "/?view=projects", 1440, 900);
  const beforeAccount = await captureAction("account-menu-open.png", "/?view=projects", 1440, 900, openDesktopAccount, beforeBase, beforeDir);
  report.captures.push(beforeHome, beforeProjects, beforeAccount);

  const planeWorkspace = await remoteDataUrl("https://media.docs.plane.so/tutorials/explore-layouts.webp", "image/webp");
  const planeBoard = await remoteDataUrl("https://plane.so/api/media/file/open-source-kanban-hero.webp", "image/webp");
  const comparisons = [
    ["project-library-comparison.png", beforeProjects.path, planeWorkspace, path.join(outputDir, "projects-1440x900.png"), "Project library"],
    ["home-comparison.png", beforeHome.path, planeBoard, path.join(outputDir, "home-1440x900.png"), "Home"],
    ["account-menu-comparison.png", beforeAccount.path, planeWorkspace, path.join(outputDir, "account-menu-open.png"), "Account menu"],
    ["profile-settings-comparison.png", beforeAccount.path, planeWorkspace, path.join(outputDir, "profile-settings.png"), "Personal profile"],
  ];
  for (const [filename, beforePath, reference, afterPath, topic] of comparisons) {
    await composeComparison(filename, topic, await localDataUrl(beforePath), reference, await localDataUrl(afterPath));
    report.comparisons.push({ filename, topic, before: path.relative(root, beforePath), reference: "Plane official public interface reference", after: path.relative(root, afterPath) });
  }

  report.passed = report.captures.every((capture) => !capture.consoleErrors.length && !capture.pageErrors.length && capture.horizontalOverflow <= 0);
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}

async function createPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addInitScript(() => window.localStorage.setItem("gridproject.navCollapsed", "false"));
  return page;
}

async function capturePage(baseURL, directory, filename, route, width, height) {
  const page = await createPage(width, height);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(directory, filename), fullPage: false });
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.close();
  return { filename, route, viewport: { width, height }, path: path.join(directory, filename), horizontalOverflow, ...diagnostics };
}

async function captureAction(filename, route, width, height, action, baseURL = afterBase, directory = outputDir) {
  const page = await createPage(width, height);
  const diagnostics = observe(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await action(page);
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(directory, filename), fullPage: false });
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.close();
  return { filename, route, viewport: { width, height }, path: path.join(directory, filename), horizontalOverflow, ...diagnostics };
}

async function openDesktopAccount(page) {
  await page.locator(".account-trigger").click();
  await page.locator(".account-popover").waitFor();
}

async function openMobileAccount(page) {
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.locator(".account-trigger").click();
  await page.getByRole("menu").waitFor();
}

function observe(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}

async function composeComparison(filename, topic, before, reference, after) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 430 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#eceff3;color:#17191c;font-family:Inter,"PingFang SC",sans-serif}main{height:430px;padding:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{min-width:0;padding:12px;border:1px solid #d7dbe2;border-radius:8px;background:#fff;display:grid;align-content:start;gap:8px}h2{margin:0;font-size:15px;line-height:22px}figure{min-width:0;aspect-ratio:16/9;margin:0;border:1px solid #dfe3e8;background:#f7f8fa;overflow:hidden}img{width:100%;height:100%;object-fit:cover;object-position:top left}p{margin:0;color:#646c78;font-size:11px;line-height:17px}
  </style></head><body><main>
    ${panel(`R2 前 · ${topic}`, before, "GridProject e43a054 · 1440×900")}
    ${panel(`Plane 官方参考 · ${topic}`, reference, "公开产品界面参考；附件未包含同页截图")}
    ${panel(`R2 后 · ${topic}`, after, "当前分支 · 1440×900")}
  </main></body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: path.join(comparisonDir, filename), fullPage: false });
  await page.close();
}

function panel(title, image, source) {
  return `<article><h2>${escapeHtml(title)}</h2><figure><img src="${image}" alt="${escapeHtml(title)}"></figure><p>${escapeHtml(source)}</p></article>`;
}

async function localDataUrl(filePath) {
  const buffer = await readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function remoteDataUrl(url, mime) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Plane reference download failed (${response.status}): ${url}`);
  return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}
