import { computed, reactive, watch } from "vue";
import { projectService } from "../services/projectService.js";
import { issueService } from "../services/issueService.js";
import { templateService } from "../services/templateService.js";
import { stateService } from "../services/stateService.js";
import { timeEntryService } from "../services/timeEntryService.js";
import { isClosedStatus } from "../domain/workflow.js";
import { isIssueRisky } from "../domain/issue.js";
import { createTrashItem, isTrashRestorable } from "../domain/trash.js";

const state = reactive(stateService.load());

watch(state, () => stateService.save(state), { deep: true });

export function useKiviflowStore() {
  const templates = computed(() => templateService.listTemplates());
  const projects = computed(() => state.projects);
  const issues = computed(() => state.issues);
  const timeEntries = computed(() => state.timeEntries);
  const trash = computed(() => state.trash);
  const settings = computed(() => state.settings);
  const people = computed(() => projectService.people());

  const openIssues = computed(() => issues.value.filter((issue) => !isClosedStatus(issue.status)));
  const riskyIssues = computed(() => issues.value.filter(isIssueRisky));
  const agileProjects = computed(() => projects.value.filter((project) => project.templateId === "agile"));
  const waterfallProjects = computed(() => projects.value.filter((project) => project.templateId === "waterfall"));
  const averageHealth = computed(() => {
    if (!projects.value.length) return 0;
    const total = projects.value.reduce((sum, project) => sum + summarizeProject(project.id).health, 0);
    return Math.round(total / projects.value.length);
  });

  function getTemplate(templateId) {
    return templateService.getTemplate(templateId);
  }

  function getProject(projectId) {
    return projects.value.find((project) => project.id === projectId) || projects.value[0];
  }

  function getIssue(issueId) {
    return issues.value.find((issue) => issue.id === issueId) || null;
  }

  function getProjectIssues(projectId) {
    return issues.value.filter((issue) => issue.projectId === projectId);
  }

  function getIssueTimeEntries(issueId) {
    return timeEntries.value.filter((entry) => entry.issueId === issueId);
  }

  function getProjectTimeEntries(projectId) {
    return timeEntries.value.filter((entry) => entry.projectId === projectId);
  }

  function summarizeProject(projectId) {
    const project = getProject(projectId);
    return projectService.summarize(project, getProjectIssues(project.id));
  }

  function createProject(input) {
    const project = projectService.createProject(input);
    const seedIssues = issueService.createSeedIssues(project);
    state.projects.unshift(project);
    state.issues.unshift(...seedIssues);
    return project;
  }

  function updateProject(projectId, patch) {
    const index = state.projects.findIndex((project) => project.id === projectId);
    if (index < 0) return null;

    const project = projectService.updateProject(state.projects[index], patch);
    state.projects.splice(index, 1, project);
    return project;
  }

  function updateSettings(patch) {
    state.settings = {
      ...state.settings,
      ...patch,
      logoText: (patch.logoText || state.settings.logoText || "K").slice(0, 2),
    };
    return state.settings;
  }

  function deleteProject(projectId) {
    const index = state.projects.findIndex((project) => project.id === projectId);
    if (index < 0) return { ok: false, reason: "not-found" };

    const projectIssues = getProjectIssues(projectId);
    if (projectIssues.length) {
      return { ok: false, reason: "has-issues", count: projectIssues.length };
    }

    const [project] = state.projects.splice(index, 1);
    state.trash.unshift(createTrashItem("project", project));
    return { ok: true };
  }

  function createIssue(input, projectId) {
    const project = getProject(projectId);
    const issue = issueService.createIssue(input, project);
    state.issues.unshift(issue);
    return issue;
  }

  function updateIssue(issueId, patch) {
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) return null;

    const issue = issueService.updateIssue(state.issues[index], patch);
    state.issues.splice(index, 1, issue);
    return issue;
  }

  function deleteIssue(issueId) {
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) return null;

    const [issue] = state.issues.splice(index, 1);
    state.trash.unshift(createTrashItem("issue", issue));
    return issue;
  }

  function restoreTrashItem(trashId) {
    const index = state.trash.findIndex((item) => item.id === trashId);
    if (index < 0) return { ok: false, reason: "not-found" };

    const item = state.trash[index];
    if (!isTrashRestorable(item)) return { ok: false, reason: "expired" };

    if (item.type === "project") {
      if (state.projects.some((project) => project.id === item.entity.id)) return { ok: false, reason: "exists" };
      state.projects.unshift(projectService.updateProject(item.entity, {}));
    } else if (item.type === "issue") {
      if (!state.projects.some((project) => project.id === item.entity.projectId)) return { ok: false, reason: "missing-project" };
      if (state.issues.some((issue) => issue.id === item.entity.id)) return { ok: false, reason: "exists" };
      state.issues.unshift(issueService.updateIssue(item.entity, {}));
    }

    state.trash.splice(index, 1);
    return { ok: true, type: item.type, entity: item.entity };
  }

  function advanceIssue(issueId) {
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) return null;

    const issue = state.issues[index];
    const template = getTemplate(getProject(issue.projectId).templateId);
    const advanced = issueService.advanceIssue(issue, template);
    state.issues.splice(index, 1, advanced);
    return advanced;
  }

  function addIssueComment(issueId, text) {
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0 || !text?.trim()) return null;

    const issue = issueService.addComment(state.issues[index], text);
    state.issues.splice(index, 1, issue);
    return issue;
  }

  function addTimeEntry(issueId, input) {
    const issue = getIssue(issueId);
    if (!issue) return null;

    const project = getProject(issue.projectId);
    const entry = timeEntryService.create(input, issue, project);
    if (!entry.hours) return null;

    state.timeEntries.unshift(entry);
    updateIssue(issueId, {
      actualHours: (Number(issue.actualHours) || 0) + entry.hours,
    });
    return entry;
  }

  function createTimeEntry(input) {
    const issue = getIssue(input.issueId);
    if (!issue) return null;
    return addTimeEntry(issue.id, input);
  }

  function updateTimeEntry(entryId, patch) {
    const index = state.timeEntries.findIndex((entry) => entry.id === entryId);
    if (index < 0) return null;

    const previous = state.timeEntries[index];
    const updated = timeEntryService.update(previous, patch);
    state.timeEntries.splice(index, 1, updated);

    if (updated.issueId === previous.issueId) {
      const issue = getIssue(updated.issueId);
      if (issue && updated.hours !== previous.hours) {
        updateIssue(issue.id, {
          actualHours: Math.max(0, (Number(issue.actualHours) || 0) - previous.hours + updated.hours),
        });
      }
    } else {
      const previousIssue = getIssue(previous.issueId);
      const nextIssue = getIssue(updated.issueId);
      if (previousIssue) {
        updateIssue(previousIssue.id, {
          actualHours: Math.max(0, (Number(previousIssue.actualHours) || 0) - previous.hours),
        });
      }
      if (nextIssue) {
        updateIssue(nextIssue.id, {
          actualHours: (Number(nextIssue.actualHours) || 0) + updated.hours,
        });
      }
    }

    return updated;
  }

  function filterIssuesForView(projectId, viewName) {
    return issueService.filterForView(getProjectIssues(projectId), viewName);
  }

  return {
    state,
    templates,
    projects,
    issues,
    timeEntries,
    trash,
    settings,
    people,
    openIssues,
    riskyIssues,
    agileProjects,
    waterfallProjects,
    averageHealth,
    getTemplate,
    getProject,
    getIssue,
    getProjectIssues,
    getIssueTimeEntries,
    getProjectTimeEntries,
    summarizeProject,
    createProject,
    updateProject,
    updateSettings,
    deleteProject,
    createIssue,
    updateIssue,
    deleteIssue,
    restoreTrashItem,
    advanceIssue,
    addIssueComment,
    addTimeEntry,
    createTimeEntry,
    updateTimeEntry,
    filterIssuesForView,
  };
}
