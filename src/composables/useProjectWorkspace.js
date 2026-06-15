import { computed, ref, watch } from "vue";
import { useKiviflowStore } from "./useKiviflowStore.js";

export function useProjectWorkspace(projectIdRef) {
  const store = useKiviflowStore();
  const activeView = ref("概览");

  const project = computed(() => store.getProject(projectIdRef.value) || null);
  const template = computed(() => project.value ? store.getTemplate(project.value.templateId) : store.templates.value[0]);
  const issues = computed(() => project.value ? store.getProjectIssues(project.value.id) : []);
  const summary = computed(() => project.value ? store.summarizeProject(project.value.id) : emptyProjectSummary());
  const visibleIssues = computed(() => project.value ? store.filterIssuesForView(project.value.id, activeView.value) : []);

  watch(template, () => {
    if (template.value) activeView.value = template.value.defaultView;
  }, { immediate: true });

  return {
    ...store,
    activeView,
    project,
    template,
    issues,
    summary,
    visibleIssues,
  };
}

function emptyProjectSummary() {
  return {
    progress: 0,
    health: 0,
    totalCount: 0,
    openCount: 0,
    doneCount: 0,
    overdueCount: 0,
    riskCount: 0,
    scheduleIssueCount: 0,
    scheduleRiskCount: 0,
    actualHours: 0,
    estimatedHours: 0,
    remainingHours: 0,
    milestoneSummary: { totalCount: 0, doneCount: 0, riskCount: 0, progress: 0 },
    nextIssues: [],
    nextStep: "暂无项目。",
  };
}
