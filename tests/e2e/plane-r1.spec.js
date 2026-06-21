import { expect, test } from "@playwright/test";

test("project workspace uses compact context hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=project&project=crm&tab=Sprint", { waitUntil: "networkidle" });

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
  await page.goto("/?view=project&project=crm&tab=Sprint", { waitUntil: "networkidle" });
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
  for (const tab of ["Sprint", "看板"]) {
    await page.goto(`/?view=project&project=crm&tab=${encodeURIComponent(tab)}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator(".project-context-header h1")).toBeVisible();
  }
});
