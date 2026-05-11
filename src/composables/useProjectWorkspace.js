import { computed, ref, watch } from "vue";
import { useKiviflowStore } from "./useKiviflowStore.js";

export function useProjectWorkspace(projectIdRef) {
  const store = useKiviflowStore();
  const activeView = ref("概览");

  const project = computed(() => store.getProject(projectIdRef.value));
  const template = computed(() => store.getTemplate(project.value.templateId));
  const issues = computed(() => store.getProjectIssues(project.value.id));
  const summary = computed(() => store.summarizeProject(project.value.id));
  const visibleIssues = computed(() => store.filterIssuesForView(project.value.id, activeView.value));

  watch(template, () => {
    activeView.value = template.value.defaultView;
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
