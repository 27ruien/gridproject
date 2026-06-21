import { expect, test } from "@playwright/test";

test("project library is card-only and supports search, filters, sorting and menus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?qa=plane-r2-projects-20&view=projects", { waitUntil: "networkidle" });
  await expect(page.locator(".project-card")).toHaveCount(20);
  await expect(page.locator(".project-table-wrap")).toHaveCount(0);

  await page.getByLabel("搜索项目").fill("AI 试衣");
  await expect(page.locator(".project-card")).toHaveCount(3);
  await page.getByLabel("搜索项目").fill("");
  await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByLabel("项目状态").selectOption("开发阶段");
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".project-filter-chips")).toContainText("状态：开发阶段");
  await expect(page.locator(".project-card")).toHaveCount(4);
  await page.getByRole("button", { name: /状态：开发阶段/ }).click();
  await expect(page.locator(".project-card")).toHaveCount(20);

  await page.getByLabel("项目排序").selectOption("name");
  const names = await page.locator(".project-card-title strong").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "zh-CN")));

  const firstCard = page.locator(".project-card").first();
  await firstCard.locator(".project-card-menu-trigger").click();
  await expect(firstCard.getByRole("menuitem", { name: "编辑项目" })).toBeVisible();
  await expect(page).toHaveURL(/view=projects/);
  await page.keyboard.press("Escape");
  await firstCard.locator(".project-card-hit").click();
  await expect(page).toHaveURL(/view=project/);
});

for (const count of [1, 3, 20, 100]) {
  test(`project library renders ${count} stable cards`, async ({ page }) => {
    await page.goto(`/?qa=plane-r2-projects-${count}&view=projects`, { waitUntil: "networkidle" });
    await expect(page.locator(".project-card")).toHaveCount(count);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("project library handles empty and long content", async ({ page }) => {
  await page.goto("/?qa=plane-r2-projects-empty&view=projects", { waitUntil: "networkidle" });
  await expect(page.getByText("还没有项目")).toBeVisible();
  await page.goto("/?qa=plane-r2-projects-20&view=projects", { waitUntil: "networkidle" });
  const heights = await page.locator(".project-card").evaluateAll((cards) => cards.slice(0, 4).map((card) => card.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
});

test("account menu and personal settings support keyboard, persistence and URL history", async ({ page }) => {
  await page.goto("/?view=projects", { waitUntil: "networkidle" });
  const trigger = page.locator(".account-trigger");
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "个人资料" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "偏好设置" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("menuitem", { name: "个人资料" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByLabel("登录邮箱")).toHaveAttribute("readonly", "");
  await page.getByLabel("姓名").fill("林夏 QA");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("个人资料已保存")).toBeVisible();

  await page.getByRole("button", { name: /偏好设置/ }).click();
  await page.getByText("紧凑").click();
  await page.getByLabel("默认导航状态").selectOption("collapsed");
  await page.getByLabel("主页到期事项默认范围").selectOption("others");
  await page.getByRole("button", { name: "保存偏好" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/density-compact/);
  await expect(page.locator(".app-shell")).toHaveClass(/nav-collapsed/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".app-shell")).toHaveClass(/density-compact/);

  await page.getByRole("button", { name: /安全设置/ }).click();
  await page.getByLabel("当前密码").fill("CurrentPass99");
  await page.getByLabel("新密码", { exact: true }).fill("CurrentPass99");
  await page.getByLabel("确认新密码").fill("DifferentPass99");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByText("新密码不能与当前密码相同。")).toBeVisible();

  await page.getByRole("button", { name: "关闭个人设置" }).click();
  await expect(page).toHaveURL(/view=projects/);
});

test("home uses 主页 and separates all, mine and other members by accessible projects", async ({ page }) => {
  await page.goto("/?qa=plane-r2-home&view=dashboard", { waitUntil: "networkidle" });
  await expect(page.locator(".nav-item.active")).toContainText("主页");
  await expect(page.getByText("工作台", { exact: true })).toHaveCount(0);
  await expect(page.locator(".home-projects-section .project-card")).toHaveCount(6);
  const allCount = Number((await page.getByRole("tab", { name: /^全部/ }).innerText()).match(/\d+/)?.[0]);
  const mineCount = Number((await page.getByRole("tab", { name: /^我的/ }).innerText()).match(/\d+/)?.[0]);
  const othersCount = Number((await page.getByRole("tab", { name: /^其他成员/ }).innerText()).match(/\d+/)?.[0]);
  expect(allCount).toBeGreaterThan(0);
  expect(mineCount).toBeGreaterThan(0);
  expect(othersCount).toBeGreaterThan(0);
  expect(allCount).toBe(mineCount + othersCount);
  await page.getByRole("tab", { name: /^其他成员/ }).click();
  await expect(page.locator(".due-issue-card")).toHaveCount(othersCount);
  expect(await page.locator(".due-issue-card .status-lozenge").allTextContents()).not.toContain("已完成");
});

test("mobile account opens as a bottom sheet and exposes logout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=projects", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.locator(".account-trigger").click();
  await expect(page.locator(".account-sheet")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeVisible();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page.getByText("本地演示模式无需退出登录")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
