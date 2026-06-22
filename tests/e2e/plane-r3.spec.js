import { expect, test } from "@playwright/test";

const r3 = "/?qa=plane-r3";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("kiviflow-platform-state-v1");
    window.localStorage.removeItem("kiviflow-vue-mvp-state");
    window.localStorage.setItem("gridproject.navCollapsed", "false");
  });
});

test("R3 desktop workspaces render with Plane density and no page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const item of [
    ["gantt", `${r3}&view=project&project=crm&tab=甘特图`, ".gantt-workspace", ".gantt-task-row"],
    ["timesheet", `${r3}&view=timesheets`, ".timesheet-week-table", ".timesheet-week-row"],
    ["cost", `${r3}&view=costs`, ".cost-table", ".cost-table-row"],
    ["people", `${r3}&view=users`, ".people-table", ".people-table-row"],
    ["settings", `${r3}&view=settings`, ".platform-settings-shell", ".platform-settings-form"],
  ]) {
    const [name, url, container, row] = item;
    await gotoAndSettle(page, url);
    await expect(page.locator(container), `${name} container`).toBeVisible();
    await expect(page.locator(row).first(), `${name} first row`).toBeVisible();
    await assertPageHealth(page);
  }
});

test("R3 mobile uses purpose-built lists instead of compressed desktop tables", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const item of [
    ["gantt", `${r3}&view=project&project=crm&tab=甘特图`, ".gantt-mobile-list", ".gantt-workspace"],
    ["timesheet", `${r3}&view=timesheets`, ".timesheet-mobile-list", ".timesheet-week-table"],
    ["cost", `${r3}&view=costs`, ".cost-mobile-list", ".cost-table-row"],
    ["people", `${r3}&view=users`, ".people-mobile-list", ".user-table-row"],
  ]) {
    const [name, url, mobileSelector, desktopSelector] = item;
    await gotoAndSettle(page, url);
    await expect(page.locator(mobileSelector), `${name} mobile list`).toBeVisible();
    await expect(page.locator(desktopSelector).first(), `${name} desktop table`).toBeHidden();
    await assertPageHealth(page);
  }

  await gotoAndSettle(page, `${r3}&view=settings`);
  await expect(page.locator(".platform-settings-shell")).toBeVisible();
  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector(".platform-settings-sidebar").getBoundingClientRect();
    const form = document.querySelector(".platform-settings-form").getBoundingClientRect();
    return { sidebarBottom: sidebar.bottom, formTop: form.top, formWidth: form.width };
  });
  expect(layout.formTop).toBeGreaterThanOrEqual(layout.sidebarBottom - 1);
  expect(layout.formWidth).toBeLessThanOrEqual(390);
  await assertPageHealth(page);
});

test("R1 and R2 accepted workspaces still pass regression smoke checks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const item of [
    ["home", "/?qa=plane-r2-home&view=dashboard", ".due-section"],
    ["projects", "/?qa=plane-r2-projects-20&view=projects", ".project-card-grid"],
    ["project-list", "/?qa=plane-r1-list-dense&view=project&project=crm&tab=迭代", ".issue-table-row"],
    ["board", "/?qa=plane-r1-board-dense&view=project&project=crm&tab=看板", ".board"],
  ]) {
    const [name, url, selector] = item;
    await gotoAndSettle(page, url);
    await expect(page.locator(selector).first(), `${name} regression selector`).toBeVisible();
    await assertPageHealth(page);
  }

  await gotoAndSettle(page, "/?qa=plane-r2-projects-20&view=projects");
  await page.locator(".desktop-account-menu .account-trigger").click();
  await expect(page.locator(".account-popover")).toBeVisible();
  await assertPageHealth(page);

  await gotoAndSettle(page, "/settings/profile");
  await expect(page.locator(".personal-settings-view")).toBeVisible();
  await assertPageHealth(page);
});

async function gotoAndSettle(page, url) {
  page.__consoleErrors = [];
  page.__pageErrors = [];
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (message) => {
    if (message.type() === "error") page.__consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => page.__pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
}

async function assertPageHealth(page) {
  const issues = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const allowedScrollSelectors = [
      ".board",
      ".gantt-timeline-scroll",
      ".issue-table",
      ".timesheet-week-table",
      ".cost-table",
      ".cost-raw-table",
      ".project-tabs",
      ".segmented-control",
    ];
    const ignoredSelectors = [
      "script",
      "style",
      "template",
      ".sidebar:not(.open)",
    ];
    const overflow = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => !ignoredSelectors.some((selector) => element.matches(selector) || element.closest(selector)))
      .filter((element) => !allowedScrollSelectors.some((selector) => element.closest(selector)))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          selector: describe(element),
          visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
          left: rect.left,
          right: rect.right,
        };
      })
      .filter((item) => item.visible && (item.left < -2 || item.right > width + 2));

    return {
      documentOverflow: document.documentElement.scrollWidth > width + 2,
      scrollWidth: document.documentElement.scrollWidth,
      width,
      overflow,
    };

    function describe(element) {
      const className = typeof element.className === "string" ? element.className.trim().replace(/\s+/g, ".") : "";
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${className ? `.${className}` : ""}`;
    }
  });

  expect(page.__consoleErrors, "console errors").toEqual([]);
  expect(page.__pageErrors, "page errors").toEqual([]);
  expect(issues.documentOverflow, `document scrollWidth ${issues.scrollWidth} > viewport ${issues.width}`).toBe(false);
  expect(issues.overflow, "visible element horizontal overflow").toEqual([]);
}
