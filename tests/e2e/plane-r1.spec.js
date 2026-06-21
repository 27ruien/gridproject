import { expect, test } from "@playwright/test";

test("project workspace uses compact context hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=迭代", { waitUntil: "networkidle" });

  await expect(page.locator(".topbar-context")).toContainText("项目库");
  await expect(page.locator(".topbar-context")).toContainText("CRM 线索协同");
  await expect(page.locator(".project-context-header h1")).toHaveText("CRM 线索协同");
  await expect(page.getByRole("heading", { name: "项目空间" })).toHaveCount(0);
  await expect(page.locator(".project-attribute-grid")).toHaveCount(0);

  await page.locator(".project-properties-menu > summary").click();
  await expect(page.locator(".project-properties-popover")).toContainText("执行团队");
  await expect(page.locator(".project-properties-popover")).toContainText("上线");
});

test("issue row keeps inline actions separate from detail navigation", async ({ page }) => {
  await page.goto("/?view=project&project=crm&tab=迭代", { waitUntil: "networkidle" });
  const row = page.locator(".issue-table-row").first();

  await expect(row.locator("select")).toHaveCount(0);
  await expect(row.locator(".issue-code")).toHaveText(/AGL-/);
  await row.locator(".issue-row-menu .icon-btn").click();
  await expect(row.locator(".issue-menu-option")).toHaveCount(4);
  await expect(page.locator(".detail-panel")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await row.click({ position: { x: 180, y: 20 } });
  await expect(page.locator(".detail-panel")).toBeVisible();
  await expect(row).toHaveClass(/selected/);
});

test("kanban card changes status through drag and has no persistent select", async ({ page }) => {
  await page.goto("/?view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", { waitUntil: "networkidle" });
  const desktopBoard = page.locator(".board");
  const firstColumn = desktopBoard.locator(".board-column").first();
  const secondColumn = desktopBoard.locator(".board-column").nth(1);
  const card = firstColumn.locator(".issue-card").first();
  const code = await card.locator(".issue-code").innerText();

  await expect(card.locator("select")).toHaveCount(0);
  await card.dragTo(secondColumn);
  await expect(secondColumn.locator(".issue-card").filter({ hasText: code })).toBeVisible();
});

test("mobile list and board stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["迭代", "看板"]) {
    await page.goto(`/?view=project&project=crm&tab=${encodeURIComponent(tab)}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator(".project-context-header h1")).toBeVisible();
  }
});

test("R1 revision keeps Chinese views and opens project status on demand", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=Backlog", { waitUntil: "networkidle" });

  await expect(page.getByRole("tab", { name: "待办事项" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "迭代" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Backlog" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Sprint" })).toHaveCount(0);
  await expect(page.locator(".project-context-header select")).toHaveCount(0);

  await page.locator(".project-status-menu > summary").click();
  await expect(page.locator(".project-status-popover")).toBeVisible();
  await expect(page.locator(".project-status-popover > button")).toHaveCount(7);
});

test("R1 revision dense list and board use visual-only representative data", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?qa=plane-r1-list-dense&view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3", { waitUntil: "networkidle" });

  await expect(page.locator(".issue-table-row")).toHaveCount(24);
  await expect(page.locator(".issue-table-row .issue-type-icon .ui-icon")).toHaveCount(24);
  await expect(page.locator(".issue-table-row .issue-owner-avatar.unassigned")).toHaveCount(3);
  await expect(page.locator(".issue-table-row .issue-due-date.overdue")).toHaveCount(3);

  await page.goto("/?qa=plane-r1-board-dense&view=project&project=crm&tab=%E7%9C%8B%E6%9D%BF", { waitUntil: "networkidle" });
  await expect(page.locator(".board .issue-card")).toHaveCount(16);
  expect(await page.locator(".board-column").evaluateAll((columns) => columns.map((column) => column.querySelectorAll(".issue-card").length))).toEqual([6, 5, 3, 2]);
  await expect(page.locator(".board .issue-card select")).toHaveCount(0);
  await expect(page.locator(".board .issue-card-labels")).toHaveCount(16);
});

test("R1 revision mobile header and toolbar stay compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?qa=plane-r1-list-dense&view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3", { waitUntil: "networkidle" });

  const measurements = await page.evaluate(() => {
    const header = document.querySelector(".project-context-header").getBoundingClientRect();
    const tabs = document.querySelector(".project-view-tabs").getBoundingClientRect();
    const toolbar = document.querySelector(".view-toolbar");
    const actions = [...toolbar.children].filter((element) => !element.classList.contains("view-toolbar-chips"));
    const tops = actions.map((element) => element.getBoundingClientRect().top);
    return {
      headerHeight: header.height,
      headerToTabs: tabs.top - header.top,
      toolbarHeight: toolbar.getBoundingClientRect().height,
      toolbarTopSpread: Math.max(...tops) - Math.min(...tops),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(measurements.headerHeight).toBeLessThanOrEqual(96);
  expect(measurements.headerToTabs).toBeLessThanOrEqual(160);
  expect(measurements.toolbarHeight).toBeLessThanOrEqual(48);
  expect(measurements.toolbarTopSpread).toBeLessThanOrEqual(2);
  expect(measurements.overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".mobile-search-menu")).toBeVisible();
  await expect(page.locator(".view-toolbar-chips")).toHaveCount(0);

  await page.goto("/?qa=plane-r1-list-dense&view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3&filters=%7B%22owner%22%3A%22%E6%9E%97%E5%A4%8F%22%7D", { waitUntil: "networkidle" });
  await expect(page.locator(".view-toolbar-chips")).toBeVisible();
  expect(await page.evaluate(() => {
    const firstRow = document.querySelector(".view-toolbar-main").getBoundingClientRect();
    const chips = document.querySelector(".view-toolbar-chips").getBoundingClientRect();
    return chips.top >= firstRow.bottom;
  })).toBe(true);
});

test("R1 revision exposes both Sidebar navigation options for review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3&projectNav=sidebar", { waitUntil: "networkidle" });
  await expect(page.locator(".project-sidebar-context")).toBeVisible();
  await expect(page.locator(".project-sidebar-nav .project-nav-item")).toHaveCount(7);
  await expect(page.locator(".project-sidebar-nav .project-nav-item.active")).toContainText("迭代");

  await page.goto("/?view=project&project=crm&tab=%E8%BF%AD%E4%BB%A3", { waitUntil: "networkidle" });
  await expect(page.locator(".project-sidebar-context")).toHaveCount(0);
  await expect(page.locator(".project-view-tabs")).toBeVisible();
});
