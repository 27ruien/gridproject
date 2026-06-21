import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";
const outputDir = path.join(root, "artifacts/plane-r1-revision");
const comparisonDir = path.join(outputDir, "comparison");
const beforeDir = path.join(root, "artifacts/plane-r1/after");

await mkdir(outputDir, { recursive: true });
await mkdir(comparisonDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), baseURL, captures: [], measurements: {} };
const listRoute = "/?qa=plane-r1-list-dense&view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3";
const boardRoute = "/?qa=plane-r1-board-dense&view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF";

const cases = [
  ["project-list-1440x900.png", listRoute, 1440, 900],
  ["project-board-1440x900.png", boardRoute, 1440, 900],
  ["project-list-1280x800.png", listRoute, 1280, 800],
  ["project-board-1280x800.png", boardRoute, 1280, 800],
  ["project-list-390x844.png", listRoute, 390, 844],
  ["project-board-390x844.png", boardRoute, 390, 844],
  ["dense-list.png", listRoute, 1440, 900],
  ["dense-board.png", boardRoute, 1440, 900],
  ["sidebar-a-project-nav-1440x900.png", `${listRoute}&projectNav=sidebar`, 1440, 900],
  ["sidebar-b-tabs-only-1440x900.png", listRoute, 1440, 900],
];

try {
  for (const [filename, route, width, height] of cases) {
    report.captures.push(await capture(filename, route, width, height));
  }

  report.captures.push(await captureElement("project-header-mobile.png", listRoute, 390, 844, ".project-context-header"));
  report.captures.push(await captureElement("toolbar-mobile.png", listRoute, 390, 844, ".view-toolbar"));

  const planeList = await remoteDataUrl("https://media.docs.plane.so/tutorials/explore-layouts.webp", "image/webp");
  const planeBoard = await remoteDataUrl("https://plane.so/api/media/file/open-source-kanban-hero.webp", "image/webp");
  const beforeList = await localDataUrl(path.join(beforeDir, "project-list-1440x900.png"));
  const beforeBoard = await localDataUrl(path.join(beforeDir, "project-board-1440x900.png"));
  const afterList = await localDataUrl(path.join(outputDir, "project-list-1440x900.png"));
  const afterBoard = await localDataUrl(path.join(outputDir, "project-board-1440x900.png"));
  const sidebarA = await localDataUrl(path.join(outputDir, "sidebar-a-project-nav-1440x900.png"));
  const crops = {
    sidebar: [
      await cropDataUrl(beforeList, { x: 0, y: 0, width: 800, height: 450 }),
      await cropDataUrl(planeList, { x: 0, y: 0, width: 1800, height: 1012 }),
      await cropDataUrl(sidebarA, { x: 0, y: 0, width: 800, height: 450 }),
    ],
    header: [
      await cropDataUrl(beforeList, { x: 220, y: 45, width: 1000, height: 562 }),
      await cropDataUrl(planeList, { x: 420, y: 0, width: 1800, height: 1012 }),
      await cropDataUrl(afterList, { x: 220, y: 45, width: 1000, height: 562 }),
    ],
    toolbar: [
      await cropDataUrl(beforeList, { x: 220, y: 120, width: 1000, height: 562 }),
      await cropDataUrl(planeList, { x: 1420, y: 0, width: 1800, height: 1012 }),
      await cropDataUrl(afterList, { x: 220, y: 120, width: 1000, height: 562 }),
    ],
    issueRow: [
      await cropDataUrl(beforeList, { x: 220, y: 200, width: 1000, height: 562 }),
      await cropDataUrl(planeList, { x: 440, y: 180, width: 1800, height: 1012 }),
      await cropDataUrl(afterList, { x: 220, y: 200, width: 1000, height: 562 }),
    ],
    kanbanColumn: [
      await cropDataUrl(beforeBoard, { x: 220, y: 170, width: 1100, height: 619 }),
      await cropDataUrl(planeBoard, { x: 760, y: 500, width: 1500, height: 844 }),
      await cropDataUrl(afterBoard, { x: 220, y: 170, width: 1100, height: 619 }),
    ],
    kanbanCard: [
      await cropDataUrl(beforeBoard, { x: 220, y: 210, width: 1000, height: 562 }),
      await cropDataUrl(planeBoard, { x: 980, y: 650, width: 1200, height: 675 }),
      await cropDataUrl(afterBoard, { x: 220, y: 210, width: 1000, height: 562 }),
    ],
  };

  const comparisons = [
    ["sidebar-comparison.png", [
      panel("R1 修正前", crops.sidebar[0], "相同 1440×900 viewport"),
      panel("Plane List 参考", crops.sidebar[1], "Plane 官方 List 视图"),
      panel("R1 修正后 A", crops.sidebar[2], "相同 1440×900 viewport"),
    ]],
    ["project-header-comparison.png", [
      panel("R1 修正前", crops.header[0], "相同 1440×900 viewport"),
      panel("Plane List 参考", crops.header[1], "Plane 官方 List 视图"),
      panel("R1 修正后", crops.header[2], "相同 1440×900 viewport"),
    ]],
    ["toolbar-comparison.png", [
      panel("R1 修正前", crops.toolbar[0], "相同 1440×900 viewport"),
      panel("Plane List 参考", crops.toolbar[1], "Plane 官方 List 视图"),
      panel("R1 修正后", crops.toolbar[2], "相同 1440×900 viewport"),
    ]],
    ["issue-row-comparison.png", [
      panel("R1 修正前", crops.issueRow[0], "相同 1440×900 viewport"),
      panel("Plane List 参考", crops.issueRow[1], "Plane 官方 List 视图"),
      panel("R1 修正后", crops.issueRow[2], "相同 1440×900 viewport"),
    ]],
    ["kanban-column-comparison.png", [
      panel("R1 修正前", crops.kanbanColumn[0], "相同 1440×900 viewport"),
      panel("Plane Board 参考", crops.kanbanColumn[1], "Plane 官方 Board 视图"),
      panel("R1 修正后", crops.kanbanColumn[2], "相同 1440×900 viewport"),
    ]],
    ["kanban-card-comparison.png", [
      panel("R1 修正前", crops.kanbanCard[0], "相同 1440×900 viewport"),
      panel("Plane Board 参考", crops.kanbanCard[1], "Plane 官方 Board 视图"),
      panel("R1 修正后", crops.kanbanCard[2], "相同 1440×900 viewport"),
    ]],
  ];

  for (const [filename, panels] of comparisons) await composeComparison(filename, panels);

  report.passed = report.captures.every((result) => (
    result.consoleErrors.length === 0 &&
    result.pageErrors.length === 0 &&
    result.horizontalOverflow <= 0
  ));
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

async function capture(filename, route, width, height) {
  const page = await createPage(width, height);
  const diagnostics = observeErrors(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  const measurements = await collectMeasurements(page);
  report.measurements[filename] = measurements;
  await page.close();
  return { filename, route, viewport: { width, height }, ...diagnostics, horizontalOverflow: measurements.horizontalOverflow };
}

async function captureElement(filename, route, width, height, selector) {
  const page = await createPage(width, height);
  const diagnostics = observeErrors(page);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  const target = page.locator(selector);
  await target.screenshot({ path: path.join(outputDir, filename) });
  const measurements = await collectMeasurements(page);
  report.measurements[filename] = measurements;
  await page.close();
  return { filename, route, viewport: { width, height }, selector, ...diagnostics, horizontalOverflow: measurements.horizontalOverflow };
}

function observeErrors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}

async function collectMeasurements(page) {
  return page.evaluate(() => {
    const height = (selector) => Math.round(document.querySelector(selector)?.getBoundingClientRect().height || 0);
    const toolbar = document.querySelector(".view-toolbar");
    const toolbarTops = toolbar
      ? [...toolbar.children].filter((element) => element.getBoundingClientRect().height).map((element) => element.getBoundingClientRect().top).sort((a, b) => a - b)
      : [];
    const toolbarRows = toolbarTops.reduce((rows, top) => {
      if (!rows.some((rowTop) => Math.abs(rowTop - top) <= 3)) rows.push(top);
      return rows;
    }, []).length;
    return {
      headerHeight: height(".project-context-header"),
      toolbarHeight: height(".view-toolbar"),
      toolbarRows,
      issueRows: document.querySelectorAll(".issue-table-row").length,
      mobileIssueCards: document.querySelectorAll(".issue-mobile-card").length,
      boardCards: document.querySelectorAll(".board .issue-card").length,
      boardCardDistribution: [...document.querySelectorAll(".board-column")].map((column) => column.querySelectorAll(".issue-card").length),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function composeComparison(filename, panels) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 430 }, deviceScaleFactor: 1 });
  await page.setContent(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #eceef1; color: #17191c; font-family: Inter, "PingFang SC", sans-serif; }
          main { height: 430px; padding: 18px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          article { min-width: 0; padding: 12px; border: 1px solid #d7dbe2; border-radius: 8px; background: #fff; display: grid; align-content: start; gap: 8px; }
          h2 { margin: 0; font-size: 15px; line-height: 22px; }
          figure { min-width: 0; aspect-ratio: 16 / 9; margin: 0; border: 1px solid #dfe3e8; background: #f7f8fa; overflow: hidden; }
          img { width: 100%; height: 100%; object-fit: cover; }
          p { margin: 0; color: #646c78; font-size: 11px; line-height: 17px; }
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

async function cropDataUrl(source, crop) {
  const page = await browser.newPage({ viewport: { width: crop.width, height: crop.height }, deviceScaleFactor: 1 });
  const result = await page.evaluate(async ({ imageSource, region }) => {
    const image = new Image();
    image.src = imageSource;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = region.width;
    canvas.height = region.height;
    canvas.getContext("2d").drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    return canvas.toDataURL("image/png");
  }, { imageSource: source, region: crop });
  await page.close();
  return result;
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
