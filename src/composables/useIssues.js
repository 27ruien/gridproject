import { computed } from "vue";
import { useKiviflowStore } from "./useKiviflowStore.js";

export function useIssues(projectIdRef) {
  const store = useKiviflowStore();

  const projectIssues = computed(() => store.getProjectIssues(projectIdRef.value));
  const openProjectIssues = computed(() => projectIssues.value.filter((issue) => !["已完成", "已验收"].includes(issue.status)));

  return {
    ...store,
    projectIssues,
    openProjectIssues,
  };
}
