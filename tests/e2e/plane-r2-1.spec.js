import { expect, test } from "@playwright/test";

test("R2.1 project library uses the required columns and one create entry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?qa=plane-r2-projects-20&view=projects", { waitUntil: "networkidle" });
  await expect(page.locator(".project-card")).toHaveCount(20);
  await expect(page.getByRole("button", { name: "创建项目" })).toHaveCount(1);
  expect(await gridColumnCount(page)).toBe(3);

  await page.setViewportSize({ width: 1728, height: 1117 });
  expect(await gridColumnCount(page)).toBe(4);

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await gridColumnCount(page)).toBe(3);

  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await gridColumnCount(page)).toBe(2);

  await page.setViewportSize({ width: 768, height: 844 });
  expect(await gridColumnCount(page)).toBe(2);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await gridColumnCount(page)).toBe(1);
  await expect(page.getByRole("button", { name: "创建项目" })).toHaveCount(1);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("R2.1 home separates overdue and next-seven-day work near the mobile fold", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?qa=plane-r2-home&view=dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "待关注事项" })).toBeVisible();
  await expect(page.locator(".home-projects-section .project-card:visible")).toHaveCount(2);
  await expect(page.locator(".due-group.overdue")).toContainText("已逾期");
  await expect(page.locator(".due-group.upcoming")).toContainText("未来 7 天");
  const dueTop = await page.locator(".due-section").evaluate((element) => element.getBoundingClientRect().top);
  expect(dueTop).toBeLessThanOrEqual(844);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("R2.1 account sheet never overlaps the mobile drawer and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=projects", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  const trigger = page.locator(".mobile-account-menu .account-trigger");
  await trigger.evaluate((element) => element.click());
  await expect(page.locator(".account-sheet")).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await expect(page.locator(".sidebar-scrim")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".account-sheet")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("R2.1 settings fill the desktop viewport and remain stable on mobile reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings/profile", { waitUntil: "networkidle" });
  const desktopBox = await page.locator(".personal-settings-view").boundingBox();
  expect(desktopBox).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
  await expect(page.locator(".personal-settings-sidebar")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/security", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByRole("heading", { name: "安全设置" })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

async function gridColumnCount(page) {
  return page.locator(".project-card-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
}

async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
