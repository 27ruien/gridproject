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
    return;
  }

  if (scenario === "plane-r3") {
    applyR3ReviewData(state);
  }
}

function applyR3ReviewData(state) {
  const organizationId = "org-default";
  const baseUsers = [
    { id: "user-admin", name: "管理员", email: "admin@gridproject.local", role: "ADMIN" },
    { id: "user-linxia", name: "林夏", email: "linxia@gridproject.local", role: "ADMIN" },
    { id: "user-zhoucheng", name: "周程", email: "zhoucheng@gridproject.local", role: "MEMBER" },
    { id: "user-hanyue", name: "韩越", email: "hanyue@gridproject.local", role: "MEMBER" },
    { id: "user-chenche", name: "陈澈", email: "chenche@gridproject.local", role: "MEMBER" },
    { id: "user-songwen", name: "宋闻", email: "songwen@gridproject.local", role: "MEMBER" },
    { id: "user-yubai", name: "俞白", email: "yubai@gridproject.local", role: "MEMBER" },
    { id: "user-luoran", name: "罗然", email: "luoran@gridproject.local", role: "MEMBER" },
    { id: "user-qiaoyi", name: "乔一", email: "qiaoyi@gridproject.local", role: "MEMBER" },
    { id: "user-mengyao", name: "孟瑶", email: "mengyao@gridproject.local", role: "MEMBER" },
    { id: "user-xuxin", name: "许新", email: "xuxin@gridproject.local", role: "MEMBER" },
    { id: "user-yaojing", name: "姚静", email: "yaojing@gridproject.local", role: "MEMBER", status: "INACTIVE" },
  ];
  const projects = [
    {
      id: "crm",
      name: "CRM 线索协同",
      code: "CRM",
      templateId: "agile",
      ownerId: "user-linxia",
      owner: "林夏",
      status: "开发阶段",
      executionTeams: ["产品", "前端", "后端"],
      startDate: "2026-06-03",
      dueDate: "2026-07-10",
      testDate: "2026-06-28",
      acceptanceDate: "2026-07-06",
      releaseDate: "2026-07-10",
      health: 74,
      description: "R3 甘特、工时、成本和人员管理视觉验收项目。",
    },
    {
      id: "mall",
      name: "商场 AR 交付",
      code: "MALL",
      templateId: "waterfall",
      ownerId: "user-hanyue",
      owner: "韩越",
      status: "验收阶段",
      executionTeams: ["客户成功", "设计", "交付"],
      startDate: "2026-05-25",
      dueDate: "2026-07-03",
      testDate: "2026-06-24",
      acceptanceDate: "2026-06-30",
      releaseDate: "2026-07-03",
      health: 68,
      description: "瀑布交付项目，用于验证阶段排期和超预算风险。",
    },
    {
      id: "ai",
      name: "AI 试衣平台",
      code: "AI",
      templateId: "agile",
      ownerId: "user-zhoucheng",
      owner: "周程",
      status: "测试阶段",
      executionTeams: ["算法", "前端", "QA"],
      startDate: "2026-06-10",
      dueDate: "2026-07-18",
      testDate: "2026-07-02",
      acceptanceDate: "2026-07-14",
      releaseDate: "2026-07-18",
      health: 82,
      description: "多团队研发项目，用于验证 R3 成本和人员筛选。",
    },
    {
      id: "ops",
      name: "交付运营工作台",
      code: "OPS",
      templateId: "agile",
      ownerId: "user-songwen",
      owner: "宋闻",
      status: "规划中",
      executionTeams: ["运营", "后端"],
      startDate: "2026-06-17",
      dueDate: "2026-07-24",
      testDate: "2026-07-10",
      acceptanceDate: "2026-07-20",
      releaseDate: "2026-07-24",
      health: 90,
      description: "用于拉长人员列表和成本筛选的数据项目。",
    },
  ].map((project, index) => ({
    organizationId,
    milestones: createR3Milestones(project.id, index),
    createdById: project.ownerId,
    createdAt: `2026-05-${String(20 + index).padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: `2026-06-${String(15 + index).padStart(2, "0")}T08:00:00.000Z`,
    deletedAt: null,
    ...project,
  }));

  state.users = baseUsers.map((user, index) => ({
    organizationId,
    status: user.status || "ACTIVE",
    lastLoginAt: index % 3 === 0 ? null : `2026-06-${String(12 + index).padStart(2, "0")}T09:00:00.000Z`,
    deletedAt: null,
    deletedById: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: `2026-06-${String(10 + index).padStart(2, "0")}T09:00:00.000Z`,
    ...user,
  }));
  state.projects = projects;
  state.projectMembers = createR3ProjectMembers(projects, state.users, organizationId);
  state.issues = createR3Issues(projects);
  state.timeEntries = createR3TimeEntries(state.issues, state.users, organizationId);
  state.costRecords = projects.slice(0, 3).map((project, index) => ({
    id: `r3-cost-${project.id}`,
    organizationId,
    projectId: project.id,
    plannedPersonDays: [18, 5, 24][index],
    standardHoursPerDay: 8,
    status: "ACTIVE",
    notes: "Plane R3 本地视觉验收成本记录。",
    createdById: project.ownerId,
    updatedById: project.ownerId,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: `2026-06-${String(18 + index).padStart(2, "0")}T00:00:00.000Z`,
    deletedAt: null,
    deletedById: null,
  }));
  state.settings = { platformName: "GridProject", logoText: "G" };
}

function createR3Milestones(projectId, projectIndex) {
  return ["需求冻结", "联调完成", "验收准备"].map((name, index) => ({
    id: `r3-ms-${projectId}-${index + 1}`,
    name,
    status: ["已完成", "进行中", "未开始"][(projectIndex + index) % 3],
    dueDate: formatDate(addDays(new Date("2026-06-20T00:00:00"), projectIndex * 3 + index * 5)),
  }));
}

function createR3ProjectMembers(projects, users, organizationId) {
  const memberIds = users.filter((user) => user.status === "ACTIVE").map((user) => user.id);
  return projects.flatMap((project, projectIndex) => {
    const assigned = [project.ownerId, ...memberIds.slice(projectIndex + 1, projectIndex + 6)];
    return [...new Set(assigned)].map((userId, index) => ({
      id: `r3-pm-${project.id}-${index}`,
      organizationId,
      projectId: project.id,
      userId,
      status: "ACTIVE",
      createdAt: "2026-06-01T00:00:00.000Z",
    }));
  });
}

function createR3Issues(projects) {
  const titles = [
    "确认客户旅程与验收口径",
    "完成列表虚拟滚动边界验证",
    "联调权限与成员范围接口",
    "移动端排期列表验收",
    "成本数据口径复核",
    "补齐上线前检查项",
    "处理延期风险和替代方案",
    "更新交付物归档说明",
    "压测关键页面首屏性能",
    "修复长标题在详情面板中的换行",
    "同步项目复盘和遗留问题",
    "准备客户验收演示",
  ];
  const owners = ["林夏", "周程", "韩越", "陈澈", "宋闻", "俞白", "罗然", "乔一"];
  const statuses = ["未开始", "进行中", "进行中", "已完成", "已验收"];
  const types = ["需求", "任务", "缺陷", "风险", "交付物", "任务"];

  return projects.flatMap((project, projectIndex) => Array.from({ length: project.id === "crm" ? 28 : 12 }, (_item, index) => {
    const start = new Date("2026-06-08T00:00:00");
    start.setDate(start.getDate() + projectIndex * 4 + index);
    const due = new Date(start);
    due.setDate(start.getDate() + 2 + (index % 6));
    return {
      id: `r3-${project.id}-issue-${index + 1}`,
      organizationId: "org-default",
      projectId: project.id,
      code: `${project.code}-${String(300 + index + 1).padStart(3, "0")}`,
      type: types[(projectIndex + index) % types.length],
      title: `${titles[index % titles.length]}${index % 9 === 0 ? "，并验证较长标题在紧凑列表中不会溢出" : ""}`,
      status: statuses[(projectIndex + index) % statuses.length],
      owner: owners[(projectIndex + index) % owners.length],
      creator: project.owner,
      priority: ["P0", "P1", "P2", "P3"][index % 4],
      labels: [project.executionTeams[index % project.executionTeams.length]],
      startDate: formatDate(start),
      dueDate: formatDate(due),
      estimatedHours: 8 + (index % 5) * 4,
      actualHours: index % 4 === 0 ? 0 : 4 + (index % 6) * 3,
      next: "同步当前阻塞并推进验收条件。",
      description: "Plane R3 本地视觉验收数据，不写入持久化存储。",
      comments: [],
      activity: [],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: `2026-06-${String(10 + (index % 12)).padStart(2, "0")}T09:00:00.000Z`,
    };
  }));
}

function createR3TimeEntries(issues, users, organizationId) {
  const activeUsers = users.filter((user) => user.status === "ACTIVE" && user.id !== "user-admin");
  const statuses = ["DRAFT", "SUBMITTED", "APPROVED", "APPROVED", "REJECTED"];
  const weekDates = ["2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26"];
  return issues.slice(0, 36).flatMap((issue, issueIndex) => {
    const user = activeUsers[issueIndex % activeUsers.length];
    return weekDates.slice(0, 2 + (issueIndex % 3)).map((date, dateIndex) => ({
      id: `r3-time-${issue.id}-${dateIndex}`,
      organizationId,
      projectId: issue.projectId,
      issueId: issue.id,
      userId: user.id,
      reporter: user.name,
      workDate: date,
      spentDate: date,
      hours: 2 + ((issueIndex + dateIndex) % 5),
      status: statuses[(issueIndex + dateIndex) % statuses.length],
      note: "R3 视觉验收工时记录",
      createdAt: `${date}T09:00:00.000Z`,
      updatedAt: `${date}T18:00:00.000Z`,
      deletedAt: null,
    }));
  });
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

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
