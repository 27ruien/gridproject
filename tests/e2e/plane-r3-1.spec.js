import { expect, test } from "@playwright/test";

const r3 = "/?qa=plane-r3";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("kiviflow-platform-state-v1");
    window.localStorage.removeItem("kiviflow-vue-mvp-state");
    window.localStorage.setItem("gridproject.navCollapsed", "false");
  });
});

test("R3.1 desktop cost and people filters use the shared popover behavior", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await gotoAndSettle(page, `${r3}&view=costs`);
  const costTrigger = page.getByRole("button", { name: "成本筛选" });
  await costTrigger.click();
  const costDialog = page.getByRole("dialog", { name: "成本筛选" });
  await expect(costDialog).toBeVisible();
  await expect(page.locator(".filter-surface-panel")).toHaveCount(1);
  await costDialog.getByLabel("团队").selectOption({ index: 1 });
  await costDialog.getByRole("button", { name: "应用" }).click();
  await expect(costTrigger).toBeFocused();
  await expect(page.locator(".filter-chip-token", { hasText: "团队：" })).toBeVisible();
  await page.locator(".filter-chip-token", { hasText: "团队：" }).click();
  await expect(page.locator(".filter-chip-token", { hasText: "团队：" })).toHaveCount(0);

  await costTrigger.click();
  await expect(costDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(costDialog).toBeHidden();
  await expect(costTrigger).toBeFocused();
  await assertPageHealth(page);

  await gotoAndSettle(page, `${r3}&view=users`);
  const peopleTrigger = page.getByRole("button", { name: "人员筛选" });
  await peopleTrigger.click();
  const peopleDialog = page.getByRole("dialog", { name: "人员筛选" });
  await expect(peopleDialog).toBeVisible();
  await peopleDialog.getByLabel("角色").selectOption("ADMIN");
  await peopleDialog.getByRole("button", { name: "应用" }).click();
  await expect(peopleTrigger).toBeFocused();
  await expect(page.locator(".filter-chip-token", { hasText: "角色：管理员" })).toBeVisible();

  await peopleTrigger.click();
  await page.mouse.click(20, 20);
  await expect(peopleDialog).toBeHidden();
  await expect(peopleTrigger).toBeFocused();
  await assertPageHealth(page);
});

test("R3.1 mobile cost and people filters open as bottom sheets without blocking the first records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${r3}&view=costs`);
  await expect(page.locator(".cost-mobile-card").first()).toBeVisible();
  await expect(page.locator(".cost-mobile-card").first()).toBeInViewport();
  await page.getByRole("button", { name: "成本筛选" }).click();
  await expect(page.getByRole("dialog", { name: "成本筛选" })).toBeVisible();
  await expectBottomSheet(page);
  await page.getByRole("dialog", { name: "成本筛选" }).getByLabel("风险").selectOption("overrun");
  await page.getByRole("button", { name: "应用" }).click();
  await expect(page.locator(".filter-chip-token", { hasText: "风险：仅超预算" })).toBeVisible();
  await page.locator(".filter-chip-clear").click();
  await expect(page.locator(".filter-chip-token", { hasText: "风险：" })).toHaveCount(0);
  await assertPageHealth(page);

  await gotoAndSettle(page, `${r3}&view=users`);
  await expect(page.locator(".people-mobile-card").first()).toBeVisible();
  await expect(page.locator(".people-mobile-card").first()).toBeInViewport();
  await page.getByRole("button", { name: "人员筛选" }).click();
  await expect(page.getByRole("dialog", { name: "人员筛选" })).toBeVisible();
  await expectBottomSheet(page);
  await page.getByRole("dialog", { name: "人员筛选" }).getByLabel("状态").selectOption("ACTIVE");
  await page.getByRole("button", { name: "应用" }).click();
  await expect(page.locator(".filter-chip-token", { hasText: "状态：活跃" })).toBeVisible();
  await assertPageHealth(page);
});

test("R3.1 mobile Gantt compacts controls and keeps filters in the bottom sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${r3}&view=project&project=crm&tab=甘特图`);

  await expect(page.locator(".gantt-mobile-controls")).toBeVisible();
  await expect(page.locator(".gantt-mobile-card").first()).toBeVisible();
  await expect(page.locator(".gantt-mobile-card").first()).toBeInViewport();
  await expect(page.getByText("任务身份固定在左侧")).toBeHidden();

  const internalHeight = await page.evaluate(() => {
    const controls = document.querySelector(".gantt-mobile-controls").getBoundingClientRect();
    const firstCard = document.querySelector(".gantt-mobile-card").getBoundingClientRect();
    return Math.round(firstCard.top - controls.top);
  });
  expect(internalHeight).toBeLessThanOrEqual(220);

  await page.getByRole("button", { name: "展开甘特搜索" }).click();
  await page.getByRole("searchbox", { name: "搜索排期" }).fill("CRM-301");
  await expect(page.locator(".filter-chip-token", { hasText: "搜索：CRM-301" })).toBeVisible();

  await page.getByRole("button", { name: "甘特筛选" }).click();
  const ganttDialog = page.getByRole("dialog", { name: "甘特筛选" });
  await expect(ganttDialog).toBeVisible();
  await expectBottomSheet(page);
  await ganttDialog.getByLabel("仅看逾期").check();
  await ganttDialog.getByRole("button", { name: "折叠全部" }).click();
  await ganttDialog.getByRole("button", { name: "应用" }).click();
  await expect(page.locator(".filter-chip-token", { hasText: "仅看逾期" })).toBeVisible();
  await assertPageHealth(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndSettle(page, `${r3}&view=project&project=crm&tab=甘特图`);
  await expect(page.locator(".gantt-workspace")).toBeVisible();
  await expect(page.locator(".gantt-mobile-controls")).toBeHidden();
  await assertPageHealth(page);
});

test("R3.1 timesheet displays localized approval statuses without changing storage values", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndSettle(page, `${r3}&view=timesheets`);

  await expect(page.locator(".timesheet-status-summary")).toContainText("草稿");
  await expect(page.locator(".timesheet-status-summary")).toContainText("已提交");
  await expect(page.locator(".timesheet-status-summary")).toContainText("已通过");

  const visibleText = await page.locator(".timesheet-view").innerText();
  expect(visibleText).not.toMatch(/\b(DRAFT|SUBMITTED|APPROVED|REJECTED)\b/);
  await expect(page.locator(".timesheet-record-row .status-lozenge", { hasText: "已提交" }).first()).toBeVisible();
  await assertPageHealth(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${r3}&view=timesheets`);
  const mobileText = await page.locator(".timesheet-view").innerText();
  expect(mobileText).not.toMatch(/\b(DRAFT|SUBMITTED|APPROVED|REJECTED)\b/);
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
  await page.waitForTimeout(220);
}

async function expectBottomSheet(page) {
  const box = await page.locator(".filter-surface-panel").boundingBox();
  expect(box).toBeTruthy();
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(836);
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
      ".filter-chip-row",
    ];
    const ignoredSelectors = [
      "script",
      "style",
      "template",
      ".sidebar:not(.open)",
      ".filter-surface-layer",
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
