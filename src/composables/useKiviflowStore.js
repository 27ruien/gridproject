import { computed, reactive, watch } from "vue";
import { projectService } from "../services/projectService.js";
import { issueService } from "../services/issueService.js";
import { templateService } from "../services/templateService.js";
import { stateService } from "../services/stateService.js";
import { timeEntryService } from "../services/timeEntryService.js";
import { costService } from "../services/costService.js";
import { getUserStats, userService } from "../services/userService.js";
import { isClosedStatus } from "../domain/workflow.js";
import { createTrashItem, isTrashRestorable } from "../domain/trash.js";
import { buildAccessContext, userIdForName, userNameForId } from "../domain/access.js";
import { calculateProjectCost } from "../domain/cost.js";
import { ProjectAccessPolicy } from "../server/policies/projectAccessPolicy.js";

const state = reactive(stateService.load());

watch(state, () => stateService.save(state), { deep: true });

export function useKiviflowStore() {
  const templates = computed(() => templateService.listTemplates());
  const projects = computed(() => state.projects);
  const issues = computed(() => state.issues);
  const timeEntries = computed(() => state.timeEntries);
  const users = computed(() => state.users);
  const projectMembers = computed(() => state.projectMembers);
  const costRecords = computed(() => state.costRecords);
  const sessions = computed(() => state.sessions);
  const auditLogs = computed(() => state.auditLogs);
  const trash = computed(() => state.trash);
  const settings = computed(() => state.settings);
  const people = computed(() => projectService.people());
  const currentUser = computed(() => users.value.find((user) => user.id === "user-admin") || users.value[0]);
  const currentContext = computed(() => buildAccessContext(currentUser.value, state.organization.id));

  const openIssues = computed(() => issues.value.filter((issue) => !isClosedStatus(issue.status)));
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

  function getProjectPermissions(projectId) {
    return ProjectAccessPolicy.permissionsForProject(currentContext.value, getProject(projectId), projectMembers.value);
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
    const ownerId = input.ownerId || userIdForName(users.value, input.owner) || currentUser.value.id;
    const project = {
      ...projectService.createProject({ ...input, owner: userNameForId(users.value, ownerId) }),
      organizationId: state.organization.id,
      code: input.code || `P${Date.now().toString().slice(-5)}`,
      ownerId,
      createdById: currentUser.value.id,
      deletedAt: null,
      deletedById: null,
    };
    const seedIssues = issueService.createSeedIssues(project);
    state.projects.unshift(project);
    state.projectMembers.unshift({
      id: `pm-${project.id}-${ownerId}`,
      organizationId: state.organization.id,
      projectId: project.id,
      userId: ownerId,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
    state.auditLogs.unshift(createAuditLog("project.create", "Project", project.id, { ownerId }));
    state.issues.unshift(...seedIssues);
    return project;
  }

  function updateProject(projectId, patch) {
    const index = state.projects.findIndex((project) => project.id === projectId);
    if (index < 0) return null;

    const nextPatch = { ...patch };
    if (patch.owner) nextPatch.ownerId = userIdForName(users.value, patch.owner) || state.projects[index].ownerId;
    const project = projectService.updateProject(state.projects[index], nextPatch);
    state.projects.splice(index, 1, project);
    if (nextPatch.ownerId) ensureProjectMember(project.id, nextPatch.ownerId);
    state.auditLogs.unshift(createAuditLog("project.update", "Project", project.id, patch));
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

  function importProjectSchedule(projectId, text, options = {}) {
    const project = getProject(projectId);
    const result = issueService.importSchedule(text, project, getProjectIssues(project.id), options);

    result.updated.forEach((issue) => {
      const index = state.issues.findIndex((item) => item.id === issue.id);
      if (index >= 0) state.issues.splice(index, 1, issue);
    });
    state.issues.unshift(...result.created);

    return result;
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
    entry.organizationId = state.organization.id;
    entry.userId = userIdForName(users.value, entry.reporter) || currentUser.value.id;
    entry.workDate = entry.spentDate;

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

  function listCostRecords(options = {}) {
    return costService.listCostRecords({
      context: currentContext.value,
      projects: projects.value,
      users: users.value,
      records: costRecords.value,
      timeEntries: timeEntries.value,
      issues: issues.value,
      ...options,
    });
  }

  function getCostRecord(recordId) {
    return costRecords.value.find((record) => record.id === recordId && !record.deletedAt) || null;
  }

  function getProjectCostRecord(projectId) {
    return costRecords.value.find((record) => record.projectId === projectId && record.status === "ACTIVE" && !record.deletedAt) || null;
  }

  function getCostSummary(recordId, filter = {}) {
    const record = getCostRecord(recordId);
    if (!record) return null;
    const project = getProject(record.projectId);
    return calculateProjectCost({
      project,
      record,
      timeEntries: timeEntries.value,
      issues: issues.value,
      users: users.value,
      filter,
    });
  }

  function createCostRecord(input) {
    const project = getProject(input.projectId);
    const result = costService.createCostRecord({
      context: currentContext.value,
      input,
      project,
      records: costRecords.value,
    });
    if (!result.ok) return result;
    state.costRecords.unshift(result.record);
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  function updateCostRecord(recordId, patch) {
    const index = state.costRecords.findIndex((record) => record.id === recordId);
    if (index < 0) return { ok: false, reason: "not-found" };
    const record = state.costRecords[index];
    const project = getProject(record.projectId);
    const result = costService.updateCostRecord({
      context: currentContext.value,
      record,
      project,
      patch,
    });
    if (!result.ok) return result;
    state.costRecords.splice(index, 1, result.record);
    state.auditLogs.unshift(...result.auditLogs);
    return result;
  }

  function deleteCostRecord(recordId) {
    const index = state.costRecords.findIndex((record) => record.id === recordId);
    if (index < 0) return { ok: false, reason: "not-found" };
    const record = state.costRecords[index];
    const project = getProject(record.projectId);
    const result = costService.deleteCostRecord({ context: currentContext.value, record, project });
    if (!result.ok) return result;
    state.costRecords.splice(index, 1, result.record);
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  function recordCostExport(recordId, filter = {}) {
    const summary = getCostSummary(recordId, filter);
    if (!summary) return { ok: false, reason: "not-found" };
    state.auditLogs.unshift(createAuditLog("cost_record.export", "ProjectCostRecord", recordId, filter));
    return { ok: true, summary };
  }

  function filterIssuesForView(projectId, viewName) {
    return issueService.filterForView(getProjectIssues(projectId), viewName);
  }

  function listUsers(options = {}) {
    return userService.listUsers({
      context: currentContext.value,
      users: users.value,
      projects: projects.value,
      projectMembers: projectMembers.value,
      timeEntries: timeEntries.value,
      ...options,
    });
  }

  function getUserDetail(userId) {
    const user = users.value.find((item) => item.id === userId) || null;
    if (!user) return null;
    return {
      ...user,
      passwordHash: undefined,
      stats: getUserStats(user.id, {
        projects: projects.value,
        projectMembers: projectMembers.value,
        timeEntries: timeEntries.value,
      }),
    };
  }

  async function createUser(input) {
    const result = await userService.createUser({
      context: currentContext.value,
      input,
      users: users.value,
    });
    if (!result.ok) return result;
    state.users.unshift(result.persistedUser);
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  function updateUser(userId, patch) {
    const index = state.users.findIndex((user) => user.id === userId);
    if (index < 0) return { ok: false, reason: "not-found", message: "人员不存在。" };
    const result = userService.updateUser({
      context: currentContext.value,
      user: state.users[index],
      patch,
      users: users.value,
      projects: projects.value,
    });
    if (!result.ok) return result;
    state.users.splice(index, 1, result.persistedUser);
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  function deleteUser(userId) {
    const index = state.users.findIndex((user) => user.id === userId);
    if (index < 0) return { ok: false, reason: "not-found", message: "人员不存在。" };
    const result = userService.deleteUser({
      context: currentContext.value,
      user: state.users[index],
      users: users.value,
      projects: projects.value,
    });
    if (!result.ok) return result;
    state.users.splice(index, 1, result.persistedUser);
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  async function resetUserPassword(userId, input) {
    const index = state.users.findIndex((user) => user.id === userId);
    if (index < 0) return { ok: false, reason: "not-found", message: "人员不存在。" };
    const result = await userService.resetPassword({
      context: currentContext.value,
      user: state.users[index],
      input,
      sessions: sessions.value,
    });
    if (!result.ok) return result;
    state.users.splice(index, 1, result.persistedUser);
    state.sessions = result.sessions;
    state.auditLogs.unshift(result.auditLog);
    return result;
  }

  return {
    state,
    templates,
    projects,
    issues,
    timeEntries,
    users,
    projectMembers,
    costRecords,
    sessions,
    auditLogs,
    trash,
    settings,
    currentUser,
    currentContext,
    people,
    openIssues,
    agileProjects,
    waterfallProjects,
    averageHealth,
    getTemplate,
    getProject,
    getProjectPermissions,
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
    importProjectSchedule,
    updateIssue,
    deleteIssue,
    restoreTrashItem,
    advanceIssue,
    addIssueComment,
    addTimeEntry,
    createTimeEntry,
    updateTimeEntry,
    listCostRecords,
    getCostRecord,
    getProjectCostRecord,
    getCostSummary,
    createCostRecord,
    updateCostRecord,
    deleteCostRecord,
    recordCostExport,
    filterIssuesForView,
    listUsers,
    getUserDetail,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword,
  };
}

function createAuditLog(action, entityType, entityId, data) {
  return {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: state.organization.id,
    actorId: state.users.find((user) => user.id === "user-admin")?.id || "user-admin",
    action,
    entityType,
    entityId,
    data,
    createdAt: new Date().toISOString(),
  };
}

function ensureProjectMember(projectId, userId) {
  if (state.projectMembers.some((member) => member.projectId === projectId && member.userId === userId && member.status === "ACTIVE")) return;
  state.projectMembers.unshift({
    id: `pm-${projectId}-${userId}`,
    organizationId: state.organization.id,
    projectId,
    userId,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
}
