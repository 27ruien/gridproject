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

test("URL q, filters, sort, page, and viewMode restore, clear, and support history", async ({ page }) => {
  const filters = encodeURIComponent(JSON.stringify({ keyword: "缓存", owner: "林夏" }));
  const stateUrl = `/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88&q=CRM&filters=${filters}&sort=dueDate%3Aasc&page=2&viewMode=compact`;
  const cleanUrl = "/?view=project&project=crm&tab=%E6%A6%82%E8%A7%88";

  await page.goto(cleanUrl, { waitUntil: "networkidle" });
  await page.goto(stateUrl, { waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.getByPlaceholder("标题、编号、类型、描述")).toHaveValue("缓存");
  await expect(page.locator(".filter-bar .picker-trigger").first()).toContainText("林夏");
  await expect(page).toHaveURL(/sort=dueDate%3Aasc/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.getByPlaceholder("标题、编号、类型、描述")).toHaveValue("缓存");

  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("");
  await expect(page.getByPlaceholder("标题、编号、类型、描述")).toHaveValue("");
  await expect(page.locator(".filter-bar .picker-trigger").first()).toContainText("全部");

  await page.goForward({ waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("搜索项目、事项或负责人")).toHaveValue("CRM");
  await expect(page.getByPlaceholder("标题、编号、类型、描述")).toHaveValue("缓存");
});
