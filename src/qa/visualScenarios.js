export function applyVisualScenario(state, scenario) {
  if (!scenario || scenario === "default") return;
  if (scenario === "empty") {
    state.projects = [];
    state.issues = [];
    state.timeEntries = [];
    state.trash = [];
    return;
  }

  if (scenario === "long") {
    const longName = "全球化企业级超长项目名称验证 International Program Rollout With Extremely Long English Segment And 多语言交付范围确认";
    if (state.projects[0]) {
      state.projects[0].name = longName;
      state.projects[0].description = "这是一段用于验证中文、English、数字 1234567890 和非常长连续文本 SuperLongUnbrokenProjectTokenWithoutSpaces 的项目说明。";
    }
    if (state.issues[0]) {
      state.issues[0].title = "超长事项标题验证：需要在各种列表、看板、甘特图和详情页中稳定省略或换行 Extremely Long Issue Title Without Breaking Layout";
      state.issues[0].next = "验证工具栏、表格、详情面板和卡片在长文本下不会互相覆盖。";
    }
    return;
  }

  if (scenario === "bulk") {
    const project = state.projects[0];
    if (!project) return;
    const baseDate = new Date("2026-06-01T00:00:00");
    state.issues = Array.from({ length: 56 }, (_item, index) => {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() + index);
      const end = new Date(start);
      end.setDate(start.getDate() + 3 + (index % 5));
      const status = ["未开始", "进行中", "已完成", "已验收"][index % 4];
      const priority = ["P0", "P1", "P2", "P3"][index % 4];
      return {
        id: `qa-issue-${index + 1}`,
        code: `QA-${String(index + 1).padStart(3, "0")}`,
        projectId: project.id,
        type: index % 9 === 0 ? "风险" : "任务",
        title: `批量视觉验收事项 ${index + 1} - ${index % 6 === 0 ? "包含一段较长标题用于验证表格省略和卡片换行" : "标准任务"}`,
        status,
        owner: ["林夏", "周程", "韩越", "陈澈"][index % 4],
        creator: "林夏",
        priority,
        startDate: formatDate(start),
        dueDate: formatDate(end),
        estimatedHours: 8 + (index % 5) * 4,
        actualHours: status === "未开始" ? 0 : 4 + (index % 4) * 3,
        next: "推进当前状态并同步风险。",
        description: "QA 批量数据，仅用于本地视觉回归截图。",
        comments: [],
        activity: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
