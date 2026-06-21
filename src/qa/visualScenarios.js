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
    return;
  }

  if (["plane-r1-list-dense", "plane-r1-board-dense"].includes(scenario)) {
    const project = state.projects.find((entry) => entry.id === "crm") || state.projects[0];
    if (!project) return;
    const count = scenario === "plane-r1-list-dense" ? 24 : 16;
    state.issues = createPlaneReviewIssues(project.id, count, scenario === "plane-r1-board-dense");
    return;
  }

  if (scenario === "plane-r2-projects-empty") {
    state.projects = [];
    state.issues = [];
    state.projectMembers = [];
    return;
  }

  if (scenario.startsWith("plane-r2-projects-")) {
    const count = Math.max(1, Math.min(100, Number(scenario.split("-").at(-1)) || 20));
    const review = createR2ReviewData(count);
    state.projects = review.projects;
    state.issues = review.issues;
    state.projectMembers = review.projectMembers;
    return;
  }

  if (scenario === "plane-r2-home") {
    const review = createR2ReviewData(8);
    state.projects = review.projects;
    state.issues = review.issues;
    state.projectMembers = review.projectMembers;
  }
}

function createR2ReviewData(count) {
  const owners = [
    { id: "user-linxia", name: "林夏" },
    { id: "user-zhoucheng", name: "周程" },
    { id: "user-hanyue", name: "韩越" },
    { id: "user-chenche", name: "陈澈" },
  ];
  const names = ["客户数据中台升级", "AI 试衣体验优化", "海外站点交付计划", "销售线索协同", "品牌活动 AR 交付", "内部效率工具建设", "会员增长实验", "移动端质量专项"];
  const statuses = ["开发阶段", "测试阶段", "规划中", "验收阶段", "已暂停", "上线阶段"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const projects = Array.from({ length: count }, (_item, index) => {
    const owner = owners[index % owners.length];
    const release = new Date(today);
    release.setDate(today.getDate() + 4 + (index % 45));
    return {
      id: `plane-r2-project-${index + 1}`,
      organizationId: "org-default",
      name: `${names[index % names.length]}${index >= names.length ? ` · ${index + 1}` : ""}`,
      code: `R2${String(index + 1).padStart(3, "0")}`,
      templateId: index % 3 ? "agile" : "waterfall",
      ownerId: owner.id,
      owner: owner.name,
      status: statuses[index % statuses.length],
      executionTeams: [["开发"], ["设计", "开发"], ["商务", "特效"]][index % 3],
      startDate: formatDate(today),
      dueDate: formatDate(release),
      testDate: "",
      acceptanceDate: "",
      releaseDate: formatDate(release),
      milestones: [{ id: `r2-milestone-${index + 1}`, name: ["需求梳理", "研发实现", "客户验收"][index % 3], status: "进行中", dueDate: formatDate(release) }],
      health: 78 + (index % 20),
      description: index % 5 === 0 ? "覆盖多团队协作、复杂交付边界和一段足够长的项目概述，用于验证卡片在真实内容长度下仍保持等高。" : "围绕关键目标推进跨团队协作与交付。",
      createdById: owner.id,
      createdAt: new Date(today.getTime() - index * 86400000).toISOString(),
      updatedAt: new Date(today.getTime() - (index % 11) * 3600000).toISOString(),
    };
  });
  const projectMembers = projects.flatMap((project, index) => {
    const members = [{ id: `r2-pm-owner-${index}`, organizationId: "org-default", projectId: project.id, userId: project.ownerId, status: "ACTIVE" }];
    if (index % 3 !== 2 && project.ownerId !== "user-linxia") members.push({ id: `r2-pm-linxia-${index}`, organizationId: "org-default", projectId: project.id, userId: "user-linxia", status: "ACTIVE" });
    return members;
  });
  const issues = projects.flatMap((project, projectIndex) => Array.from({ length: projectIndex % 4 + 1 }, (_item, issueIndex) => {
    const due = new Date(today);
    due.setDate(today.getDate() + [-3, 0, 1, 4, 7, 12][(projectIndex + issueIndex) % 6]);
    const owner = owners[(projectIndex + issueIndex) % owners.length];
    const completed = projectIndex === 0 && issueIndex === 0;
    return {
      id: `r2-issue-${projectIndex}-${issueIndex}`,
      organizationId: "org-default",
      projectId: project.id,
      code: `${project.code}-${issueIndex + 1}`,
      type: (projectIndex + issueIndex) % 7 === 0 ? "风险" : (projectIndex + issueIndex) % 4 === 0 ? "缺陷" : "任务",
      title: `${["确认发布范围", "修复验收阻塞问题", "补齐接口联调结果", "完成客户反馈闭环"][issueIndex % 4]}${projectIndex % 4 === 0 ? "并同步所有相关成员" : ""}`,
      status: completed ? "已完成" : issueIndex % 3 === 1 ? "进行中" : "未开始",
      ownerId: owner.id,
      owner: owner.name,
      creatorId: project.ownerId,
      creator: project.owner,
      priority: ["P0", "P1", "P2"][issueIndex % 3],
      startDate: formatDate(today),
      dueDate: formatDate(due),
      estimatedHours: 8,
      actualHours: issueIndex * 2,
      next: "完成当前验收条件。",
      description: "R2 本地视觉验收数据，不写入持久化数据库。",
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    };
  }));
  return { projects, issues, projectMembers };
}

function createPlaneReviewIssues(projectId, count, boardMode) {
  const statusSequence = boardMode
    ? ["未开始", "未开始", "未开始", "未开始", "未开始", "未开始", "进行中", "进行中", "进行中", "进行中", "进行中", "已完成", "已完成", "已完成", "已验收", "已验收"]
    : ["未开始", "进行中", "已完成", "已验收"];
  const titles = [
    "完善成员邀请后的首次进入体验",
    "修复移动端筛选弹层遮挡事项标题的问题",
    "梳理项目权限边界并补充验收条件",
    "优化列表在中等宽度下的字段优先级",
    "补齐看板卡片负责人和截止日期信息",
    "实现发布前检查结果的清晰反馈",
    "校准跨团队协作流程中的状态变化通知",
    "验证超长事项标题在列表和看板中都能稳定换行且不会挤压相邻操作",
    "处理无负责人事项的视觉提示",
    "统一项目工作区的中文视图名称",
    "复核高优先级缺陷的响应路径",
    "改善键盘用户打开事项详情的焦点状态",
  ];
  const owners = ["林夏", "周程", "韩越", "陈澈", "宋闻"];
  const types = boardMode
    ? ["需求", "任务", "缺陷", "技术债", "任务", "Epic"]
    : ["需求", "任务", "缺陷", "任务", "需求", "任务"];
  const priorities = ["P1", "P2", "P0", "P1", "P2", "P1"];
  const labels = [["前端", "体验"], ["客户反馈"], ["权限"], ["响应式"], ["看板"], ["发布"]];
  const now = "2026-06-21T09:00:00.000Z";

  return Array.from({ length: count }, (_item, index) => {
    const unassigned = index % 7 === 6;
    const multipleOwners = index % 6 === 0;
    const issueOwnerList = unassigned ? [] : multipleOwners ? [owners[index % owners.length], owners[(index + 2) % owners.length]] : [owners[index % owners.length]];
    const duePattern = index % 5;
    const dueDate = duePattern === 0 ? "" : duePattern === 1 ? "2026-06-18" : duePattern === 2 ? "2026-06-23" : duePattern === 3 ? "2026-06-28" : "2026-07-04";

    return {
      id: `plane-r1-review-${index + 1}`,
      code: `CRM-${String(201 + index).padStart(3, "0")}`,
      projectId,
      type: types[index % types.length],
      title: `${titles[index % titles.length]}${index >= titles.length ? ` · 第 ${index + 1} 项` : ""}`,
      status: statusSequence[index % statusSequence.length],
      owner: issueOwnerList[0] || "未分配",
      owners: issueOwnerList,
      creator: "林夏",
      priority: priorities[index % priorities.length],
      labels: labels[index % labels.length],
      startDate: `2026-06-${String(1 + (index % 18)).padStart(2, "0")}`,
      dueDate,
      estimatedHours: 8 + (index % 4) * 4,
      actualHours: index % 3 === 0 ? 0 : 4 + (index % 5) * 2,
      next: "完成验收条件并同步项目成员。",
      description: "Plane R1 本地视觉验收数据，不写入持久化存储。",
      comments: [],
      activity: [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
