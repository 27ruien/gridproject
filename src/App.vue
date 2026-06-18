<template>
  <AppShell
    :routes="routesForUser"
    :current-view="currentView"
    :settings="settings"
    :manager="currentManager"
    :project-count="projects.length"
    @navigate="setView"
  >
      <header class="topbar">
        <div>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div ref="searchRoot" class="search-combobox" @keydown.down.prevent="moveSearch(1)" @keydown.up.prevent="moveSearch(-1)" @keydown.enter.prevent="openActiveSearchResult" @keydown.esc="closeSearch">
          <label class="search">
            <Icon name="search" />
            <input
              v-model="rawSearchText"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              :aria-controls="searchPanelId"
              :aria-expanded="searchPanelOpen"
              placeholder="搜索项目、事项或负责人"
              @focus="searchFocused = true"
              @input="handleSearchInput"
            />
          </label>
          <div v-if="searchPanelOpen" :id="searchPanelId" class="search-panel" role="listbox" :aria-label="`搜索结果 ${flatSearchResults.length} 条`">
            <div v-if="searchResults.projects.length" class="search-result-group">
              <p class="eyebrow">项目</p>
              <button
                v-for="result in searchResults.projects"
                :key="result.id"
                class="search-result"
                :class="{ active: activeSearchResult?.kind === 'project' && activeSearchResult.id === result.id }"
                role="option"
                :aria-selected="activeSearchResult?.kind === 'project' && activeSearchResult.id === result.id"
                type="button"
                @click="openProject(result.id)"
              >
                <strong>{{ result.name }}</strong>
                <small>{{ result.owner }} · {{ result.status }} · 截止 {{ result.dueDate }}</small>
              </button>
            </div>
            <div v-if="searchResults.issues.length" class="search-result-group">
              <p class="eyebrow">事项</p>
              <button
                v-for="result in searchResults.issues"
                :key="result.id"
                class="search-result"
                :class="{ active: activeSearchResult?.kind === 'issue' && activeSearchResult.id === result.id }"
                role="option"
                :aria-selected="activeSearchResult?.kind === 'issue' && activeSearchResult.id === result.id"
                type="button"
                @click="openIssueFromSearch(result.id)"
              >
                <strong>{{ result.title }}</strong>
                <small>{{ result.code }} · {{ projectName(result.projectId) }} · {{ result.status }}</small>
              </button>
            </div>
            <p v-if="!flatSearchResults.length" class="quiet-text">没有找到匹配结果。</p>
          </div>
        </div>
      </header>

      <DashboardView
        v-if="currentView === 'dashboard'"
        :projects="projects"
        :project-rows="projectRows"
        :open-issues="openIssues"
        :manager-name="currentManager.name"
        @show-projects="setView('projects')"
        @open-project="openProject"
        @open-issue="openIssue"
      />

      <section v-else-if="currentView === 'projects'" class="view-stack">
        <div class="panel">
          <PageHeader title="项目库" description="按模板、健康度和进度扫描所有项目。">
            <template #actions>
              <Button variant="ghost" size="small" @click="setView('trash')">回收站</Button>
              <Button variant="primary" size="small" @click="openProjectModal()">创建项目</Button>
            </template>
          </PageHeader>
          <ProjectTable :projects="projectRows" @open="openProject" />
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

      <CostManagementView
        v-else-if="currentView === 'costs'"
        :projects="projects"
        :issues="store.issues.value"
        :users="store.users.value"
        :time-entries="store.timeEntries.value"
        :cost-records="store.costRecords.value"
        :context="store.currentContext.value"
        @create="createCostRecord"
        @update="updateCostRecord"
        @delete="deleteCostRecord"
        @export="exportCostRecord"
      />

      <UserManagementView
        v-else-if="currentView === 'users'"
        :users="store.users.value"
        :projects="projects"
        :project-members="store.projectMembers.value"
        :time-entries="store.timeEntries.value"
        :context="store.currentContext.value"
        @create="createUser"
        @update="updateUser"
        @delete="deleteUser"
        @reset-password="resetUserPassword"
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
        :permissions="projectPermissions"
        :url-filters="workspaceUrlFilters"
        :sort="workspaceSort"
        :page="workspacePage"
        :view-mode="workspaceViewMode"
        @create-issue="openIssueModal"
        @import-schedule="openScheduleImport"
        @open-issue="openIssue"
        @status="setIssueStatus"
        @update-project="updateProject"
        @edit-project="openProjectEditModal"
        @delete-project="requestDeleteProject"
        @url-state="updateWorkspaceUrlState"
      />

    <IssueDrawer
      :issue="selectedIssue"
      :project="selectedIssueProject"
      :template="selectedIssueTemplate"
      :people="people"
      :time-entries="selectedIssueTimeEntries"
      @close="selectedIssueId = null"
      @update="updateIssue"
      @comment="addIssueComment"
      @time-entry="addTimeEntry"
      @delete="requestDeleteIssue"
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

    <ScheduleImportModal
      :open="scheduleImportOpen"
      :project="project"
      @close="scheduleImportOpen = false"
      @import="importProjectSchedule"
    />

    <ConfirmDialog
      :open="confirmDialog.open"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      @cancel="closeConfirmDialog"
      @confirm="confirmDialog.onConfirm"
    />

    <Toast :message="toastMessage" />
  </AppShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ROUTES } from "./router/routes";
import { useProjects } from "./composables/useProjects";
import { useProjectWorkspace } from "./composables/useProjectWorkspace";
import AppShell from "./components/ui/AppShell.vue";
import Button from "./components/ui/Button.vue";
import Icon from "./components/ui/Icon.vue";
import PageHeader from "./components/ui/PageHeader.vue";
import Toast from "./components/ui/Toast.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import { applyVisualScenario } from "./qa/visualScenarios.js";
import DashboardView from "./views/DashboardView.vue";
import ProjectWorkspaceView from "./views/ProjectWorkspaceView.vue";
import ProjectCreateView from "./views/ProjectCreateView.vue";
import TimesheetView from "./views/TimesheetView.vue";
import CostManagementView from "./views/CostManagementView.vue";
import UserManagementView from "./views/UserManagementView.vue";
import TrashView from "./views/TrashView.vue";
import PlatformSettingsView from "./views/PlatformSettingsView.vue";
import ProjectTable from "./components/project/ProjectTable.vue";
import ScheduleImportModal from "./components/project/ScheduleImportModal.vue";
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
const scheduleImportOpen = ref(false);
const rawSearchText = ref("");
const debouncedSearchText = ref("");
const workspaceUrlFilters = ref({});
const workspaceSort = ref("");
const workspacePage = ref("");
const workspaceViewMode = ref("");
const searchFocused = ref(false);
const searchRoot = ref(null);
const selectedSearchIndex = ref(0);
const toastMessage = ref("");
const isRestoringUrl = ref(false);
const lastUrl = ref("");
const searchPanelId = `search-results-${Math.random().toString(36).slice(2)}`;
let searchTimer = 0;

const {
  templates,
  projects,
  people,
  openIssues,
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
const currentManager = computed(() => ({
  name: store.currentUser.value.name,
  role: store.currentUser.value.role === "ADMIN" ? "组织管理员" : "项目成员",
}));

const selectedIssue = computed(() => store.getIssue(selectedIssueId.value));
const selectedIssueProject = computed(() => selectedIssue.value ? store.getProject(selectedIssue.value.projectId) : project.value);
const selectedIssueTemplate = computed(() => selectedIssueProject.value ? store.getTemplate(selectedIssueProject.value.templateId) : templates.value[0]);
const selectedIssueTimeEntries = computed(() => selectedIssue.value ? store.getIssueTimeEntries(selectedIssue.value.id) : []);
const editingProject = computed(() => editingProjectId.value ? store.getProject(editingProjectId.value) : null);
const projectPermissions = computed(() => store.getProjectPermissions(project.value.id));
const routesForUser = computed(() => routes.filter((route) => (
  (route.key !== "costs" || projects.value.some((entry) => store.getProjectPermissions(entry.id).canViewCost)) &&
  (route.key !== "users" || store.currentContext.value.isAdmin)
)));
const confirmDialog = ref({
  open: false,
  title: "",
  message: "",
  confirmText: "确认删除",
  onConfirm: () => {},
});
const normalizedSearch = computed(() => debouncedSearchText.value.trim().toLowerCase());
const searchResults = computed(() => {
  if (normalizedSearch.value.length < 2) return { projects: [], issues: [] };
  const projectsResult = projects.value
    .filter((entry) => `${entry.name}${entry.owner}${entry.status}${entry.description}`.toLowerCase().includes(normalizedSearch.value))
    .slice(0, 5)
    .map((entry) => ({ ...entry, kind: "project" }));
  const issuesResult = store.issues.value
    .filter((entry) => `${entry.code}${entry.title}${entry.owner}${entry.creator}${entry.type}${entry.status}${entry.startDate}${entry.dueDate}`.toLowerCase().includes(normalizedSearch.value))
    .slice(0, 6)
    .map((entry) => ({ ...entry, kind: "issue" }));
  return { projects: projectsResult, issues: issuesResult };
});
const flatSearchResults = computed(() => [...searchResults.value.projects, ...searchResults.value.issues]);
const searchPanelOpen = computed(() => searchFocused.value && normalizedSearch.value.length >= 2);
const activeSearchResult = computed(() => flatSearchResults.value[selectedSearchIndex.value] || flatSearchResults.value[0] || null);
const workspaceFilterParam = computed(() => encodeFilters(workspaceUrlFilters.value));

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const qaScenario = params.get("qa");
  if (isLocalQaScenario(qaScenario)) applyVisualScenario(store.state, qaScenario);
  applyUrlState(params);
  syncUrlState("replace");
  document.addEventListener("pointerdown", handleOutsideSearch);
  window.addEventListener("popstate", handlePopState);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutsideSearch);
  window.removeEventListener("popstate", handlePopState);
  window.clearTimeout(searchTimer);
});

watch([currentView, currentProjectId, activeView, selectedIssueId], () => syncUrlState("push"));
watch([debouncedSearchText, workspaceFilterParam, workspaceSort, workspacePage, workspaceViewMode], () => syncUrlState("replace"));

function setView(view) {
  if (view === "users" && !store.currentContext.value.isAdmin) {
    currentView.value = "dashboard";
    showToast("没有权限访问人员管理");
    return;
  }
  currentView.value = view;
  selectedIssueId.value = null;
  closeSearch();
}

function openProject(projectId) {
  currentProjectId.value = projectId;
  currentView.value = "project";
  selectedIssueId.value = null;
  closeSearch();
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

function openScheduleImport() {
  scheduleImportOpen.value = true;
}

function openIssue(issueId) {
  selectedIssueId.value = issueId;
}

function openIssueFromSearch(issueId) {
  const issue = store.getIssue(issueId);
  if (!issue) return;
  openProject(issue.projectId);
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

function requestDeleteProject(projectId) {
  const target = store.getProject(projectId);
  confirmDialog.value = {
    open: true,
    title: "删除项目",
    message: `确认删除“${target?.name || "该项目"}”？删除后会进入回收站，30 天内可恢复。`,
    confirmText: "删除项目",
    onConfirm: () => deleteProject(projectId),
  };
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
  closeConfirmDialog();
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

function importProjectSchedule(input) {
  const result = store.importProjectSchedule(project.value.id, input.text, { merge: input.merge });
  scheduleImportOpen.value = false;
  activeView.value = "概览";

  if (!result.totalCount) {
    showToast("没有可导入的排期事项");
    return;
  }

  const warningText = result.warnings.length ? `，${result.warnings.length} 行需检查` : "";
  showToast(`已导入 ${result.created.length} 个、更新 ${result.updated.length} 个，排期风险 ${result.riskCount} 个${warningText}`);
}

function updateIssue(issueId, patch) {
  store.updateIssue(issueId, patch);
  showToast("事项已保存");
}

function requestDeleteIssue(issueId) {
  const target = store.getIssue(issueId);
  confirmDialog.value = {
    open: true,
    title: "删除任务",
    message: `确认删除“${target?.title || "该任务"}”？删除后会进入回收站，30 天内可恢复。`,
    confirmText: "删除任务",
    onConfirm: () => deleteIssue(issueId),
  };
}

function deleteIssue(issueId) {
  const deleted = store.deleteIssue(issueId);
  if (!deleted) {
    showToast("任务删除失败");
    return;
  }
  selectedIssueId.value = null;
  closeConfirmDialog();
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

function createCostRecord(input) {
  const result = store.createCostRecord(input);
  showToast(result.ok ? "成本管理记录已创建" : result.message || "成本管理记录创建失败");
}

function updateCostRecord(recordId, patch) {
  const result = store.updateCostRecord(recordId, patch);
  showToast(result.ok ? "成本设置已保存" : result.message || "成本设置保存失败");
}

function deleteCostRecord(recordId) {
  const result = store.deleteCostRecord(recordId);
  showToast(result.ok ? "成本记录已归档" : result.message || "成本记录归档失败");
}

function exportCostRecord(recordId, filter) {
  const result = store.recordCostExport(recordId, filter);
  showToast(result.ok ? "已记录导出请求；后端 /api/cost-records/:id/export 将生成 Excel" : "导出失败");
}

async function createUser(input) {
  const result = await store.createUser(input);
  showToast(result.ok ? "人员已创建" : result.message || "人员创建失败");
}

function updateUser(userId, patch) {
  const result = store.updateUser(userId, patch);
  showToast(result.ok ? "人员信息已保存" : result.message || "人员更新失败");
}

function deleteUser(userId) {
  const result = store.deleteUser(userId);
  const transferList = result.projects?.length ? `：${result.projects.map((item) => item.name).join("、")}` : "";
  showToast(result.ok ? "人员已停用并软删除" : `${result.message || "人员删除失败"}${transferList}`);
}

async function resetUserPassword(userId, input) {
  const result = await store.resetUserPassword(userId, input);
  showToast(result.ok ? "密码已重置，现有 Session 已失效" : result.message || "密码重置失败");
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

function moveSearch(step) {
  if (!flatSearchResults.value.length) return;
  selectedSearchIndex.value = (selectedSearchIndex.value + step + flatSearchResults.value.length) % flatSearchResults.value.length;
}

function openActiveSearchResult() {
  const result = activeSearchResult.value;
  if (!result) {
    showToast("没有找到匹配结果");
    return;
  }
  if (result.kind === "project") openProject(result.id);
  if (result.kind === "issue") openIssueFromSearch(result.id);
}

function closeSearch() {
  searchFocused.value = false;
}

function handleSearchInput() {
  selectedSearchIndex.value = 0;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    debouncedSearchText.value = rawSearchText.value;
  }, 200);
}

function handleOutsideSearch(event) {
  if (!searchRoot.value?.contains(event.target)) closeSearch();
}

function closeConfirmDialog() {
  confirmDialog.value = {
    open: false,
    title: "",
    message: "",
    confirmText: "确认删除",
    onConfirm: () => {},
  };
}

function updateWorkspaceUrlState({ filters = workspaceUrlFilters.value, sort = workspaceSort.value, page = workspacePage.value, viewMode = workspaceViewMode.value }) {
  workspaceUrlFilters.value = { ...filters };
  workspaceSort.value = sort || "";
  workspacePage.value = page ? String(page) : "";
  workspaceViewMode.value = viewMode || "";
}

function projectName(projectId) {
  return projects.value.find((entry) => entry.id === projectId)?.name || "未知项目";
}

function isLocalQaScenario(qaScenario) {
  if (!qaScenario) return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function applyUrlState(params) {
  isRestoringUrl.value = true;
  const view = params.get("view");
  const projectId = params.get("project");
  const tab = params.get("tab");
  const issueId = params.get("issue");
  const q = params.get("q");
  rawSearchText.value = q || "";
  debouncedSearchText.value = q || "";
  workspaceUrlFilters.value = parseFilters(params.get("filters"));
  workspaceSort.value = params.get("sort") || "";
  workspacePage.value = params.get("page") || "";
  workspaceViewMode.value = params.get("viewMode") || "";
  if (projectId && projects.value.some((entry) => entry.id === projectId)) currentProjectId.value = projectId;
  if (window.location.pathname === "/users") currentView.value = store.currentContext.value.isAdmin ? "users" : "dashboard";
  if (view && [...routes.map((entry) => entry.key), "project", "trash"].includes(view)) {
    currentView.value = view === "users" && !store.currentContext.value.isAdmin ? "dashboard" : view;
  }
  if (tab) activeView.value = tab;
  selectedIssueId.value = issueId && store.getIssue(issueId) ? issueId : null;
  window.setTimeout(() => {
    isRestoringUrl.value = false;
  }, 0);
}

function handlePopState() {
  applyUrlState(new URLSearchParams(window.location.search));
}

function syncUrlState(mode = "replace") {
  if (isRestoringUrl.value) return;
  const params = new URLSearchParams();
  params.set("view", currentView.value);
  if (currentProjectId.value) params.set("project", currentProjectId.value);
  if (currentView.value === "project") params.set("tab", activeView.value);
  if (selectedIssueId.value) params.set("issue", selectedIssueId.value);
  if (debouncedSearchText.value.trim()) params.set("q", debouncedSearchText.value.trim());
  if (workspaceFilterParam.value) params.set("filters", workspaceFilterParam.value);
  if (workspaceSort.value) params.set("sort", workspaceSort.value);
  if (workspacePage.value) params.set("page", workspacePage.value);
  if (workspaceViewMode.value) params.set("viewMode", workspaceViewMode.value);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  if (nextUrl === lastUrl.value || nextUrl === `${window.location.pathname}${window.location.search}`) return;
  lastUrl.value = nextUrl;
  if (mode === "push") window.history.pushState({}, "", nextUrl);
  else window.history.replaceState({}, "", nextUrl);
}

function encodeFilters(filters = {}) {
  const compact = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined));
  return Object.keys(compact).length ? JSON.stringify(compact) : "";
}

function parseFilters(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
</script>
