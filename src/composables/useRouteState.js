import { computed, onBeforeUnmount, ref, watch } from "vue";
import { stripAppBasePath } from "../services/appEnvironment.js";

export function useRouteState({
  routes,
  projects,
  store,
  searchText,
  setSearchText,
  personalSettingsSection,
  syncPersonalSettingsFromPath,
}) {
  const currentView = ref("dashboard");
  const currentProjectId = ref(projects.value[0]?.id || "");
  const selectedIssueId = ref(null);
  const workspaceUrlFilters = ref({});
  const workspaceSort = ref("");
  const workspacePage = ref("");
  const workspaceViewMode = ref("");
  const visualReviewMode = ref("");
  const projectNavigationMode = ref("tabs");
  const isRestoringUrl = ref(false);
  const lastUrl = ref("");
  let activeViewRef = null;
  let stopActiveViewSync = null;

  const workspaceFilterParam = computed(() => encodeFilters(workspaceUrlFilters.value));

  watch(projects, (rows) => {
    if (!rows.length) {
      currentProjectId.value = "";
      return;
    }
    if (!rows.some((entry) => entry.id === currentProjectId.value)) {
      currentProjectId.value = rows[0].id;
    }
  });

  watch([searchText, workspaceFilterParam, workspaceSort, workspacePage, workspaceViewMode], () => syncUrlState("replace"));

  onBeforeUnmount(() => {
    window.removeEventListener("popstate", handlePopState);
    stopActiveViewSync?.();
  });

  function bindActiveView(activeView) {
    activeViewRef = activeView;
    stopActiveViewSync?.();
    stopActiveViewSync = watch([currentView, currentProjectId, activeView, selectedIssueId], () => syncUrlState("push"));
  }

  function mountRouteListeners() {
    window.addEventListener("popstate", handlePopState);
  }

  function updateWorkspaceUrlState({ filters = workspaceUrlFilters.value, sort = workspaceSort.value, page = workspacePage.value, viewMode = workspaceViewMode.value }) {
    workspaceUrlFilters.value = { ...filters };
    workspaceSort.value = sort || "";
    workspacePage.value = page ? String(page) : "";
    workspaceViewMode.value = viewMode || "";
  }

  function applyUrlState(params) {
    isRestoringUrl.value = true;
    const view = params.get("view");
    const projectId = params.get("project");
    const tab = params.get("tab");
    const issueId = params.get("issue");
    const q = params.get("q");

    setSearchText(q || "");
    workspaceUrlFilters.value = parseFilters(params.get("filters"));
    workspaceSort.value = params.get("sort") || "";
    workspacePage.value = params.get("page") || "";
    workspaceViewMode.value = params.get("viewMode") || "";
    projectNavigationMode.value = params.get("projectNav") === "sidebar" ? "sidebar" : "tabs";
    const appPath = stripAppBasePath(window.location.pathname);
    syncPersonalSettingsFromPath(window.location.pathname, window.history.state);

    if (projectId && projects.value.some((entry) => entry.id === projectId)) currentProjectId.value = projectId;
    if (appPath === "/users") currentView.value = store.currentContext.value.isAdmin ? "users" : "dashboard";
    if (view && [...routeKeys(routes), "project", "trash"].includes(view)) {
      currentView.value = view === "users" && !store.currentContext.value.isAdmin ? "dashboard" : view;
    }
    if (tab && activeViewRef) activeViewRef.value = normalizeProjectViewName(tab);
    selectedIssueId.value = issueId && store.getIssue(issueId) ? issueId : null;
    window.setTimeout(() => {
      isRestoringUrl.value = false;
    }, 0);
  }

  function handlePopState() {
    applyUrlState(new URLSearchParams(window.location.search));
  }

  function syncUrlState(mode = "replace") {
    if (isRestoringUrl.value || personalSettingsSection.value) return;
    const params = new URLSearchParams();
    params.set("view", currentView.value);
    if (currentProjectId.value) params.set("project", currentProjectId.value);
    if (currentView.value === "project" && activeViewRef) params.set("tab", activeViewRef.value);
    if (selectedIssueId.value) params.set("issue", selectedIssueId.value);
    if (searchText.value.trim()) params.set("q", searchText.value.trim());
    if (workspaceFilterParam.value) params.set("filters", workspaceFilterParam.value);
    if (workspaceSort.value) params.set("sort", workspaceSort.value);
    if (workspacePage.value) params.set("page", workspacePage.value);
    if (workspaceViewMode.value) params.set("viewMode", workspaceViewMode.value);
    if (currentView.value === "project" && projectNavigationMode.value === "sidebar") params.set("projectNav", "sidebar");
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    if (nextUrl === lastUrl.value || nextUrl === `${window.location.pathname}${window.location.search}`) return;
    lastUrl.value = nextUrl;
    if (mode === "push") window.history.pushState({}, "", nextUrl);
    else window.history.replaceState({}, "", nextUrl);
  }

  return {
    currentView,
    currentProjectId,
    selectedIssueId,
    workspaceUrlFilters,
    workspaceSort,
    workspacePage,
    workspaceViewMode,
    visualReviewMode,
    projectNavigationMode,
    workspaceFilterParam,
    bindActiveView,
    mountRouteListeners,
    updateWorkspaceUrlState,
    applyUrlState,
    syncUrlState,
  };
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

function normalizeProjectViewName(viewName) {
  return {
    Backlog: "待办事项",
    Sprint: "迭代",
    阶段计划: "工作项",
    甘特图: "工作项",
    交付物: "交付与验收",
    验收: "交付与验收",
  }[viewName] || viewName;
}

function routeKeys(routes = []) {
  return routes.flatMap((route) => [route.key, ...(route.children?.length ? routeKeys(route.children) : [])]);
}
