import { expect, test } from "@playwright/test";

test("nested person picker Escape only closes child overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建事项" }).click();
  await expect(page.getByRole("dialog", { name: "新建事项" })).toBeVisible();

  await page.locator(".modal .picker-trigger").first().click();
  await expect(page.locator(".picker-popover")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".picker-popover")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "新建事项" })).toBeVisible();
  await expect(page.locator(".modal .picker-trigger").first()).toBeFocused();
});

test("person picker stays in the viewport and closes on outside click", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto("/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建事项" }).click();
  const trigger = page.locator(".modal .picker-trigger").first();
  await trigger.click();
  const popover = page.locator(".picker-popover");
  await expect(popover).toBeVisible();
  const box = await popover.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1024);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await page.mouse.click(4, 4);
  await expect(popover).toHaveCount(0);
});

test("issue status menu does not open the issue detail", async ({ page }) => {
  await page.goto("/?view=project&project=crm&tab=迭代", { waitUntil: "networkidle" });
  const firstRow = page.locator(".issue-table-row").first();
  await firstRow.locator(".issue-row-menu .icon-btn").click();
  await firstRow.locator(".issue-menu-option").nth(1).click();
  await expect(page.locator(".detail-panel")).toHaveCount(0);
  await firstRow.click({ position: { x: 90, y: 20 } });
  await expect(page.locator(".detail-panel")).toBeVisible();
});

test("top modal focus trap pulls Tab focus back from outside elements", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建事项" }).click();
  await expect(page.getByRole("dialog", { name: "新建事项" })).toBeVisible();

  await page.evaluate(() => document.querySelector(".topbar input")?.focus());
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".modal")))).toBe(true);

  await page.evaluate(() => document.querySelector(".topbar input")?.focus());
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".modal")))).toBe(true);
});

test("URL q, filters, sort, page, and viewMode restore, clear, and support history", async ({ page }) => {
  const filters = encodeURIComponent(JSON.stringify({ keyword: "缓存", owner: "林夏" }));
  const stateUrl = `/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88&q=CRM&filters=${filters}&sort=dueDate%3Aasc&page=2&viewMode=compact`;
  const cleanUrl = "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88";

  await page.goto(cleanUrl, { waitUntil: "networkidle" });
  await page.goto(stateUrl, { waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.locator(".desktop-view-search input")).toHaveValue("缓存");
  await page.locator(".filter-popover > summary").click();
  await expect(page.locator(".filter-popover .picker-trigger").first()).toContainText("林夏");
  await expect(page).toHaveURL(/sort=dueDate%3Aasc/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.locator(".desktop-view-search input")).toHaveValue("缓存");

  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "打开全局搜索" })).toBeVisible();
  await expect(page.locator(".desktop-view-search input")).toHaveValue("");
  await expect(page.locator(".filter-popover .picker-trigger").first()).toContainText("全部");

  await page.goForward({ waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.locator(".desktop-view-search input")).toHaveValue("缓存");
});

test("search, filters, sort, page, and viewMode replace history while navigation pushes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?qa=bulk&view=project&project=crm&tab=迭代", { waitUntil: "networkidle" });
  const beforeReplace = await page.evaluate(() => history.length);

  await page.getByRole("button", { name: "打开全局搜索" }).click();
  const globalSearch = page.getByPlaceholder("搜索项目、事项或负责人");
  await globalSearch.fill("C");
  await page.waitForTimeout(260);
  await globalSearch.fill("CRM");
  await page.waitForTimeout(260);
  await globalSearch.fill("CRM 缓存");
  await page.waitForTimeout(260);
  expect(await page.evaluate(() => history.length)).toBe(beforeReplace);

  await page.locator(".desktop-view-search input").fill("批量视觉");
  await page.locator(".view-options-menu > summary").click();
  await page.getByRole("button", { name: "优先级优先" }).click();
  await page.locator(".view-options-menu > summary").click();
  await page.getByRole("button", { name: "紧凑" }).click();
  await page.getByRole("button", { name: "下一页" }).click();
  expect(await page.evaluate(() => history.length)).toBe(beforeReplace);
  await expect(page).toHaveURL(/q=CRM/);
  await expect(page).toHaveURL(/filters=/);
  await expect(page).toHaveURL(/sort=priority/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/viewMode=compact/);

  await page.getByRole("tab", { name: "看板" }).click();
  await expect(page).toHaveURL(/tab=%E7%9C%8B%E6%9D%BF/);
  await expect.poll(() => page.evaluate(() => history.length)).toBeGreaterThan(beforeReplace);
});

test("issue page and compact viewMode change the real issue list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?qa=bulk&view=project&project=crm&tab=迭代&page=2&viewMode=compact", { waitUntil: "networkidle" });

  await expect(page.locator(".issue-table")).toHaveClass(/density-compact/);
  await expect(page.locator(".issue-table-row")).toHaveCount(10);
  await expect(page.locator(".pagination-bar")).toContainText("第 2 /");

  const pageTwoFirstTitle = await page.locator(".issue-table-row .issue-title-cell strong").first().innerText();
  await page.locator(".view-options-menu > summary").click();
  await page.getByRole("button", { name: "舒适" }).click();
  await expect(page.locator(".issue-table")).toHaveClass(/density-comfortable/);
  await expect(page.locator(".issue-table-row")).toHaveCount(6);
  await expect(page.locator(".pagination-bar")).toContainText("第 1 /");
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page).not.toHaveURL(/viewMode=compact/);

  const pageOneFirstTitle = await page.locator(".issue-table-row .issue-title-cell strong").first().innerText();
  expect(pageOneFirstTitle).not.toBe(pageTwoFirstTitle);
});
