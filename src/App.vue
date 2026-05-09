<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark"></span>
        <div>
          <strong>KiviFlow</strong>
          <small>Vue 纯前端 MVP</small>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: currentView === item.key }"
          @click="setView(item.key)"
        >
          <span>{{ item.short }}</span>{{ item.label }}
        </button>
      </nav>

      <div class="sidebar-section">
        <p>项目空间</p>
        <button
          v-for="project in projects"
          :key="project.id"
          class="project-shortcut"
          :class="{ active: currentProjectId === project.id && currentView === 'project' }"
          @click="openProject(project.id)"
        >
          {{ project.name }}
        </button>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">Kivisense / 项目管理平台</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <label class="search">
            <span>⌕</span>
            <input v-model="searchText" type="search" placeholder="搜索项目或事项，按 Enter 打开" @keydown.enter="runSearch" />
          </label>
          <button class="btn ghost" @click="setView('templates')">模板中心</button>
          <button class="btn primary" @click="openProjectModal()">创建项目</button>
        </div>
      </header>

      <section v-if="currentView === 'home'" class="view active">
        <div class="hero">
          <div>
            <p class="eyebrow">平台策略</p>
            <h2>项目先选模板，再进入对应交付流程</h2>
            <p>敏捷项目看 Backlog、Sprint 和看板；瀑布项目看阶段、里程碑、交付物和验收。模板决定项目结构，不用一套流程硬套所有团队。</p>
          </div>
          <div class="hero-actions">
            <button class="btn primary" @click="openProjectModal()">创建项目</button>
            <button class="btn ghost" @click="setView('templates')">查看模板</button>
          </div>
        </div>

        <div class="metrics">
          <article><span>项目总数</span><strong>{{ projects.length }}</strong><small>{{ agileCount }} 个敏捷，{{ waterfallCount }} 个瀑布</small></article>
          <article><span>打开事项</span><strong>{{ openItemCount }}</strong><small>跨项目未完成事项</small></article>
          <article><span>高优先级</span><strong>{{ highPriorityCount }}</strong><small>P0 / P1 事项</small></article>
          <article><span>平均健康度</span><strong>{{ averageHealth }}</strong><small>基于项目状态估算</small></article>
        </div>

        <div class="home-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>推荐模板</h2>
                <p>模板定义流程、字段、事项类型和视图。</p>
              </div>
            </div>
            <div class="template-grid compact">
              <TemplateCard v-for="template in templates" :key="template.id" :template="template" @select="openProjectModal(template.id)" />
            </div>
          </section>

          <section class="panel">
            <h2>最近项目</h2>
            <div class="project-list">
              <ProjectRow v-for="project in projects.slice(0, 4)" :key="project.id" :project="project" :template="templateById(project.templateId)" @open="openProject(project.id)" />
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="currentView === 'projects'" class="view active">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>项目库</h2>
              <p>不同模板创建的项目拥有不同的项目空间。</p>
            </div>
            <button class="btn primary small" @click="openProjectModal()">创建项目</button>
          </div>
          <div class="project-table">
            <ProjectRow v-for="project in projects" :key="project.id" :project="project" :template="templateById(project.templateId)" @open="openProject(project.id)" />
          </div>
        </div>
      </section>

      <section v-else-if="currentView === 'templates'" class="view active">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>模板中心</h2>
              <p>当前预置敏捷研发和瀑布交付两套项目模板。</p>
            </div>
          </div>
          <div class="template-grid">
            <TemplateCard v-for="template in templates" :key="template.id" :template="template" @select="openProjectModal(template.id)" />
          </div>
        </div>
      </section>

      <section v-else-if="currentView === 'workbench'" class="view active">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>我的工作</h2>
              <p>跨项目聚合今天需要推进的事项。</p>
            </div>
            <div class="segmented">
              <button v-for="filter in workFilters" :key="filter.key" class="segment" :class="{ active: workFilter === filter.key }" @click="workFilter = filter.key">
                {{ filter.label }}
              </button>
            </div>
          </div>
          <div class="row-list">
            <ItemRow
              v-for="item in filteredWorkbenchItems"
              :key="item.id"
              :item="item"
              :project="projectById(item.projectId)"
              :statuses="statusesForItem(item)"
              @open="openItem(item.id)"
              @status="setItemStatus"
              @advance="advanceItem"
            />
          </div>
        </div>
      </section>

      <section v-else-if="currentView === 'reports'" class="view active">
        <div class="report-grid">
          <section class="panel score">
            <h2>组织交付健康度</h2>
            <strong>{{ averageHealth }}</strong>
            <p>敏捷项目关注吞吐，瀑布项目关注阶段风险和验收。</p>
          </section>
          <section class="panel">
            <h2>项目类型分布</h2>
            <div class="ratio-bars">
              <div><span>敏捷研发</span><meter min="0" max="100" :value="agileRatio"></meter><b>{{ agileRatio }}%</b></div>
              <div><span>瀑布交付</span><meter min="0" max="100" :value="waterfallRatio"></meter><b>{{ waterfallRatio }}%</b></div>
            </div>
          </section>
          <section class="panel wide">
            <h2>高风险事项</h2>
            <div class="row-list">
              <ItemRow
                v-for="item in riskyItems"
                :key="item.id"
                :item="item"
                :project="projectById(item.projectId)"
                :statuses="statusesForItem(item)"
                @open="openItem(item.id)"
                @status="setItemStatus"
                @advance="advanceItem"
              />
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="currentView === 'settings'" class="view active">
        <div class="settings-grid">
          <section class="panel">
            <h2>平台设置</h2>
            <div class="settings-list">
              <button>模板治理</button>
              <button>字段字典</button>
              <button>项目状态</button>
              <button>事项优先级</button>
            </div>
          </section>
          <section class="panel">
            <h2>权限模型</h2>
            <div class="workflow-line">
              <span>空间管理员</span><span>项目经理</span><span>负责人</span><span>成员</span><span>观察者</span>
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="currentView === 'project'" class="view active">
        <section class="project-hero">
          <div>
            <p class="eyebrow">{{ currentTemplate.name }}</p>
            <h2>{{ currentProject.name }}</h2>
            <p>{{ currentProject.description }}</p>
          </div>
          <div class="hero-stats">
            <div><strong>{{ currentProjectItems.length }}</strong><span>事项</span></div>
            <div><strong>{{ currentProject.health }}</strong><span>健康度</span></div>
            <div><strong>{{ currentTemplate.badge }}</strong><span>模板</span></div>
            <div><strong>{{ currentOpenCount }}</strong><span>未完成</span></div>
          </div>
        </section>

        <div class="project-actions">
          <div class="project-tabs">
            <button v-for="tab in currentTemplate.tabs" :key="tab" class="project-tab" :class="{ active: projectTab === tab }" @click="projectTab = tab">
              {{ tab }}
            </button>
          </div>
          <button class="btn primary small" @click="openItemModal()">新建事项</button>
        </div>

        <section v-if="isBoardTab" class="project-pane active">
          <BoardView :statuses="currentTemplate.statuses" :items="currentProjectItems" @open="openItem" @status="setItemStatus" @advance="advanceItem" />
        </section>
        <section v-else-if="isTimelineTab" class="project-pane active">
          <TimelineView :statuses="currentTemplate.statuses" />
        </section>
        <section v-else class="project-pane active">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h2>{{ projectTab }}</h2>
                <p>{{ currentTemplate.name }}下的{{ projectTab }}视图。</p>
              </div>
              <button class="btn ghost small" @click="openItemModal()">添加{{ currentTemplate.defaultItemType }}</button>
            </div>
            <div class="table">
              <ItemTableRow
                v-for="item in visibleProjectItems"
                :key="item.id"
                :item="item"
                :statuses="statusesForItem(item)"
                @open="openItem(item.id)"
                @status="setItemStatus"
                @advance="advanceItem"
              />
            </div>
          </div>
        </section>
      </section>
    </main>

    <aside class="drawer" :class="{ open: selectedItem }" aria-hidden="!selectedItem">
      <div v-if="selectedItem" class="drawer-head">
        <div>
          <p class="eyebrow">{{ selectedItem.code }}</p>
          <h2>{{ selectedItem.title }}</h2>
        </div>
        <button class="icon-btn" @click="selectedItemId = null" aria-label="关闭详情">×</button>
      </div>
      <div v-if="selectedItem" class="drawer-body">
        <div class="field-grid">
          <div><span>类型</span><strong>{{ selectedItem.type }}</strong></div>
          <div><span>状态</span><strong>{{ selectedItem.status }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedItem.owner }}</strong></div>
          <div><span>优先级</span><strong>{{ selectedItem.priority }}</strong></div>
          <div><span>所属项目</span><strong>{{ projectById(selectedItem.projectId).name }}</strong></div>
          <div><span>模板</span><strong>{{ templateById(projectById(selectedItem.projectId).templateId).badge }}</strong></div>
        </div>
        <section>
          <h3>说明</h3>
          <p>{{ selectedItem.description }}</p>
        </section>
        <section>
          <h3>下一步</h3>
          <p>{{ selectedItem.next }}</p>
        </section>
        <section>
          <h3>状态流转</h3>
          <div class="status-editor">
          <select v-model="selectedItem.status" @change="persist">
            <option v-for="status in templateById(projectById(selectedItem.projectId).templateId).statuses" :key="status">{{ status }}</option>
          </select>
            <button class="btn primary small" @click="advanceItem(selectedItem.id)">推进到下一状态</button>
          </div>
        </section>
        <button class="btn ghost" @click="selectedItemId = null">关闭详情</button>
      </div>
    </aside>

    <div class="modal-backdrop" v-if="projectModalOpen" @click.self="closeProjectModal">
      <section class="modal large">
        <div class="drawer-head">
          <div>
            <p class="eyebrow">创建项目</p>
            <h2>选择模板并创建项目</h2>
          </div>
          <button class="icon-btn" @click="closeProjectModal" aria-label="关闭弹窗">×</button>
        </div>
        <div class="modal-body create-layout">
          <div>
            <label><span>项目名称</span><input v-model="projectForm.name" placeholder="例如：新客户交付项目" /></label>
            <label><span>项目负责人</span><select v-model="projectForm.owner"><option v-for="person in people" :key="person">{{ person }}</option></select></label>
            <label><span>项目说明</span><textarea v-model="projectForm.description" placeholder="说明项目目标、范围或客户背景"></textarea></label>
          </div>
          <div>
            <p class="form-label">项目模板</p>
            <div class="template-select">
              <TemplateCard
                v-for="template in templates"
                :key="template.id"
                :template="template"
                selectable
                :selected="projectForm.templateId === template.id"
                @select="projectForm.templateId = template.id"
              />
            </div>
          </div>
          <div class="modal-actions wide">
            <button class="btn ghost" @click="closeProjectModal">取消</button>
            <button class="btn primary" @click="createProject">创建项目</button>
          </div>
        </div>
      </section>
    </div>

    <div class="modal-backdrop" v-if="itemModalOpen" @click.self="closeItemModal">
      <section class="modal">
        <div class="drawer-head">
          <div>
            <p class="eyebrow">项目内创建</p>
            <h2>新建事项</h2>
          </div>
          <button class="icon-btn" @click="closeItemModal" aria-label="关闭弹窗">×</button>
        </div>
        <div class="modal-body">
          <label><span>事项类型</span><select v-model="itemForm.type"><option v-for="type in currentTemplate.types" :key="type">{{ type }}</option></select></label>
          <label><span>标题</span><input v-model="itemForm.title" placeholder="例如：补齐验收标准" /></label>
          <label><span>负责人</span><select v-model="itemForm.owner"><option v-for="person in people" :key="person">{{ person }}</option></select></label>
          <label><span>优先级</span><select v-model="itemForm.priority"><option>P0</option><option>P1</option><option>P2</option></select></label>
          <label><span>说明</span><textarea v-model="itemForm.description" placeholder="说明背景、目标或验收标准"></textarea></label>
          <div class="modal-actions">
            <button class="btn ghost" @click="closeItemModal">取消</button>
            <button class="btn primary" @click="createItem">创建事项</button>
          </div>
        </div>
      </section>
    </div>

    <div class="toast" :class="{ show: toastMessage }">{{ toastMessage }}</div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, reactive, ref, watch } from "vue";

const storageKey = "kiviflow-vue-mvp-state";

const taskStatuses = ["未开始", "进行中", "已完成", "已验收"];

const statusMap = {
  待处理: "未开始",
  待评审: "未开始",
  待开发: "未开始",
  待测试: "进行中",
  立项: "未开始",
  需求确认: "未开始",
  设计确认: "未开始",
  开发实施: "进行中",
  测试验收: "进行中",
  交付归档: "已验收",
};

const templates = [
  {
    id: "agile",
    name: "敏捷研发模板",
    badge: "敏捷",
    summary: "适合产品研发、SaaS、平台功能迭代。",
    tabs: ["概览", "Backlog", "Sprint", "看板", "版本", "复盘"],
    types: ["Epic", "需求", "任务", "缺陷", "技术债"],
    statuses: taskStatuses,
    defaultItemType: "需求",
    points: ["需求池与优先级排序", "Sprint 计划与容量", "看板流转与缺陷闭环"],
  },
  {
    id: "waterfall",
    name: "瀑布交付模板",
    badge: "瀑布",
    summary: "适合客户项目、实施交付、硬期限上线项目。",
    tabs: ["概览", "阶段计划", "里程碑", "交付物", "风险", "验收"],
    types: ["阶段", "任务", "交付物", "风险", "变更", "验收项"],
    statuses: taskStatuses,
    defaultItemType: "任务",
    points: ["阶段门和里程碑", "交付物清单", "风险变更与验收管理"],
  },
];

const seedState = {
  projects: [
    { id: "crm", name: "CRM 线索协同", templateId: "agile", owner: "林夏", status: "进行中", health: 78, description: "围绕销售线索协同进行迭代式研发交付。" },
    { id: "mall", name: "商场 AR 交付", templateId: "waterfall", owner: "韩越", status: "设计确认", health: 72, description: "面向客户交付的 AR 活动项目，按阶段推进交付物和验收。" },
    { id: "ai", name: "AI 试衣平台", templateId: "agile", owner: "周程", status: "规划中", health: 86, description: "围绕 AI 试衣核心能力持续迭代。" },
  ],
  items: [
    { id: "i1", code: "AGL-118", projectId: "crm", type: "需求", title: "批量分配线索", status: "未开始", owner: "林夏", priority: "P0", next: "补齐验收标准并确认是否进入 v1.6.0", description: "支持销售主管按区域、客户等级、线索来源批量分配线索。" },
    { id: "i2", code: "AGL-124", projectId: "crm", type: "任务", title: "迭代燃尽图数据接口", status: "进行中", owner: "周程", priority: "P1", next: "完成剩余工作量统计接口", description: "提供 Sprint 维度的燃尽图数据。" },
    { id: "i3", code: "AGL-130", projectId: "crm", type: "缺陷", title: "客户归属变更后看板未刷新", status: "未开始", owner: "韩越", priority: "P1", next: "确认缓存刷新策略", description: "客户归属字段被批量更新后，销售工作台仍展示旧数据。" },
    { id: "i4", code: "WAT-203", projectId: "mall", type: "交付物", title: "客户需求确认书", status: "未开始", owner: "韩越", priority: "P0", next: "补齐客户签字版和范围边界", description: "瀑布项目进入设计前必须冻结需求范围和验收口径。" },
    { id: "i5", code: "WAT-219", projectId: "mall", type: "风险", title: "设计确认延期", status: "未开始", owner: "陈澈", priority: "P1", next: "确认客户反馈截止时间", description: "客户设计确认延期 2 天，影响后续开发实施窗口。" },
  ],
};

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return normalizeState(saved ? JSON.parse(saved) : seedState);
  } catch {
    return normalizeState(seedState);
  }
}

function normalizeState(rawState) {
  return {
    projects: rawState.projects || seedState.projects,
    items: (rawState.items || seedState.items).map((item) => ({
      ...item,
      status: taskStatuses.includes(item.status) ? item.status : statusMap[item.status] || "未开始",
    })),
  };
}

const state = reactive(loadState());
const currentView = ref("home");
const currentProjectId = ref(state.projects[0]?.id || "crm");
const projectTab = ref("概览");
const workFilter = ref("all");
const searchText = ref("");
const selectedItemId = ref(null);
const projectModalOpen = ref(false);
const itemModalOpen = ref(false);
const toastMessage = ref("");
const people = ["林夏", "周程", "韩越", "陈澈"];

const projectForm = reactive({ name: "", owner: "林夏", description: "", templateId: "agile" });
const itemForm = reactive({ type: "需求", title: "", owner: "林夏", priority: "P1", description: "" });

const projects = computed(() => state.projects);
const items = computed(() => state.items);
const navItems = [
  { key: "home", label: "平台首页", short: "台" },
  { key: "projects", label: "项目库", short: "项" },
  { key: "templates", label: "模板中心", short: "模" },
  { key: "workbench", label: "我的工作", short: "工" },
  { key: "reports", label: "组织报表", short: "报" },
  { key: "settings", label: "平台设置", short: "设" },
];
const workFilters = [
  { key: "all", label: "全部" },
  { key: "todo", label: "未开始" },
  { key: "blocked", label: "高优先级" },
  { key: "mine", label: "我负责" },
];

const pageTitle = computed(() => {
  const map = { home: "平台首页", projects: "项目库", templates: "模板中心", workbench: "我的工作", reports: "组织报表", settings: "平台设置", project: currentProject.value.name };
  return map[currentView.value] || "项目空间";
});
const currentProject = computed(() => projectById(currentProjectId.value));
const currentTemplate = computed(() => templateById(currentProject.value.templateId));
const currentProjectItems = computed(() => items.value.filter((item) => item.projectId === currentProjectId.value));
const currentOpenCount = computed(() => currentProjectItems.value.filter((item) => !["已完成", "已验收"].includes(item.status)).length);
const selectedItem = computed(() => items.value.find((item) => item.id === selectedItemId.value));
const openItemCount = computed(() => items.value.filter((item) => !["已完成", "已验收"].includes(item.status)).length);
const highPriorityCount = computed(() => items.value.filter((item) => ["P0", "P1"].includes(item.priority)).length);
const agileCount = computed(() => projects.value.filter((project) => project.templateId === "agile").length);
const waterfallCount = computed(() => projects.value.filter((project) => project.templateId === "waterfall").length);
const agileRatio = computed(() => projects.value.length ? Math.round((agileCount.value / projects.value.length) * 100) : 0);
const waterfallRatio = computed(() => 100 - agileRatio.value);
const averageHealth = computed(() => projects.value.length ? Math.round(projects.value.reduce((sum, project) => sum + project.health, 0) / projects.value.length) : 0);
const riskyItems = computed(() => items.value.filter((item) => item.priority === "P0" || item.type === "风险"));
const filteredWorkbenchItems = computed(() => items.value.filter((item) => {
  if (workFilter.value === "all") return true;
  if (workFilter.value === "todo") return item.status === "未开始";
  if (workFilter.value === "blocked") return ["P0", "P1"].includes(item.priority);
  if (workFilter.value === "mine") return ["林夏", "周程"].includes(item.owner);
  return true;
}));
const isBoardTab = computed(() => ["看板", "阶段计划"].includes(projectTab.value));
const isTimelineTab = computed(() => ["里程碑", "路线图"].includes(projectTab.value));
const visibleProjectItems = computed(() => {
  if (projectTab.value === "Backlog") return currentProjectItems.value.filter((item) => ["Epic", "需求", "技术债"].includes(item.type));
  if (projectTab.value === "Sprint") return currentProjectItems.value.filter((item) => ["任务", "缺陷", "需求"].includes(item.type));
  if (projectTab.value === "风险") return currentProjectItems.value.filter((item) => item.type === "风险" || item.priority === "P0");
  if (projectTab.value === "交付物") return currentProjectItems.value.filter((item) => ["交付物", "验收项"].includes(item.type));
  return currentProjectItems.value;
});

watch(state, persist, { deep: true });
watch(currentProjectId, () => {
  projectTab.value = currentTemplate.value.tabs[0];
});

function persist() {
  localStorage.setItem(storageKey, JSON.stringify({ projects: state.projects, items: state.items }));
}

function templateById(id) {
  return templates.find((template) => template.id === id) || templates[0];
}

function projectById(id) {
  return state.projects.find((project) => project.id === id) || state.projects[0];
}

function statusesForItem(item) {
  return templateById(projectById(item.projectId).templateId).statuses;
}

function setItemStatus(itemId, status) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.status = status;
  persist();
  showToast(`状态已更新为：${status}`);
}

function advanceItem(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const statuses = statusesForItem(item);
  const currentIndex = statuses.indexOf(item.status);
  const nextStatus = statuses[Math.min(currentIndex + 1, statuses.length - 1)];
  if (!nextStatus || nextStatus === item.status) {
    showToast("已经是最后一个状态");
    return;
  }
  setItemStatus(itemId, nextStatus);
}

function setView(view) {
  currentView.value = view;
  selectedItemId.value = null;
}

function openProject(id) {
  currentProjectId.value = id;
  currentView.value = "project";
  selectedItemId.value = null;
}

function openItem(id) {
  selectedItemId.value = id;
}

function openProjectModal(templateId = "agile") {
  projectForm.templateId = templateId;
  projectModalOpen.value = true;
}

function closeProjectModal() {
  projectModalOpen.value = false;
}

function openItemModal() {
  itemForm.type = currentTemplate.value.defaultItemType;
  itemForm.title = "";
  itemForm.owner = currentProject.value.owner;
  itemForm.priority = "P1";
  itemForm.description = "";
  itemModalOpen.value = true;
}

function closeItemModal() {
  itemModalOpen.value = false;
}

function createProject() {
  if (!projectForm.name.trim()) {
    showToast("请填写项目名称");
    return;
  }
  const id = `p-${Date.now()}`;
  state.projects.unshift({
    id,
    name: projectForm.name.trim(),
    templateId: projectForm.templateId,
    owner: projectForm.owner,
    status: projectForm.templateId === "agile" ? "规划中" : "立项",
    health: 90,
    description: projectForm.description.trim() || "这是一个通过模板创建的新项目。",
  });
  projectForm.name = "";
  projectForm.description = "";
  closeProjectModal();
  openProject(id);
  showToast("项目已创建");
}

function createItem() {
  if (!itemForm.title.trim()) {
    showToast("请填写事项标题");
    return;
  }
  const template = currentTemplate.value;
  const prefix = template.id === "agile" ? "AGL" : "WAT";
  state.items.unshift({
    id: `i-${Date.now()}`,
    code: `${prefix}-${Math.floor(Math.random() * 800 + 200)}`,
    projectId: currentProjectId.value,
    type: itemForm.type,
    title: itemForm.title.trim(),
    status: template.statuses[0],
    owner: itemForm.owner,
    priority: itemForm.priority,
    next: "补充说明、拆分任务并推进状态",
    description: itemForm.description.trim() || "这是项目内新建的事项。",
  });
  closeItemModal();
  showToast("事项已创建");
}

function runSearch() {
  const keyword = searchText.value.trim();
  if (!keyword) return;
  const item = items.value.find((entry) => `${entry.code}${entry.title}${entry.owner}`.includes(keyword));
  const project = projects.value.find((entry) => `${entry.name}${entry.owner}`.includes(keyword));
  if (item) openItem(item.id);
  else if (project) openProject(project.id);
  else showToast("没有找到匹配结果");
}

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastMessage.value = "";
  }, 2200);
}

const TemplateCard = defineComponent({
  props: { template: Object, selectable: Boolean, selected: Boolean },
  emits: ["select"],
  setup(props, { emit }) {
    return () => h("button", {
      class: ["template-card", { selected: props.selected }],
      onClick: () => emit("select", props.template.id),
    }, [
      h("header", [h("div", [h("span", { class: ["pill", props.template.id] }, props.template.badge), h("h3", props.template.name)])]),
      h("p", props.template.summary),
      h("ul", props.template.points.map((point) => h("li", point))),
    ]);
  },
});

const ProjectRow = defineComponent({
  props: { project: Object, template: Object },
  emits: ["open"],
  setup(props, { emit }) {
    return () => h("button", { class: "project-row", onClick: () => emit("open") }, [
      h("span", { class: "type" }, props.template.badge.slice(0, 1)),
      h("span", [
        h("span", { class: "row-title" }, props.project.name),
        h("span", { class: "row-meta" }, [props.template.name, `负责人：${props.project.owner}`, `健康度：${props.project.health}`].map((text) => h("span", text))),
      ]),
      h("span", { class: ["pill", props.project.templateId] }, props.project.status),
    ]);
  },
});

const ItemRow = defineComponent({
  props: { item: Object, project: Object, statuses: Array },
  emits: ["open", "status", "advance"],
  setup(props, { emit }) {
    return () => h("button", { class: "row", onClick: () => emit("open") }, [
      h("span", { class: "type" }, props.item.type.slice(0, 1)),
      h("span", [
        h("span", { class: "row-title" }, props.item.title),
        h("span", { class: "row-meta" }, [props.item.code, props.project.name, props.item.owner, props.item.next].map((text) => h("span", text))),
      ]),
      h("span", { class: "status-actions", onClick: (event) => event.stopPropagation() }, [
        h("select", {
          value: props.item.status,
          onChange: (event) => emit("status", props.item.id, event.target.value),
        }, props.statuses.map((status) => h("option", { value: status }, status))),
        h("button", { class: "btn ghost small", onClick: () => emit("advance", props.item.id) }, "推进"),
      ]),
    ]);
  },
});

const ItemTableRow = defineComponent({
  props: { item: Object, statuses: Array },
  emits: ["open", "status", "advance"],
  setup(props, { emit }) {
    return () => h("button", { class: "table-row", onClick: () => emit("open") }, [
      h("span", { class: "pill" }, props.item.type),
      h("span", [h("span", { class: "row-title" }, props.item.title), h("span", { class: "row-meta" }, [props.item.code, props.item.next].map((text) => h("span", text)))]),
      h("span", props.item.owner),
      h("span", props.item.priority),
      h("span", { class: "status-actions", onClick: (event) => event.stopPropagation() }, [
        h("select", {
          value: props.item.status,
          onChange: (event) => emit("status", props.item.id, event.target.value),
        }, props.statuses.map((status) => h("option", { value: status }, status))),
        h("button", { class: "btn ghost small", onClick: () => emit("advance", props.item.id) }, "推进"),
      ]),
    ]);
  },
});

const BoardView = defineComponent({
  props: { statuses: Array, items: Array },
  emits: ["open", "status", "advance"],
  setup(props, { emit }) {
    return () => h("div", { class: "board" }, props.statuses.map((status) => {
      const cards = props.items.filter((item) => item.status === status);
      return h("section", { class: "column" }, [
        h("div", { class: "column-head" }, [h("h3", status), h("span", { class: "pill" }, cards.length)]),
        h("div", { class: "cards" }, cards.length ? cards.map((item) => h("button", { class: "card", onClick: () => emit("open", item.id) }, [
          h("span", { class: "row-meta" }, [h("span", item.code), h("span", item.priority)]),
          h("strong", item.title),
          h("p", item.next),
          h("span", { class: "row-meta" }, [h("span", item.owner), h("span", item.type)]),
          h("span", { class: "status-actions", onClick: (event) => event.stopPropagation() }, [
            h("select", {
              value: item.status,
              onChange: (event) => emit("status", item.id, event.target.value),
            }, props.statuses.map((option) => h("option", { value: option }, option))),
            h("button", { class: "btn ghost small", onClick: () => emit("advance", item.id) }, "推进"),
          ]),
        ])) : h("p", "暂无事项")),
      ]);
    }));
  },
});

const TimelineView = defineComponent({
  props: { statuses: Array },
  setup(props) {
    return () => h("section", { class: "panel timeline" }, props.statuses.map((status, index) => h("div", { class: "timeline-row" }, [
      h("strong", status),
      h("div", [h("span", { style: `--left:${Math.min(index * 14, 82)}%;--width:14%` }, status)]),
    ])));
  },
});
</script>
