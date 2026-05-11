<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark"></span>
        <div>
          <strong>KiviFlow</strong>
          <small>项目管理平台</small>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="route in routes"
          :key="route.key"
          class="nav-item"
          :class="{ active: currentView === route.key }"
          type="button"
          @click="setView(route.key)"
        >
          <span>{{ route.icon }}</span>{{ route.label }}
        </button>
      </nav>

      <section class="manager-card">
        <span class="avatar">林</span>
        <div>
          <strong>{{ currentManager.name }}</strong>
          <small>{{ currentManager.role }} · 管理 {{ projects.length }} 个项目</small>
        </div>
      </section>

    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ workspace.name }}</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <label class="search">
            <span>⌕</span>
            <input v-model="searchText" type="search" placeholder="搜索项目、事项或负责人" @keydown.enter="runSearch" />
          </label>
        </div>
      </header>

      <DashboardView
        v-if="currentView === 'dashboard'"
        :projects="projects"
        :project-rows="projectRows"
        :open-issues="openIssues"
        :risky-issues="riskyIssues"
        @show-projects="setView('projects')"
        @open-project="openProject"
        @open-issue="openIssue"
      />

      <section v-else-if="currentView === 'projects'" class="view-stack">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>项目库</h2>
              <p>按模板、健康度和进度扫描所有项目。</p>
            </div>
            <button class="btn primary small" type="button" @click="openProjectModal()">创建项目</button>
          </div>
          <div class="project-list">
            <ProjectRow
              v-for="row in projectRows"
              :key="row.id"
              :project="row"
              :template="row.template"
              :summary="row.summary"
              @open="openProject"
            />
          </div>
        </div>
      </section>

      <TimesheetView
        v-else-if="currentView === 'timesheets'"
        :projects="projects"
        :issues="store.issues.value"
        :time-entries="store.timeEntries.value"
        :people="people"
        :manager-name="currentManager.name"
        @create="createTimeEntry"
        @update="updateTimeEntry"
      />

      <ProjectWorkspaceView
        v-else-if="currentView === 'project'"
        v-model:active-view="activeView"
        :project="project"
        :template="template"
        :issues="workspaceIssues"
        :summary="summary"
        :visible-issues="visibleIssues"
        :people="people"
        @create-issue="openIssueModal"
        @open-issue="openIssue"
        @status="setIssueStatus"
        @advance="advanceIssue"
      />
    </main>

    <IssueDrawer
      :issue="selectedIssue"
      :project="selectedIssueProject"
      :template="selectedIssueTemplate"
      :people="people"
      :time-entries="selectedIssueTimeEntries"
      @close="selectedIssueId = null"
      @update="updateIssue"
      @advance="advanceIssue"
      @comment="addIssueComment"
      @time-entry="addTimeEntry"
    />

    <ProjectCreateView
      :open="projectModalOpen"
      :templates="templates"
      :people="people"
      :selected-template-id="selectedTemplateId"
      @close="projectModalOpen = false"
      @create="createProject"
    />

    <IssueCreateModal
      :open="issueModalOpen"
      :project="project"
      :template="template"
      :people="people"
      @close="issueModalOpen = false"
      @create="createIssue"
    />

    <div class="toast" :class="{ show: toastMessage }">{{ toastMessage }}</div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { ROUTES } from "./router/routes";
import { WORKSPACE } from "./domain/project";
import { useProjects } from "./composables/useProjects";
import { useProjectWorkspace } from "./composables/useProjectWorkspace";
import DashboardView from "./views/DashboardView.vue";
import ProjectWorkspaceView from "./views/ProjectWorkspaceView.vue";
import ProjectCreateView from "./views/ProjectCreateView.vue";
import TimesheetView from "./views/TimesheetView.vue";
import ProjectRow from "./components/project/ProjectRow.vue";
import IssueDrawer from "./components/issue/IssueDrawer.vue";
import IssueCreateModal from "./components/issue/IssueCreateModal.vue";

const routes = ROUTES;
const workspace = WORKSPACE;
const store = useProjects();

const currentView = ref("dashboard");
const currentProjectId = ref(store.projects.value[0]?.id || "");
const selectedIssueId = ref(null);
const selectedTemplateId = ref("agile");
const projectModalOpen = ref(false);
const issueModalOpen = ref(false);
const searchText = ref("");
const toastMessage = ref("");
const currentManager = {
  name: "林夏",
  role: "项目经理",
};

const {
  templates,
  projects,
  people,
  openIssues,
  riskyIssues,
  projectRows,
} = store;

const {
  activeView,
  project,
  template,
  issues: workspaceIssues,
  summary,
  visibleIssues,
} = useProjectWorkspace(currentProjectId);

const pageTitle = computed(() => {
  if (currentView.value === "project") return project.value.name;
  const route = routes.find((item) => item.key === currentView.value);
  return route?.label || "工作台";
});

const selectedIssue = computed(() => store.getIssue(selectedIssueId.value));
const selectedIssueProject = computed(() => selectedIssue.value ? store.getProject(selectedIssue.value.projectId) : project.value);
const selectedIssueTemplate = computed(() => store.getTemplate(selectedIssueProject.value.templateId));
const selectedIssueTimeEntries = computed(() => selectedIssue.value ? store.getIssueTimeEntries(selectedIssue.value.id) : []);

function setView(view) {
  currentView.value = view;
  selectedIssueId.value = null;
}

function openProject(projectId) {
  currentProjectId.value = projectId;
  currentView.value = "project";
  selectedIssueId.value = null;
}

function openProjectModal(templateId = "agile") {
  selectedTemplateId.value = templateId;
  projectModalOpen.value = true;
}

function openIssueModal() {
  issueModalOpen.value = true;
}

function openIssue(issueId) {
  selectedIssueId.value = issueId;
}

function createProject(input) {
  if (!input.name?.trim()) {
    showToast("请填写项目名称");
    return;
  }

  const created = store.createProject(input);
  projectModalOpen.value = false;
  openProject(created.id);
  showToast("项目已创建，并按模板初始化事项");
}

function createIssue(input) {
  if (!input.title?.trim()) {
    showToast("请填写事项标题");
    return;
  }

  const created = store.createIssue(input, project.value.id);
  issueModalOpen.value = false;
  openIssue(created.id);
  showToast("事项已创建");
}

function updateIssue(issueId, patch) {
  store.updateIssue(issueId, patch);
  showToast("事项已保存");
}

function addIssueComment(issueId, text) {
  store.addIssueComment(issueId, text);
  showToast("评论已添加");
}

function addTimeEntry(issueId, input) {
  const entry = store.addTimeEntry(issueId, input);
  if (!entry) {
    showToast("请填写有效工时");
    return;
  }
  showToast("工时已提交并关联任务");
}

function createTimeEntry(input) {
  if (Array.isArray(input)) {
    const entries = input.map((item) => store.createTimeEntry(item)).filter(Boolean);
    if (!entries.length) {
      showToast("请选择任务并填写有效工时");
      return;
    }
    showToast(`已创建 ${entries.length} 条工时`);
    return;
  }

  const entry = store.createTimeEntry(input);
  if (!entry) {
    showToast("请选择任务并填写有效工时");
    return;
  }
  showToast("工时已创建");
}

function updateTimeEntry(entryId, patch) {
  const entry = store.updateTimeEntry(entryId, patch);
  if (!entry) {
    showToast("工时更新失败");
    return;
  }
  showToast("工时已更新");
}

function setIssueStatus(issueId, status) {
  store.updateIssue(issueId, { status });
  showToast(`状态已更新为：${status}`);
}

function advanceIssue(issueId) {
  const before = store.getIssue(issueId)?.status;
  const advanced = store.advanceIssue(issueId);
  if (!advanced || advanced.status === before) {
    showToast("已经是最后一个状态");
    return;
  }
  showToast(`已推进到：${advanced.status}`);
}

function runSearch() {
  const keyword = searchText.value.trim();
  if (!keyword) return;

  const issue = store.issues.value.find((entry) => `${entry.code}${entry.title}${entry.owner}${entry.creator}${entry.type}${entry.startDate}${entry.dueDate}`.includes(keyword));
  const matchedProject = projects.value.find((entry) => `${entry.name}${entry.owner}${entry.description}`.includes(keyword));

  if (issue) {
    openProject(issue.projectId);
    openIssue(issue.id);
  } else if (matchedProject) {
    openProject(matchedProject.id);
  } else {
    showToast("没有找到匹配结果");
  }
}

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastMessage.value = "";
  }, 2200);
}
</script>
