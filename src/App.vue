<template>
  <LoginView
    v-if="showLogin"
    :saving="store.auth.saving"
    :error="store.auth.error"
    @login="login"
  />
  <main v-else-if="showAuthLoading" class="login-page">
    <section class="login-panel">
      <p class="eyebrow">GridProject</p>
      <h1>正在恢复登录状态</h1>
    </section>
  </main>
  <AppShell
    v-else
    :routes="routesForUser"
    :current-view="currentView"
    :settings="settings"
    :manager="currentManager"
    :preferences="preferences"
    show-logout
    :project-context="projectSidebarContext"
    @navigate="setView"
    @project-view="selectProjectView"
    @account-navigate="handleAccountAction"
    @logout="logout"
  >
      <header class="topbar">
        <div class="topbar-context" aria-label="当前位置">
          <span v-if="currentView === 'project'">项目库</span>
          <Icon v-if="currentView === 'project'" name="chevronRight" />
          <strong>{{ currentView === "project" ? project.name : pageTitle }}</strong>
        </div>
        <div class="topbar-tools">
          <div ref="searchRoot" class="search-combobox" :class="{ expanded: searchExpanded || rawSearchText }" @keydown.down.prevent="moveSearch(1)" @keydown.up.prevent="moveSearch(-1)" @keydown.enter.prevent="openActiveSearchResult" @keydown.esc="closeSearch">
          <button v-if="!searchExpanded && !rawSearchText" class="command-search-trigger" type="button" aria-label="打开全局搜索" @click="expandSearch">
            <Icon name="search" />
            <span>搜索</span>
          </button>
          <label v-else class="search compact-search">
            <Icon name="search" />
            <input
              ref="searchInput"
              v-model="rawSearchText"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              :aria-controls="searchPanelId"
              :aria-expanded="searchPanelOpen"
              placeholder="搜索项目、事项或负责人"
              @focus="searchFocused = true; searchExpanded = true"
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
                <small>{{ result.owner }} · {{ result.status }} · 上线 {{ result.releaseDate || "未设置" }}</small>
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
          <AccountMenu class="desktop-account-menu" :user="currentManager" :preferences="preferences" show-logout @navigate="handleAccountAction" @logout="logout" />
        </div>
      </header>

      <DashboardView
        v-if="currentView === 'dashboard'"
        :projects="visibleProjects"
        :project-rows="visibleProjectRows"
        :open-issues="visibleOpenIssues"
        :manager-name="currentManager.name"
        :current-user="store.currentUser.value"
        :users="store.users.value"
        :project-members="store.projectMembers.value"
        :time-entries="store.timeEntries.value"
        :preferences="preferences"
        :is-admin="store.currentContext.value.isAdmin"
        @show-projects="setView('projects')"
        @open-project="openProject"
        @open-issue="openIssue"
        @open-timesheets="setView('timesheets')"
      />

      <ProjectLibraryView
        v-else-if="currentView === 'projects'"
        :project-rows="visibleProjectRows"
        :date-format="preferences.dateFormat"
        @create="openProjectModal()"
        @trash="setView('trash')"
        @open="openProject"
        @edit="openProjectEditModal"
      />

      <TimesheetView
        v-else-if="currentView === 'timesheets'"
        :projects="visibleProjects"
        :issues="visibleIssuesForUser"
        :time-entries="store.timeEntries.value"
        :people="people"
        :manager-name="currentManager.name"
        :context="store.currentContext.value"
        :project-members="store.projectMembers.value"
        @create="createTimeEntry"
        @update="updateTimeEntry"
        @delete="deleteTimeEntry"
        @submit="submitTimeEntry"
      />

      <CostManagementView
        v-else-if="currentView === 'costs' && store.currentContext.value.isAdmin"
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
        v-else-if="currentView === 'users' && store.currentContext.value.isAdmin"
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
        v-else-if="currentView === 'settings' && store.currentContext.value.isAdmin"
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
        :visual-review-mode="visualReviewMode"
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
      @comment="addIssueCommentWithResolver"
      @time-entry="addTimeEntry"
      @delete="requestDeleteIssue"
    />

    <ProjectCreateView
      :open="projectModalOpen"
      :templates="templates"
      :people="people"
      :selected-template-id="selectedTemplateId"
      :project="editingProject"
      :busy="store.operation.saving"
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

    <PersonalSettingsView
      v-if="personalSettingsSection"
      :section="personalSettingsSection"
      :user="store.currentUser.value"
      :preferences="preferences"
      :saving="store.operation.saving"
      :api-mode="store.apiMode"
      @close="closePersonalSettings"
      @navigate="openPersonalSettings"
      @save-profile="saveProfile"
      @save-preferences="savePreferences"
      @save-password="savePassword"
    />

    <Toast :message="toastMessage" />
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ROUTES } from "./router/routes";
import { useProjects } from "./composables/useProjects";
import { useProjectWorkspace } from "./composables/useProjectWorkspace";
import { useGlobalSearch } from "./composables/useGlobalSearch";
import { useOverlayState } from "./composables/useOverlayState";
import { useRouteState } from "./composables/useRouteState";
import AppShell from "./components/ui/AppShell.vue";
import Icon from "./components/ui/Icon.vue";
import Toast from "./components/ui/Toast.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import AccountMenu from "./components/account/AccountMenu.vue";
import { applyVisualScenario } from "./qa/visualScenarios.js";
import DashboardView from "./views/DashboardView.vue";
import ProjectLibraryView from "./views/ProjectLibraryView.vue";
import ProjectWorkspaceView from "./views/ProjectWorkspaceView.vue";
import ProjectCreateView from "./views/ProjectCreateView.vue";
import TimesheetView from "./views/TimesheetView.vue";
import CostManagementView from "./views/CostManagementView.vue";
import UserManagementView from "./views/UserManagementView.vue";
import TrashView from "./views/TrashView.vue";
import PlatformSettingsView from "./views/PlatformSettingsView.vue";
import LoginView from "./views/LoginView.vue";
import PersonalSettingsView from "./views/PersonalSettingsView.vue";
import ScheduleImportModal from "./components/project/ScheduleImportModal.vue";
import IssueDrawer from "./components/issue/IssueDrawer.vue";
import IssueCreateModal from "./components/issue/IssueCreateModal.vue";
import { isAppRoutePath, withAppBasePath } from "./services/appEnvironment.js";

const routes = ROUTES;
const store = useProjects();

const selectedTemplateId = ref("agile");
const editingProjectId = ref("");
const projectModalOpen = ref(false);
const issueModalOpen = ref(false);
const scheduleImportOpen = ref(false);

const {
  templates,
  projects,
  people,
  openIssues,
  projectRows,
  settings,
  preferences,
} = store;

const visibleProjects = computed(() => projects.value.filter((entry) => store.getProjectPermissions(entry.id).canView));
const visibleProjectIds = computed(() => new Set(visibleProjects.value.map((entry) => entry.id)));
const visibleProjectRows = computed(() => projectRows.value.filter((entry) => visibleProjectIds.value.has(entry.id)));
const visibleIssuesForUser = computed(() => store.issues.value.filter((issue) => visibleProjectIds.value.has(issue.projectId)));
const visibleOpenIssues = computed(() => openIssues.value.filter((issue) => visibleProjectIds.value.has(issue.projectId)));

const {
  rawSearchText,
  debouncedSearchText,
  searchFocused,
  searchExpanded,
  searchRoot,
  searchInput,
  searchPanelId,
  searchResults,
  flatSearchResults,
  searchPanelOpen,
  activeSearchResult,
  moveSearch,
  closeSearch,
  expandSearch,
  handleSearchInput,
  setSearchText,
} = useGlobalSearch({ projects: visibleProjects, issues: visibleIssuesForUser, projectName });

const {
  toastMessage,
  confirmDialog,
  personalSettingsSection,
  showToast,
  requestConfirm,
  closeConfirmDialog,
  openPersonalSettings,
  closePersonalSettings,
  syncPersonalSettingsFromPath,
} = useOverlayState();

const {
  currentView,
  currentProjectId,
  selectedIssueId,
  workspaceUrlFilters,
  workspaceSort,
  workspacePage,
  workspaceViewMode,
  visualReviewMode,
  projectNavigationMode,
  bindActiveView,
  mountRouteListeners,
  updateWorkspaceUrlState,
  applyUrlState,
  syncUrlState,
} = useRouteState({
  routes,
  projects,
  store,
  searchText: debouncedSearchText,
  setSearchText,
  personalSettingsSection,
  syncPersonalSettingsFromPath,
});

const {
  activeView,
  project,
  template,
  issues: workspaceIssues,
  summary,
  visibleIssues,
} = useProjectWorkspace(currentProjectId);

bindActiveView(activeView);

const pageTitle = computed(() => {
  if (currentView.value === "project") return "项目空间";
  if (currentView.value === "trash") return "回收站";
  const route = routes.find((item) => item.key === currentView.value);
  return route?.label || "主页";
});
const browserTitle = computed(() => currentView.value === "project" && project.value?.name ? `${project.value.name} | GridProject` : "GridProject");
const currentManager = computed(() => ({
  name: store.currentUser.value?.name || "未登录",
  email: store.currentUser.value?.email || "",
  role: store.currentUser.value?.role || "MEMBER",
}));

const selectedIssue = computed(() => store.getIssue(selectedIssueId.value));
const selectedIssueProject = computed(() => selectedIssue.value ? store.getProject(selectedIssue.value.projectId) : project.value);
const selectedIssueTemplate = computed(() => selectedIssueProject.value ? store.getTemplate(selectedIssueProject.value.templateId) : templates.value[0]);
const selectedIssueTimeEntries = computed(() => selectedIssue.value ? store.getIssueTimeEntries(selectedIssue.value.id) : []);
const editingProject = computed(() => editingProjectId.value ? store.getProject(editingProjectId.value) : null);
const projectPermissions = computed(() => store.getProjectPermissions(project.value.id));
const projectSidebarContext = computed(() => {
  if (currentView.value !== "project" || projectNavigationMode.value !== "sidebar" || !project.value) return null;
  return {
    name: project.value.name,
    views: template.value.views,
    activeView: activeView.value,
  };
});
const routesForUser = computed(() => routes.filter((route) => (
  !["costs", "users", "settings"].includes(route.key) || store.currentContext.value.isAdmin
)));
const showAuthLoading = computed(() => store.apiMode && !store.auth.initialized && store.auth.loading);
const showLogin = computed(() => store.apiMode && store.auth.initialized && !store.auth.authenticated);

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const qaScenario = params.get("qa");
  if (isLocalQaScenario(qaScenario)) {
    visualReviewMode.value = qaScenario;
    applyVisualScenario(store.state, qaScenario);
  }
  applyUrlState(params);
  syncUrlState("replace");
  mountRouteListeners();
});

watch(browserTitle, (title) => {
  document.title = title;
}, { immediate: true });

watch(() => store.auth.authenticated, (authenticated) => {
  if (!store.apiMode) return;
  if (!authenticated && !isAppRoutePath(window.location.pathname, "/login")) {
    window.history.replaceState({}, "", withAppBasePath("/login"));
  }
  if (authenticated && isAppRoutePath(window.location.pathname, "/login")) {
    window.history.replaceState({}, "", withAppBasePath("/"));
  }
}, { immediate: true });

watch([currentView, () => store.currentContext.value.isAdmin], ([view, isAdmin]) => {
  if (["costs", "users", "settings"].includes(view) && !isAdmin) {
    currentView.value = "dashboard";
    showToast("没有权限访问该页面");
  }
}, { immediate: true });

function setView(view) {
  if (["costs", "users", "settings"].includes(view) && !store.currentContext.value.isAdmin) {
    currentView.value = "dashboard";
    showToast("没有权限访问该页面");
    return;
  }
  currentView.value = view;
  selectedIssueId.value = null;
  closeSearch();
}

function handleAccountAction(action) {
  if (action === "timesheet-week" || action === "timesheet-day") {
    setView("timesheets");
    return;
  }
  openPersonalSettings(action);
}

async function saveProfile(payload, resolve) {
  const result = await store.updateProfile(payload);
  if (result.ok) showToast("个人资料已保存");
  resolve(result);
}

async function savePreferences(payload, resolve) {
  const result = await store.updatePreferences(payload);
  if (result.ok) showToast("偏好设置已保存");
  resolve(result);
}

async function savePassword(payload, resolve) {
  const result = await store.updateCurrentPassword(payload);
  if (result.ok) showToast("密码已更新，其他设备已退出登录");
  resolve(result);
}

function openProject(projectId) {
  if (!visibleProjectIds.value.has(projectId)) {
    currentView.value = "dashboard";
    showToast("没有权限访问该项目");
    return;
  }
  currentProjectId.value = projectId;
  currentView.value = "project";
  selectedIssueId.value = null;
  closeSearch();
  if (store.apiMode) {
    store.loadProjectBoard(projectId).catch((error) => showToast(error.message || "项目看板加载失败"));
  }
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

async function login(input) {
  const result = await store.login(input);
  if (!result.ok) showToast(result.message || "登录失败");
}

async function logout() {
  await store.logout();
  showToast(store.apiMode ? "已退出登录" : "本地演示模式无需退出登录");
}

async function createProject(input) {
  if (!input.name?.trim()) {
    showToast("请填写项目名称");
    return;
  }

  const { timeline, ...projectInput } = input;
  const created = await store.createProject({
    ...projectInput,
    skipSeedIssues: Boolean(timeline?.valid && timeline.behavior !== "dates-only"),
  });
  if (!created?.id) {
    showToast(created?.message || store.operation.error || "项目创建失败");
    return;
  }
  if (timeline?.valid && timeline.behavior !== "dates-only") {
    const imported = await store.importProjectSchedule(created.id, timeline, { behavior: timeline.behavior });
    if (imported?.ok === false) {
      showToast(`项目已创建，但 Timeline 写入失败：${imported.message || store.operation.error || "请稍后重试"}`);
      return;
    }
  }
  closeProjectModal();
  openProject(created.id);
  showToast(timeline?.valid ? "项目与 Timeline 已保存" : "项目已创建");
}

async function updateProject(projectId, patch) {
  const result = await store.updateProject(projectId, patch);
  if (!result?.id) {
    showToast(result?.message || store.operation.error || "项目更新失败");
    return;
  }
  showToast("项目已更新");
}

async function saveProject(projectId, patch, confirmed = false) {
  const { timeline, ...projectPatch } = patch;
  if (timeline?.behavior === "replace" && !confirmed) {
    requestConfirm({
      title: "替换已导入的 Timeline",
      message: "这会移除并重建此前由 Timeline 导入的任务。手工创建的任务会保留。",
      confirmText: "确认替换",
      onConfirm: () => {
        closeConfirmDialog();
        saveProject(projectId, patch, true);
      },
    });
    return;
  }
  const result = await store.updateProject(projectId, projectPatch);
  if (!result?.id) {
    showToast(result?.message || store.operation.error || "项目信息保存失败");
    return;
  }
  if (timeline?.valid && timeline.behavior !== "dates-only") {
    const imported = await store.importProjectSchedule(projectId, timeline, { behavior: timeline.behavior });
    if (imported?.ok === false) {
      showToast(`项目信息已保存，但 Timeline 写入失败：${imported.message || store.operation.error || "请稍后重试"}`);
      return;
    }
  }
  closeProjectModal();
  showToast(timeline?.valid ? "项目与 Timeline 已更新" : "项目信息已保存");
}

function requestDeleteProject(projectId) {
  const target = store.getProject(projectId);
  requestConfirm({
    title: "删除项目",
    message: `确认删除“${target?.name || "该项目"}”？删除后会进入回收站，30 天内可恢复。`,
    confirmText: "删除项目",
    onConfirm: () => deleteProject(projectId),
  });
}

async function deleteProject(projectId) {
  const result = await store.deleteProject(projectId);
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

async function createIssue(input) {
  if (!input.title?.trim()) {
    showToast("请填写事项标题");
    return;
  }

  const created = await store.createIssue(input, project.value.id);
  if (!created?.id) {
    showToast(created?.message || store.operation.error || "事项创建失败");
    return;
  }
  issueModalOpen.value = false;
  openIssue(created.id);
  showToast("事项已创建");
}

async function importProjectSchedule(input, confirmed = false) {
  if (input.behavior === "replace" && !confirmed) {
    requestConfirm({
      title: "替换已导入的 Timeline",
      message: "这会移除并重建此前由 Timeline 导入的任务。手工创建的任务会保留。",
      confirmText: "确认替换",
      onConfirm: () => {
        closeConfirmDialog();
        importProjectSchedule(input, true);
      },
    });
    return;
  }
  const dates = input.dates || {};
  const projectPatch = {
    ...(dates.startDate ? { startDate: dates.startDate } : {}),
    ...(dates.testDate ? { testDate: dates.testDate } : {}),
    ...(dates.acceptanceDate ? { acceptanceDate: dates.acceptanceDate } : {}),
    ...(dates.releaseDate ? { releaseDate: dates.releaseDate } : {}),
  };
  if (Object.keys(projectPatch).length) await store.updateProject(project.value.id, projectPatch);
  const result = await store.importProjectSchedule(project.value.id, input, { behavior: input.behavior });
  if (result?.ok === false) {
    showToast(result.message || store.operation.error || "排期导入失败");
    return;
  }
  scheduleImportOpen.value = false;
  activeView.value = "概览";

  if (!result.totalCount) {
    showToast("没有可导入的排期事项");
    return;
  }

  const warningText = result.warnings.length ? `，${result.warnings.length} 行需检查` : "";
  const skippedText = result.skipped?.length ? `，保留 ${result.skipped.length} 个手改任务` : "";
  showToast(input.behavior === "dates-only"
    ? "关键日期已更新"
    : `已导入 ${result.created.length} 个、更新 ${result.updated.length} 个，排期风险 ${result.riskCount} 个${skippedText}${warningText}`);
}

async function updateIssue(issueId, patch) {
  const updated = await store.updateIssue(issueId, patch);
  if (!updated?.id) {
    showToast(updated?.message || store.operation.error || "事项保存失败");
    return;
  }
  showToast("事项已保存");
}

function requestDeleteIssue(issueId) {
  const target = store.getIssue(issueId);
  requestConfirm({
    title: "删除任务",
    message: `确认删除“${target?.title || "该任务"}”？删除后会进入回收站，30 天内可恢复。`,
    confirmText: "删除任务",
    onConfirm: () => deleteIssue(issueId),
  });
}

async function deleteIssue(issueId) {
  const deleted = await store.deleteIssue(issueId);
  if (!deleted || deleted.ok === false) {
    showToast(deleted?.message || store.operation.error || "任务删除失败");
    return;
  }
  selectedIssueId.value = null;
  closeConfirmDialog();
  showToast("任务已移入回收站，可在 30 天内恢复");
}

async function addIssueComment(issueId, text) {
  const comment = await store.addIssueComment(issueId, text);
  if (!comment?.id) {
    showToast(comment?.message || store.operation.error || "评论添加失败");
    return { ok: false, message: comment?.message || store.operation.error || "评论添加失败" };
  }
  showToast("评论已添加");
  return { ok: true, comment };
}

async function addIssueCommentWithResolver(issueId, text, resolve) {
  const result = await addIssueComment(issueId, text);
  resolve?.(result);
}

async function addTimeEntry(issueId, input) {
  const entry = await store.addTimeEntry(issueId, input);
  if (!entry?.id) {
    showToast("请填写有效工时");
    return;
  }
  showToast("工时已提交并关联任务");
}

async function createTimeEntry(input, resolve) {
  if (Array.isArray(input)) {
    const entries = [];
    for (const item of input) {
      const entry = await store.createTimeEntry(item);
      if (entry?.id) entries.push(entry);
      else if (entry?.ok === false) {
        showToast(entry.message || "工时创建失败");
        resolve?.({ ok: false, message: entry.message || "工时创建失败" });
        return;
      }
    }
    if (!entries.length) {
      showToast("请选择任务并填写有效工时");
      resolve?.({ ok: false, message: "请选择项目、日期并填写有效工时" });
      return;
    }
    showToast(`已创建 ${entries.length} 条工时`);
    resolve?.({ ok: true, entries });
    return;
  }

  const entry = await store.createTimeEntry(input);
  if (!entry?.id) {
    const message = entry?.message || store.operation.error || "请选择项目、日期并填写有效工时";
    showToast(message);
    resolve?.({ ok: false, message });
    return;
  }
  let finalEntry = entry;
  if (input.status === "SUBMITTED" && store.apiMode) {
    const submitted = await store.submitTimeEntry(entry.id);
    if (!submitted?.ok) {
      const message = submitted?.message || store.operation.error || "工时提交失败";
      showToast(message);
      resolve?.({ ok: false, message, entry });
      return;
    }
    finalEntry = submitted.entry || entry;
  }
  showToast(input.status === "SUBMITTED" ? "工时已提交" : "工时已保存");
  resolve?.({ ok: true, entry: finalEntry });
}

async function updateTimeEntry(entryId, patch, resolve) {
  const entry = await store.updateTimeEntry(entryId, patch);
  if (!entry?.id) {
    const message = entry?.message || store.operation.error || "工时更新失败";
    showToast(message);
    resolve?.({ ok: false, message });
    return;
  }
  showToast("工时已更新");
  resolve?.({ ok: true, entry });
}

async function deleteTimeEntry(entryId) {
  const result = await store.deleteTimeEntry(entryId, "前端请求删除工时");
  showToast(result.ok ? "工时已删除" : result.message || "工时删除失败");
}

async function submitTimeEntry(entryId) {
  const result = await store.submitTimeEntry(entryId);
  showToast(result.ok ? "工时已提交" : result.message || "工时提交失败");
}

async function createCostRecord(input) {
  const result = await store.createCostRecord(input);
  showToast(result.ok ? "成本管理记录已创建" : result.message || "成本管理记录创建失败");
}

async function updateCostRecord(recordId, patch) {
  const result = await store.updateCostRecord(recordId, patch);
  showToast(result.ok ? "成本设置已保存" : result.message || "成本设置保存失败");
}

async function deleteCostRecord(recordId) {
  const result = await store.deleteCostRecord(recordId);
  showToast(result.ok ? "成本记录已归档" : result.message || "成本记录归档失败");
}

async function exportCostRecord(recordId, filter) {
  const result = await store.recordCostExport(recordId, filter);
  showToast(result.ok ? "已记录导出请求；后端导出接口将生成 Excel" : "导出失败");
}

async function createUser(input) {
  const result = await store.createUser(input);
  showToast(result.ok ? "人员已创建" : result.message || "人员创建失败");
}

async function updateUser(userId, patch) {
  const result = await store.updateUser(userId, patch);
  showToast(result.ok ? "人员信息已保存" : result.message || "人员更新失败");
}

async function deleteUser(userId) {
  const result = await store.deleteUser(userId);
  const transferList = result.projects?.length ? `：${result.projects.map((item) => item.name).join("、")}` : "";
  showToast(result.ok ? "人员已停用并软删除" : `${result.message || "人员删除失败"}${transferList}`);
}

async function resetUserPassword(userId, input) {
  const result = await store.resetUserPassword(userId, input);
  showToast(result.ok ? "密码已重置，现有 Session 已失效" : result.message || "密码重置失败");
}

async function setIssueStatus(issueId, status) {
  const updated = await store.updateIssue(issueId, { status });
  if (!updated?.id) {
    showToast(updated?.message || store.operation.error || "状态更新失败");
    return;
  }
  showToast(`状态已更新为：${status}`);
}

async function advanceIssue(issueId) {
  const before = store.getIssue(issueId)?.status;
  const advanced = await store.advanceIssue(issueId);
  if (!advanced || advanced.status === before) {
    showToast("已经是最后一个状态");
    return;
  }
  showToast(`已推进到：${advanced.status}`);
}

async function restoreTrashItem(trashId) {
  const result = await store.restoreTrashItem(trashId);
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
  const label = {
    project: "项目",
    issue: "任务",
    milestone: "里程碑",
    costRecord: "成本记录",
    user: "人员",
  }[result.type] || "记录";
  showToast(`${label}已恢复`);
}

async function saveSettings(patch) {
  const result = await store.updateSettings(patch);
  if (!result || result.ok === false) {
    showToast(result?.message || store.operation.error || "平台设置保存失败");
    return;
  }
  showToast("平台设置已保存");
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

function projectName(projectId) {
  return projects.value.find((entry) => entry.id === projectId)?.name || "未知项目";
}

function isLocalQaScenario(qaScenario) {
  if (!qaScenario) return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function selectProjectView(view) {
  activeView.value = view;
}
</script>
