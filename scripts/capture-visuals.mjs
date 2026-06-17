import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173/";
const outputDir = process.env.OUTPUT_DIR || fileURLToPath(new URL("../outputs/screenshots", import.meta.url));

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

async function capture(name, query, viewport, interact) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}${query}`, { waitUntil: "load" });
  await page.waitForTimeout(350);
  if (interact) {
    await interact(page);
    await page.waitForTimeout(300);
  }
  const metrics = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const dialogOverflow = Array.from(document.querySelectorAll(".modal, .detail-panel"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.className,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          overflow: rect.left < -2 || rect.top < -2 || rect.right > width + 2 || rect.bottom > height + 2,
        };
      })
      .filter((item) => item.overflow);
    const viewportOverflow = Array.from(document.querySelectorAll("body > *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          overflow: rect.left < -2 || rect.right > width + 2,
        };
      })
      .filter((item) => item.overflow);

    return {
      width,
      height,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > width + 2,
      dialogOverflow,
      viewportOverflow,
    };
  });
  const file = `${outputDir}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  results.push({ name, file, viewport, query, metrics, consoleErrors, pageErrors });
  await context.close();
}

const viewportCases = [
  ["default-1920x1080", "?view=dashboard", { width: 1920, height: 1080 }],
  ["default-1440x900", "?view=dashboard", { width: 1440, height: 900 }],
  ["default-1280x800", "?view=dashboard", { width: 1280, height: 800 }],
  ["default-1024x768", "?view=dashboard", { width: 1024, height: 768 }],
  ["default-768x1024", "?view=dashboard", { width: 768, height: 1024 }],
  ["default-390x844", "?view=dashboard", { width: 390, height: 844 }],
];

for (const [name, query, viewport] of viewportCases) {
  await capture(name, query, viewport);
}

await capture("mobile-nav-open-390", "?view=dashboard", { width: 390, height: 844 }, async (page) => {
  await page.getByRole("button", { name: "打开导航" }).click();
});
await capture("projects-mobile-390", "?view=projects", { width: 390, height: 844 });
await capture("project-overview-mobile-390", "?view=project&project=crm&tab=概览", { width: 390, height: 844 });
await capture("issue-detail-open-mobile-390", "?view=project&project=crm&tab=概览&issue=i1", { width: 390, height: 844 });
await capture("issue-modal-open-mobile-390", "?view=project&project=crm&tab=概览", { width: 390, height: 844 }, async (page) => {
  await page.getByRole("button", { name: "新建事项" }).click();
});
await capture("board-mobile-390", "?view=project&project=crm&tab=看板", { width: 390, height: 844 }, async (page) => {
  await page.evaluate(() => document.querySelector(".board-mobile-list")?.scrollIntoView({ block: "start" }));
});
await capture("gantt-mobile-390", "?view=project&project=crm&tab=甘特图", { width: 390, height: 844 }, async (page) => {
  await page.evaluate(() => document.querySelector(".gantt-mobile-list")?.scrollIntoView({ block: "start" }));
});
await capture("timesheets-mobile-390", "?view=timesheets", { width: 390, height: 844 }, async (page) => {
  await page.evaluate(() => document.querySelector(".timesheet-mobile-list")?.scrollIntoView({ block: "start" }));
});
await capture("project-overview-1440", "?view=project&project=crm&tab=概览", { width: 1440, height: 900 });
await capture("issue-detail-open-1440", "?view=project&project=crm&tab=概览&issue=i1", { width: 1440, height: 900 });
await capture("issue-modal-open-1440", "?view=project&project=crm&tab=概览", { width: 1440, height: 900 }, async (page) => {
  await page.getByRole("button", { name: "新建事项" }).click();
});
await capture("filters-expanded-1440", "?view=project&project=crm&tab=概览", { width: 1440, height: 900 }, async (page) => {
  await page.getByRole("button", { name: "更多筛选" }).click();
});
await capture("board-1440", "?view=project&project=crm&tab=看板", { width: 1440, height: 900 });
await capture("gantt-1440", "?view=project&project=crm&tab=甘特图", { width: 1440, height: 900 });
await capture("timesheet-filters-1440", "?view=timesheets", { width: 1440, height: 900 }, async (page) => {
  await page.getByRole("button", { name: /更多筛选/ }).click();
});
await capture("global-search-1440", "?view=dashboard", { width: 1440, height: 900 }, async (page) => {
  await page.getByPlaceholder("搜索项目、事项或负责人").fill("CRM");
});
await capture("long-text-1440", "?qa=long&view=dashboard", { width: 1440, height: 900 });
await capture("bulk-gantt-1440", "?qa=bulk&view=project&project=crm&tab=甘特图", { width: 1440, height: 900 });
await capture("empty-dashboard-1440", "?qa=empty&view=dashboard", { width: 1440, height: 900 });

for (const [label, factor] of [["zoom-80", 0.8], ["zoom-100", 1], ["zoom-125", 1.25], ["zoom-150", 1.5], ["zoom-200", 2]]) {
  await capture(label, "?view=dashboard", { width: 1440, height: 900 }, async (page) => {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: factor });
  });
}

await writeFile(`${outputDir}/visual-report.json`, JSON.stringify(results, null, 2));
await browser.close();

const summary = results.map((item) => ({
  name: item.name,
  file: item.file,
  overflow: item.metrics.hasHorizontalOverflow,
  width: item.metrics.width,
  scrollWidth: item.metrics.scrollWidth,
  consoleErrors: item.consoleErrors.length,
  pageErrors: item.pageErrors.length,
  dialogOverflow: item.metrics.dialogOverflow.length,
  viewportOverflow: item.metrics.viewportOverflow.length,
}));

console.log(JSON.stringify(summary, null, 2));

const failed = results.filter((item) => (
  item.metrics.hasHorizontalOverflow ||
  item.consoleErrors.length ||
  item.pageErrors.length ||
  item.metrics.dialogOverflow.length ||
  item.metrics.viewportOverflow.length
));

if (failed.length) {
  console.error(`Visual checks failed for: ${failed.map((item) => item.name).join(", ")}`);
  process.exitCode = 1;
}
