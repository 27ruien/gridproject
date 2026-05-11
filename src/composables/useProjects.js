import { computed } from "vue";
import { useKiviflowStore } from "./useKiviflowStore.js";

export function useProjects() {
  const store = useKiviflowStore();

  const projectRows = computed(() => store.projects.value.map((project) => ({
    ...project,
    template: store.getTemplate(project.templateId),
    summary: store.summarizeProject(project.id),
  })));

  return {
    ...store,
    projectRows,
  };
}
