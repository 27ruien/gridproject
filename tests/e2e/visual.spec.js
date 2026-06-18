import { expect, test } from "@playwright/test";

const viewports = [
  ["1920x1080", { width: 1920, height: 1080 }],
  ["1440x900", { width: 1440, height: 900 }],
  ["1280x800", { width: 1280, height: 800 }],
  ["1024x768", { width: 1024, height: 768 }],
  ["768x1024", { width: 768, height: 1024 }],
  ["390x844", { width: 390, height: 844 }],
];

const visualCases = [
  ["dashboard", "/?view=dashboard"],
  ["project-header", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88"],
  ["project-overview", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88"],
  ["issue-detail", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88&issue=i1"],
  ["issue-modal", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", async (page) => {
    await page.getByRole("button", { name: "新建事项" }).click();
  }],
  ["filters-expanded", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", async (page) => {
    await page.getByRole("button", { name: "更多筛选" }).click();
  }],
  ["board", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF"],
  ["gantt", "/?view=project&project=crm&tab=%E7%94%98%E7%89%B9%E5%9B%BE"],
  ["timesheets", "/?view=timesheets"],
  ["costs", "/?view=costs"],
  ["cost-detail", "/?view=costs", async (page) => {
    await page.getByRole("button", { name: "查看详情" }).first().click();
  }],
  ["long-text", "/?qa=long&view=dashboard"],
  ["bulk-gantt", "/?qa=bulk&view=project&project=crm&tab=%E7%94%98%E7%89%B9%E5%9B%BE"],
  ["empty-dashboard", "/?qa=empty&view=dashboard"],
];

const zoomCases = [
  ["dashboard", "/?view=dashboard", "查看全部"],
  ["project-overview", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", "新建事项"],
  ["issue-detail", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88&issue=i1", "保存事项"],
  ["board", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", "select"],
];

const targetedScreenshotTolerance = new Map([
  ["gantt-1440-viewport.png", { maxDiffPixelRatio: 0.035 }],
  ["gantt-1440-full.png", { maxDiffPixelRatio: 0.035 }],
  ["project-overview-mobile-390-viewport.png", { maxDiffPixelRatio: 0.035 }],
]);

test.describe("visual baselines", () => {
  for (const [label, viewport] of viewports) {
    test(`dashboard ${label} viewport and full page`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndSettle(page, "/?view=dashboard");
      await assertPageHealth(page);
      await expectStableScreenshot(page, `dashboard-${label}-viewport.png`);
      await expectStableScreenshot(page, `dashboard-${label}-full.png`, { fullPage: true });
    });
  }

  for (const [name, url, interact] of visualCases) {
    test(`${name} desktop viewport and full page`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndSettle(page, url);
      if (interact) {
        await interact(page);
        await page.waitForTimeout(200);
      }
      await assertPageHealth(page);
      await expectStableScreenshot(page, `${name}-1440-viewport.png`);
      await expectStableScreenshot(page, `${name}-1440-full.png`, { fullPage: true });
    });
  }

  for (const [name, url, selector] of [
    ["projects-mobile", "/?view=projects", ".project-mobile-list"],
    ["project-overview-mobile", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", ".workspace-grid"],
    ["issue-detail-mobile", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88&issue=i1", ".detail-panel"],
    ["issue-modal-mobile", "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", ".modal"],
    ["board-mobile", "/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", ".board-mobile-list"],
    ["gantt-mobile", "/?view=project&project=crm&tab=%E7%94%98%E7%89%B9%E5%9B%BE", ".gantt-mobile-list"],
    ["timesheets-mobile", "/?view=timesheets", ".timesheet-mobile-list"],
    ["costs-mobile", "/?view=costs", ".cost-mobile-list"],
  ]) {
    test(`${name} 390 viewport and full page`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndSettle(page, url);
      if (name === "issue-modal-mobile") await page.getByRole("button", { name: "新建事项" }).click();
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await assertPageHealth(page);
      await expectStableScreenshot(page, `${name}-390-viewport.png`);
      await expectStableScreenshot(page, `${name}-390-full.png`, { fullPage: true });
    });
  }

  for (const zoom of [1.25, 1.5, 2]) {
    for (const [name, url, control] of zoomCases) {
      const label = `${Math.round(zoom * 100)}`;
      test(`${name} browser zoom ${label}%`, async ({ page }) => {
        await page.setViewportSize({
          width: Math.floor(1440 / zoom),
          height: Math.floor(900 / zoom),
        });
        await gotoAndSettle(page, url);
        await assertPageHealth(page);
        await assertCriticalControl(page, control);
        await expectStableScreenshot(page, `zoom-${label}-${name}-viewport.png`);
        await expectStableScreenshot(page, `zoom-${label}-${name}-full.png`, { fullPage: true });
      });
    }
  }
});

async function expectStableScreenshot(page, name, options = {}) {
  await expect(page).toHaveScreenshot(name, {
    ...(targetedScreenshotTolerance.get(name) || {}),
    ...options,
  });
}

async function gotoAndSettle(page, url) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
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
  await page.waitForTimeout(250);
  page.__consoleErrors = consoleErrors;
  page.__pageErrors = pageErrors;
}

async function assertCriticalControl(page, control) {
  if (control === "select") {
    const select = page.locator(".board select:visible, .board-mobile-list select:visible").first();
    await expect(select).toBeVisible();
    await expect(select).toBeEnabled();
    return;
  }

  const button = page.getByRole("button", { name: control }).first();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
}

async function assertPageHealth(page) {
  const issues = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const allowedScrollSelectors = [
      ".board",
      ".gantt-grid",
      ".data-table",
      ".issue-table",
      ".timesheet-table",
      ".cost-table",
      ".cost-raw-table",
      ".pm-project-table",
      ".segmented-control",
      ".project-tabs",
      ".drawer-tabs",
    ];
    const ignoredSelectors = [
      "script",
      "style",
      "template",
      ".sidebar:not(.open)",
    ];

    const elementOverflow = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => !ignoredSelectors.some((selector) => element.matches(selector) || element.closest(selector)))
      .filter((element) => !allowedScrollSelectors.some((selector) => element.closest(selector)))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          selector: describeElement(element),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
          overflow: rect.left < -2 || rect.right > width + 2,
        };
      })
      .filter((item) => item.visible && item.overflow);

    const dialogOverflow = Array.from(document.querySelectorAll(".modal, .detail-panel"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: describeElement(element),
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          overflow: rect.left < -2 || rect.top < -2 || rect.right > width + 2 || rect.bottom > height + 2,
        };
      })
      .filter((item) => item.overflow);

    return {
      viewport: { width, height },
      documentOverflow: document.documentElement.scrollWidth > width + 2,
      scrollWidth: document.documentElement.scrollWidth,
      elementOverflow,
      dialogOverflow,
    };

    function describeElement(element) {
      const className = typeof element.className === "string" ? element.className.trim().replace(/\s+/g, ".") : "";
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${className ? `.${className}` : ""}`;
    }
  });

  expect(page.__consoleErrors || [], "console errors").toEqual([]);
  expect(page.__pageErrors || [], "page errors").toEqual([]);
  expect(issues.documentOverflow, `document scrollWidth ${issues.scrollWidth} > viewport ${issues.viewport.width}`).toBe(false);
  expect(issues.elementOverflow, "visible element horizontal overflow").toEqual([]);
  expect(issues.dialogOverflow, "dialog overflow").toEqual([]);
}
