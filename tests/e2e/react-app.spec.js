import { expect, test } from "@playwright/test";

const localUserKey = "gridproject_dev:react-gridproject-user-v1";
const localStateKey = "gridproject_dev:react-gridproject-state-v1";

async function asUser(page, userId) {
  await page.addInitScript(({ localUserKey: key, localStateKey: stateKey, userId: id }) => {
    window.localStorage.setItem(key, id);
    window.localStorage.removeItem(stateKey);
  }, { localUserKey, localStateKey, userId });
}

async function gotoHealthy(page, url) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
}

test("member can use the React project and time workspaces", async ({ page }) => {
  await asUser(page, "user-linxia");

  await gotoHealthy(page, "/");
  await expect(page.getByRole("heading", { name: /林夏/ })).toBeVisible();

  await gotoHealthy(page, "/projects");
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible();
  await page.getByRole("button", { name: "创建项目" }).click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeVisible();
  await page.keyboard.press("Escape");

  await gotoHealthy(page, "/projects/crm");
  await expect(page.getByRole("heading", { name: "CRM 线索协同" })).toBeVisible();
  await page.getByRole("tab", { name: "工作项" }).click();
  await expect(page.getByText("批量分配线索")).toBeVisible();
  await page.getByRole("tab", { name: "甘特图" }).click();
  await expect(page.getByText("项目甘特图")).toBeVisible();

  await gotoHealthy(page, "/timesheets");
  await expect(page.getByRole("heading", { name: "工时填报" })).toBeVisible();

  await gotoHealthy(page, "/timesheet-list");
  await expect(page.getByRole("heading", { name: "工时列表" })).toBeVisible();

  await gotoHealthy(page, "/trash");
  await expect(page.getByRole("heading", { name: "回收站", exact: true })).toBeVisible();
});

test("admin can access organization management pages", async ({ page }) => {
  await asUser(page, "user-admin");

  await gotoHealthy(page, "/costs");
  await expect(page.getByRole("heading", { name: "成本管理" })).toBeVisible();

  await gotoHealthy(page, "/people");
  await expect(page.getByRole("heading", { name: "人员管理" })).toBeVisible();

  await gotoHealthy(page, "/settings");
  await expect(page.getByRole("heading", { name: "平台设置" })).toBeVisible();
});

test("member is blocked from admin-only cost management", async ({ page }) => {
  await asUser(page, "user-linxia");
  await gotoHealthy(page, "/costs");
  await expect(page.getByRole("heading", { name: "没有访问权限" })).toBeVisible();
});

test("mobile navigation and 404 render correctly", async ({ page }) => {
  await asUser(page, "user-admin");
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoHealthy(page, "/");
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.getByRole("dialog").getByText("项目列表")).toBeVisible();
  await page.getByRole("dialog").getByText("人员管理").click();
  await expect(page.getByRole("heading", { name: "人员管理" })).toBeVisible();

  await gotoHealthy(page, "/not-a-real-page");
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
});
