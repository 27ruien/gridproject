<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">{{ settings.logoText }}</span>
        <div>
          <strong>{{ settings.platformName }}</strong>
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
          <span class="nav-icon" :class="`nav-icon-${route.icon}`" aria-hidden="true"></span>{{ route.label }}
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
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <label class="search">
            <span class="search-icon" aria-hidden="true"></span>
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
        :manager-name="currentManager.name"
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
            <div class="topbar-actions">
              <button class="btn ghost small" type="button" @click="setView('trash')">回收站</button>
              <button class="btn primary small" type="button" @click="openProjectModal()">创建项目</button>
            </div>
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

      <TrashView
        v-else-if="currentView === 'trash'"
        :trash="store.trash.value"
        @restore="restoreTrashItem"
      />

      <PlatformSettingsView
        v-else-if="currentView === 'settings'"
        :settings="settings"
        @save="saveSettings"
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
        @update-project="updateProject"
        @edit-project="openProjectEditModal"
        @delete-project="deleteProject"
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
      @delete="deleteIssue"
    />

    <ProjectCreateView
      :open="projectModalOpen"
      :templates="templates"
      :people="people"
      :selected-template-id="selectedTemplateId"
      :project="editingProject"
      @close="closeProjectModal"
      @create="createProject"
      @save="saveProject"
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
import { useProjects } from "./composables/useProjects";
import { useProjectWorkspace } from "./composables/useProjectWorkspace";
import DashboardView from "./views/DashboardView.vue";
import ProjectWorkspaceView from "./views/ProjectWorkspaceView.vue";
import ProjectCreateView from "./views/ProjectCreateView.vue";
import TimesheetView from "./views/TimesheetView.vue";
import TrashView from "./views/TrashView.vue";
import PlatformSettingsView from "./views/PlatformSettingsView.vue";
import ProjectRow from "./components/project/ProjectRow.vue";
import IssueDrawer from "./components/issue/IssueDrawer.vue";
import IssueCreateModal from "./components/issue/IssueCreateModal.vue";

const routes = ROUTES;
const store = useProjects();

const currentView = ref("dashboard");
const currentProjectId = ref(store.projects.value[0]?.id || "");
const selectedIssueId = ref(null);
const selectedTemplateId = ref("agile");
const editingProjectId = ref("");
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
  settings,
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
  if (currentView.value === "project") return "项目空间";
  if (currentView.value === "trash") return "回收站";
  const route = routes.find((item) => item.key === currentView.value);
  return route?.label || "工作台";
});

const selectedIssue = computed(() => store.getIssue(selectedIssueId.value));
const selectedIssueProject = computed(() => selectedIssue.value ? store.getProject(selectedIssue.value.projectId) : project.value);
const selectedIssueTemplate = computed(() => selectedIssueProject.value ? store.getTemplate(selectedIssueProject.value.templateId) : templates.value[0]);
const selectedIssueTimeEntries = computed(() => selectedIssue.value ? store.getIssueTimeEntries(selectedIssue.value.id) : []);
const editingProject = computed(() => editingProjectId.value ? store.getProject(editingProjectId.value) : null);

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
  editingProjectId.value = "";
  selectedTemplateId.value = templateId;
  projectModalOpen.value = true;
}

function openProjectEditModal(projectId) {
  editingProjectId.value = projectId;
  projectModalOpen.value = true;
}

function closeProjectModal() {
  projectModalOpen.value = false;
  editingProjectId.value = "";
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
  closeProjectModal();
  openProject(created.id);
  showToast("项目已创建，并按模板初始化事项");
}

function updateProject(projectId, patch) {
  store.updateProject(projectId, patch);
  showToast("项目已更新");
}

function saveProject(projectId, patch) {
  store.updateProject(projectId, patch);
  closeProjectModal();
  showToast("项目信息已保存");
}

function deleteProject(projectId) {
  const result = store.deleteProject(projectId);
  if (result?.reason === "has-issues") {
    showToast(`项目下还有 ${result.count} 个任务。请先删除或迁移任务，再删除项目。`);
    return;
  }
  if (!result?.ok) {
    showToast("项目删除失败");
    return;
  }
  currentView.value = "projects";
  currentProjectId.value = store.projects.value[0]?.id || "";
  showToast("项目已移入回收站，可在 30 天内恢复");
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

function deleteIssue(issueId) {
  const deleted = store.deleteIssue(issueId);
  if (!deleted) {
    showToast("任务删除失败");
    return;
  }
  selectedIssueId.value = null;
  showToast("任务已移入回收站，可在 30 天内恢复");
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

function restoreTrashItem(trashId) {
  const result = store.restoreTrashItem(trashId);
  if (result?.reason === "missing-project") {
    showToast("该任务所属项目不存在，请先恢复项目");
    return;
  }
  if (result?.reason === "expired") {
    showToast("已超过 30 天恢复期限");
    return;
  }
  if (!result?.ok) {
    showToast("恢复失败");
    return;
  }
  showToast(result.type === "project" ? "项目已恢复" : "任务已恢复");
}

function saveSettings(patch) {
  store.updateSettings(patch);
  showToast("平台设置已保存");
}

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastMessage.value = "";
  }, 2200);
}
</script>
