import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";
const afterDir = path.join(root, "artifacts/plane-r1/after");
const comparisonDir = path.join(root, "artifacts/plane-r1/comparison");
const baselineDir = path.join(root, "artifacts/ui-review/after");

await mkdir(afterDir, { recursive: true });
await mkdir(comparisonDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), baseURL, captures: [] };

const cases = [
  ["project-list-1440x900.png", "/?view=project&project=crm&tab=Sprint", 1440, 900],
  ["project-board-1440x900.png", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", 1440, 900],
  ["project-list-1280x800.png", "/?view=project&project=crm&tab=Sprint", 1280, 800],
  ["project-board-1280x800.png", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", 1280, 800],
  ["project-list-390x844.png", "/?view=project&project=crm&tab=Sprint", 390, 844],
  ["project-board-390x844.png", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", 390, 844],
];

try {
  for (const [filename, route, width, height] of cases) {
    report.captures.push(await capture(filename, route, width, height));
  }

  const planeProjectOverview = await remoteDataUrl("https://media.docs.plane.so/projects/access-project-overview.webp", "image/webp");
  const planeKanban = await remoteDataUrl("https://plane.so/api/media/file/open-source-kanban-hero.webp", "image/webp");
  const planeShell = await remoteDataUrl("https://plane.so/api/media/file/hero-projectmanagement-v2-1.webp", "image/webp");

  await composeComparison("project-list-comparison.png", [
    panel("Before GridProject", await localDataUrl(path.join(baselineDir, "project-overview-1440.png")), "Baseline: artifacts/ui-review/after/project-overview-1440.png"),
    panel("Plane reference", planeProjectOverview, "https://docs.plane.so/core-concepts/projects/project-overview"),
    panel("After GridProject", await localDataUrl(path.join(afterDir, "project-list-1440x900.png")), "R1 real project list"),
  ]);

  await composeComparison("project-board-comparison.png", [
    panel("Before GridProject", await localDataUrl(path.join(baselineDir, "board-1440.png")), "Baseline: artifacts/ui-review/after/board-1440.png"),
    panel("Plane reference", planeKanban, "https://plane.so/open-source"),
    panel("After GridProject", await localDataUrl(path.join(afterDir, "project-board-1440x900.png")), "R1 real Kanban board"),
  ]);

  await composeComparison("shell-comparison.png", [
    panel("Before GridProject", await localDataUrl(path.join(baselineDir, "default-1440x900.png")), "Baseline: artifacts/ui-review/after/default-1440x900.png"),
    panel("Plane reference", planeShell, "https://plane.so/project-management"),
    panel("After GridProject", await localDataUrl(path.join(afterDir, "project-list-1440x900.png")), "R1 application shell"),
  ]);

  report.passed = report.captures.every((captureResult) => (
    captureResult.consoleErrors.length === 0 &&
    captureResult.pageErrors.length === 0 &&
    captureResult.horizontalOverflow <= 0
  ));
  await writeFile(path.join(root, "artifacts/plane-r1/report.json"), `${JSON.stringify(report, null, 2)}\n`);

  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}

async function capture(filename, route, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(afterDir, filename), fullPage: false });
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.close();
  return { filename, route, viewport: { width, height }, consoleErrors, pageErrors, horizontalOverflow };
}

async function composeComparison(filename, panels) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 650 }, deviceScaleFactor: 1 });
  await page.setContent(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #eef0f3; color: #17191c; font-family: Inter, "PingFang SC", sans-serif; }
          main { height: 650px; padding: 24px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
          article { min-width: 0; padding: 14px; border: 1px solid #d9dde4; border-radius: 8px; background: #fff; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; }
          h2 { margin: 0; font-size: 16px; line-height: 24px; }
          figure { min-width: 0; min-height: 0; margin: 0; border: 1px solid #e1e4e9; background: #f7f8fa; overflow: hidden; display: grid; place-items: center; }
          img { width: 100%; height: 100%; object-fit: contain; }
          p { margin: 0; min-height: 36px; color: #5c6470; font-size: 11px; line-height: 18px; overflow-wrap: anywhere; }
        </style>
      </head>
      <body><main>${panels.map(({ title, image, source }) => `
        <article><h2>${escapeHtml(title)}</h2><figure><img src="${image}" alt="${escapeHtml(title)}" /></figure><p>${escapeHtml(source)}</p></article>
      `).join("")}</main></body>
    </html>
  `, { waitUntil: "load" });
  await page.screenshot({ path: path.join(comparisonDir, filename), fullPage: false });
  await page.close();
}

function panel(title, image, source) {
  return { title, image, source };
}

async function localDataUrl(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).slice(1).replace("jpg", "jpeg");
  return `data:image/${extension};base64,${buffer.toString("base64")}`;
}

async function remoteDataUrl(url, mime) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Reference download failed (${response.status}): ${url}`);
  return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}
