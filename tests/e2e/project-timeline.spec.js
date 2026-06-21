import { expect, test } from "@playwright/test";

const timelineText = [
  "阶段,事项名称,相关方,开始日期,结束日期,状态",
  "需求,需求确认,Kivisense,2026-07-01,2026-07-02,未完成",
  "开发,程序开发,Kivisense,2026-07-03,2026-07-08,未完成",
  "测试,内部测试,Kivisense,2026-07-09,2026-07-10,未完成",
  "验收,UAT,Kivisense,2026-07-11,2026-07-12,未完成",
  "上线,Go Live,Kivisense,2026-07-15,2026-07-15,未完成",
].join("\n");

test("project creation previews Timeline and persists project fields", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  await page.goto("/?view=projects", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "创建项目" }).click();
  const dialog = page.getByRole("dialog", { name: "创建项目" });

  await expect(dialog.getByText("截止日期", { exact: true })).toHaveCount(0);
  await dialog.getByPlaceholder("例如：新客户交付项目").fill("Timeline 创建回归");
  await dialog.getByPlaceholder("说明项目目标、范围和交付背景").fill("验证项目概述与 Timeline 联动");
  await dialog.locator(".team-picker label").filter({ hasText: "开发" }).click();
  await dialog.getByRole("button", { name: "下一步" }).click();
  await dialog.getByText("使用 Timeline 初始化项目", { exact: true }).click();
  await dialog.getByPlaceholder(/Model,事项名称/).fill(timelineText);
  await dialog.getByRole("button", { name: "解析内容" }).click();

  await expect(dialog.locator(".timeline-stats")).toContainText("5");
  await expect(dialog.locator(".key-date-editor-grid input").first()).toHaveValue("2026-07-01");
  await expect(dialog.locator(".key-date-editor-grid")).toContainText("需求 / 需求确认");
  await dialog.getByRole("button", { name: "创建项目" }).click();

  await expect(page.locator(".project-context-header h1")).toHaveText("Timeline 创建回归");
  await page.locator(".project-properties-menu > summary").click();
  await expect(page.locator(".project-properties-popover")).toContainText("开发");
  await expect(page.locator(".issue-table-row")).toHaveCount(5);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".project-context-header h1")).toHaveText("Timeline 创建回归");
  await expect(page.locator(".issue-table-row")).toHaveCount(5);
  expect(consoleErrors).toEqual([]);
});

test("invalid Timeline keeps basic project input and blocks creation", async ({ page }) => {
  await page.goto("/?view=projects", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "创建项目" }).click();
  const dialog = page.getByRole("dialog", { name: "创建项目" });
  await dialog.getByPlaceholder("例如：新客户交付项目").fill("保留输入回归");
  await dialog.getByRole("button", { name: "下一步" }).click();
  await dialog.getByText("使用 Timeline 初始化项目", { exact: true }).click();
  await dialog.getByPlaceholder(/Model,事项名称/).fill("名称,责任人\n任务,Kivisense");
  await dialog.getByRole("button", { name: "解析内容" }).click();
  await expect(dialog.getByText(/表头无法识别/)).toBeVisible();
  await dialog.getByRole("button", { name: "创建项目" }).click();
  await expect(dialog.getByText(/请先完成 Timeline 解析/)).toBeVisible();
  await dialog.getByRole("button", { name: "上一步" }).click();
  await expect(dialog.getByPlaceholder("例如：新客户交付项目")).toHaveValue("保留输入回归");
});
