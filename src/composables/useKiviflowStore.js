import { computed, reactive, watch } from "vue";
import { projectService } from "../services/projectService.js";
import { issueService } from "../services/issueService.js";
import { templateService } from "../services/templateService.js";
import { stateService } from "../services/stateService.js";
import { timeEntryService } from "../services/timeEntryService.js";
import { costService } from "../services/costService.js";
import { getUserStats, userService } from "../services/userService.js";
import { apiClient, isApiDataSource } from "../services/apiClient.js";
import { apiStorageAdapter, hydrateStateFromApi } from "../storage/apiAdapter.js";
import { isClosedStatus } from "../domain/workflow.js";
import { createTrashItem, isTrashRestorable } from "../domain/trash.js";
import { buildAccessContext, userIdForName, userNameForId } from "../domain/access.js";
import { calculateProjectCost } from "../domain/cost.js";
import { ProjectAccessPolicy } from "../server/policies/projectAccessPolicy.js";

const apiMode = isApiDataSource();
const state = reactive(stateService.load(apiMode ? apiStorageAdapter : undefined));
const authState = reactive({
  initialized: !apiMode,
  authenticated: !apiMode,
  loading: apiMode,
  saving: false,
  error: "",
  user: null,
  organization: null,
});
const operationState = reactive({
  loading: false,
  saving: false,
  error: "",
});

if (apiMode && typeof window !== "undefined") {
  apiClient.onUnauthorized(() => markUnauthenticated());
  restoreSession();
}

watch(state, () => {
  if (!apiMode) stateService.save(state);
}, { deep: true });

async function restoreSession() {
  authState.loading = true;
  authState.error = "";
  try {
    const me = await apiClient.me();
    applyMe(me);
    await refreshApiState();
    authState.authenticated = true;
  } catch (error) {
    if (error.status === 401) markUnauthenticated();
    else authState.error = apiErrorMessage(error);
  } finally {
    authState.initialized = true;
    authState.loading = false;
  }
}

async function refreshApiState() {
  if (!apiMode || !authState.authenticated && !authState.user) return null;
  operationState.loading = true;
  try {
    const payload = await hydrateStateFromApi(state);
    if (payload?.currentUser) authState.user = payload.currentUser;
    const [costPayload, trashPayload] = await Promise.all([
      apiClient.costRecords.list().catch(() => null),
      apiClient.trash.list().catch(() => null),
    ]);
    if (costPayload?.rows) state.costRecords.splice(0, state.costRecords.length, ...costPayload.rows);
    if (trashPayload?.rows) state.trash.splice(0, state.trash.length, ...trashPayload.rows);
    return payload;
  } finally {
    operationState.loading = false;
  }
}

function applyMe(payload) {
  authState.user = payload.user;
  authState.organization = payload.organization;
  if (payload.organization) Object.assign(state.organization, payload.organization);
}

function markUnauthenticated() {
  authState.authenticated = false;
  authState.user = null;
  authState.organization = null;
  authState.initialized = true;
  authState.loading = false;
}

async function withApiSave(callback) {
  if (operationState.saving) return { ok: false, reason: "saving", message: "正在保存，请勿重复提交。" };
  operationState.saving = true;
  operationState.error = "";
  try {
    return await callback();
  } catch (error) {
    const result = apiResult(error);
    operationState.error = result.message;
    return result;
  } finally {
    operationState.saving = false;
  }
}

function apiResult(error) {
  return {
    ok: false,
    status: error.status || 0,
    reason: error.payload?.error?.code || "api-error",
    message: apiErrorMessage(error),
    details: error.payload?.error?.details,
  };
}

function apiErrorMessage(error) {
  if (error?.status === 401) return "登录已失效，请重新登录。";
  if (error?.status === 403) return "没有权限执行该操作。";
  if (error?.status === 404) return "资源不存在或不可见。";
  if (error?.status === 409) return error.payload?.error?.message || "数据冲突，请刷新后重试。";
  if (error?.status === 422) return error.payload?.error?.message || "提交数据未通过校验。";
  return error?.payload?.error?.message || error?.message || "API 请求失败。";
}

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
  const people = computed(() => apiMode ? users.value.filter((user) => user.status !== "INACTIVE").map((user) => user.name) : projectService.people());
  const currentUser = computed(() => apiMode ? authState.user : localDemoUser(users.value));
  const currentContext = computed(() => {
    if (!currentUser.value) {
      return {
        organizationId: state.organization.id,
        user: null,
        userId: "",
        isAdmin: false,
        isActiveUser: false,
      };
    }
    return buildAccessContext(currentUser.value, state.organization.id);
  });

  const openIssues = computed(() => issues.value.filter((issue) => !isClosedStatus(issue.status)));
  const agileProjects = computed(() => projects.value.filter((project) => project.templateId === "agile"));
  const waterfallProjects = computed(() => projects.value.filter((project) => project.templateId === "waterfall"));
  const averageHealth = computed(() => {
    if (!projects.value.length) return 0;
    const total = projects.value.reduce((sum, project) => sum + summarizeProject(project.id).health, 0);
    return Math.round(total / projects.value.length);
  });

  async function login(input) {
    if (!apiMode) return { ok: true };
    authState.saving = true;
    authState.error = "";
    try {
      await apiClient.login(input);
      const me = await apiClient.me();
      applyMe(me);
      authState.authenticated = true;
      authState.initialized = true;
      await refreshApiState();
      return { ok: true, user: authState.user };
    } catch (error) {
      const result = apiResult(error);
      authState.error = result.message;
      return result;
    } finally {
      authState.saving = false;
    }
  }

  async function logout() {
    if (!apiMode) return { ok: true };
    await apiClient.logout().catch(() => null);
    markUnauthenticated();
    return { ok: true };
  }

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

  async function loadProjectBoard(projectId) {
    if (!apiMode) return null;
    const payload = await apiClient.projects.board(projectId);
    const projectPayload = {
      ...payload.project,
      milestones: payload.milestones || payload.project?.milestones || [],
    };
    upsertById(state.projects, projectPayload);
    replaceProjectScoped(state.issues, projectId, payload.issues);
    replaceProjectScoped(state.timeEntries, projectId, payload.timeEntries);
    replaceProjectScoped(state.projectMembers, projectId, payload.members);
    replaceProjectMilestones(projectId, projectPayload.milestones);
    if (payload.costRecord) upsertById(state.costRecords, payload.costRecord);
    return payload;
  }

  function summarizeProject(projectId) {
    const project = getProject(projectId);
    return projectService.summarize(project, getProjectIssues(project.id));
  }

  function createProject(input) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.projects.create(projectPayload(input, users.value, currentUser.value));
        upsertById(state.projects, payload.project, true);
        await loadProjectBoard(payload.project.id).catch(() => null);
        return payload.project;
      });
    }
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
    const seedIssues = input.skipSeedIssues ? [] : issueService.createSeedIssues(project);
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
    if (apiMode) {
      return withApiSave(async () => {
        const { milestones, ...projectPatch } = patch;
        let projectPayload = null;
        if (Object.keys(projectPatch).length) {
          const payload = await apiClient.projects.update(projectId, projectPayload(projectPatch, users.value, currentUser.value));
          projectPayload = {
            ...payload.project,
            milestones: payload.project.milestones || getProject(projectId)?.milestones || [],
          };
          upsertById(state.projects, projectPayload);
        }
        if (Array.isArray(milestones)) {
          const currentProject = getProject(projectId);
          const currentMilestones = currentProject?.milestones || [];
          for (const milestone of milestones) {
            const previous = currentMilestones.find((item) => item.id === milestone.id);
            if (!milestone.id || !previous || !milestoneChanged(previous, milestone)) continue;
            const payload = await apiClient.milestones.update(milestone.id, milestonePatchPayload(milestone));
            replaceMilestone(projectId, payload.milestone);
          }
          await loadProjectBoard(projectId).catch(() => null);
        }
        return projectPayload || getProject(projectId);
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.settings.update({
          ...patch,
          logoText: (patch.logoText || state.settings.logoText || "G").slice(0, 2),
        });
        state.settings = payload.settings;
        return payload.settings;
      });
    }
    state.settings = {
      ...state.settings,
      ...patch,
      logoText: (patch.logoText || state.settings.logoText || "K").slice(0, 2),
    };
    return state.settings;
  }

  function deleteProject(projectId) {
    if (apiMode) {
      return withApiSave(async () => {
        await apiClient.projects.delete(projectId);
        removeById(state.projects, projectId);
        await refreshTrash().catch(() => null);
        return { ok: true };
      });
    }
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

  function addProjectMember(projectId, input) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.projectMembers.create(projectId, input);
        upsertById(state.projectMembers, payload.member, true);
        return { ok: true, member: payload.member };
      });
    }
    ensureProjectMember(projectId, input.userId);
    return { ok: true, member: state.projectMembers[0] };
  }

  function updateProjectMember(projectId, memberId, patch) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.projectMembers.update(projectId, memberId, patch);
        upsertById(state.projectMembers, payload.member);
        return { ok: true, member: payload.member };
      });
    }
    const index = state.projectMembers.findIndex((member) => member.id === memberId && member.projectId === projectId);
    if (index < 0) return { ok: false, reason: "not-found" };
    state.projectMembers.splice(index, 1, { ...state.projectMembers[index], ...patch });
    return { ok: true, member: state.projectMembers[index] };
  }

  function removeProjectMember(projectId, memberId) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.projectMembers.delete(projectId, memberId);
        upsertById(state.projectMembers, payload.member);
        return { ok: true, member: payload.member };
      });
    }
    return updateProjectMember(projectId, memberId, { status: "INACTIVE" });
  }

  function createIssue(input, projectId) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.issues.create(projectId, issuePayload(input, users.value, currentUser.value));
        upsertById(state.issues, payload.issue, true);
        return payload.issue;
      });
    }
    const project = getProject(projectId);
    const issue = issueService.createIssue(input, project);
    state.issues.unshift(issue);
    return issue;
  }

  function importProjectSchedule(projectId, source, options = {}) {
    const project = getProject(projectId);
    const result = issueService.importSchedule(source, project, getProjectIssues(project.id), options);

    if (apiMode) {
      return withApiSave(async () => {
        const created = [];
        const updated = [];
        for (const issue of result.removed) {
          await apiClient.issues.delete(issue.id);
          removeById(state.issues, issue.id);
        }
        for (const issue of result.updated) {
          const payload = await apiClient.issues.update(issue.id, issuePayload(issue, users.value, currentUser.value));
          upsertById(state.issues, payload.issue);
          updated.push(payload.issue);
        }
        for (const issue of result.created) {
          const payload = await apiClient.issues.create(projectId, issuePayload(issue, users.value, currentUser.value));
          upsertById(state.issues, payload.issue, true);
          created.push(payload.issue);
        }
        return { ...result, created, updated };
      });
    }

    result.updated.forEach((issue) => {
      const index = state.issues.findIndex((item) => item.id === issue.id);
      if (index >= 0) state.issues.splice(index, 1, issue);
    });
    result.removed.forEach((issue) => removeById(state.issues, issue.id));
    state.issues.unshift(...result.created);

    return result;
  }

  function updateIssue(issueId, patch) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.issues.update(issueId, issuePayload(patch, users.value, currentUser.value));
        upsertById(state.issues, payload.issue);
        return payload.issue;
      });
    }
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) return null;

    const issue = issueService.updateIssue(state.issues[index], patch);
    state.issues.splice(index, 1, issue);
    return issue;
  }

  function deleteIssue(issueId) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.issues.delete(issueId);
        removeById(state.issues, issueId);
        await refreshTrash().catch(() => null);
        return payload.issue;
      });
    }
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

    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.trash.restore(item.type, item.entityId || item.entity?.id);
        applyRestoredEntity(payload.type, payload.entity);
        removeById(state.trash, item.id);
        return { ok: true, type: payload.type, entity: payload.entity };
      });
    }

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
    if (apiMode) {
      const issue = getIssue(issueId);
      if (!issue) return null;
      const template = getTemplate(getProject(issue.projectId).templateId);
      const nextStatus = issueService.advanceIssue(issue, template).status;
      if (nextStatus === issue.status) return issue;
      return updateIssue(issueId, { status: nextStatus });
    }
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) return null;

    const issue = state.issues[index];
    const template = getTemplate(getProject(issue.projectId).templateId);
    const advanced = issueService.advanceIssue(issue, template);
    state.issues.splice(index, 1, advanced);
    return advanced;
  }

  function addIssueComment(issueId, text) {
    if (apiMode) {
      if (!text?.trim()) return null;
      return withApiSave(async () => {
        const payload = await apiClient.issueComments.create(issueId, { text: text.trim() });
        const detail = await apiClient.issues.detail(issueId).catch(() => null);
        if (detail?.issue) upsertById(state.issues, detail.issue);
        return payload.comment;
      });
    }
    const index = state.issues.findIndex((issue) => issue.id === issueId);
    if (index < 0 || !text?.trim()) return null;

    const issue = issueService.addComment(state.issues[index], text);
    state.issues.splice(index, 1, issue);
    return issue;
  }

  function addTimeEntry(issueId, input) {
    if (apiMode) {
      return createTimeEntry({ ...input, issueId });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.timeEntries.create(timeEntryPayload(input, users.value, currentUser.value));
        upsertById(state.timeEntries, payload.entry, true);
        return payload.entry;
      });
    }
    const issue = getIssue(input.issueId);
    if (!issue) return null;
    return addTimeEntry(issue.id, input);
  }

  function updateTimeEntry(entryId, patch) {
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.timeEntries.update(entryId, timeEntryPatchPayload(patch));
        upsertById(state.timeEntries, payload.entry);
        return payload.entry;
      });
    }
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

  function deleteTimeEntry(entryId, correctionReason = "") {
    if (!apiMode) return { ok: false, reason: "not-supported", message: "本地模式暂不支持删除工时。" };
    return withApiSave(async () => {
      await apiClient.timeEntries.delete(entryId, correctionReason ? { correctionReason } : undefined);
      removeById(state.timeEntries, entryId);
      return { ok: true };
    });
  }

  function submitTimeEntry(entryId) {
    if (!apiMode) return { ok: false, reason: "not-supported", message: "本地模式暂不支持提交审批。" };
    return withApiSave(async () => {
      const payload = await apiClient.timeEntries.submit(entryId);
      upsertById(state.timeEntries, payload.entry);
      return { ok: true, entry: payload.entry };
    });
  }

  function approveTimeEntry(entryId) {
    if (!apiMode) return { ok: false, reason: "not-supported", message: "本地模式暂不支持审批。" };
    return withApiSave(async () => {
      const payload = await apiClient.timeEntries.approve(entryId);
      upsertById(state.timeEntries, payload.entry);
      return { ok: true, entry: payload.entry };
    });
  }

  function rejectTimeEntry(entryId, correctionReason = "") {
    if (!apiMode) return { ok: false, reason: "not-supported", message: "本地模式暂不支持驳回。" };
    return withApiSave(async () => {
      const payload = await apiClient.timeEntries.reject(entryId, correctionReason);
      upsertById(state.timeEntries, payload.entry);
      return { ok: true, entry: payload.entry };
    });
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.costRecords.create(input);
        upsertById(state.costRecords, payload.record, true);
        return { ok: true, record: payload.record };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.costRecords.update(recordId, patch);
        upsertById(state.costRecords, payload.record);
        return { ok: true, record: payload.record };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.costRecords.delete(recordId);
        upsertById(state.costRecords, payload.record);
        await refreshTrash().catch(() => null);
        return { ok: true, record: payload.record };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const query = queryString(filter);
        const response = await apiClient.costRecords.export(recordId, query);
        await downloadResponse(response);
        return { ok: true, response };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.users.create(input);
        upsertById(state.users, payload.user, true);
        return { ok: true, user: payload.user };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.users.update(userId, patch);
        upsertById(state.users, payload.user);
        if (authState.user?.id === payload.user.id && payload.user.status !== "ACTIVE") markUnauthenticated();
        return { ok: true, user: payload.user };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.users.delete(userId);
        upsertById(state.users, payload.user);
        await refreshTrash().catch(() => null);
        if (authState.user?.id === payload.user.id) markUnauthenticated();
        return { ok: true, user: payload.user };
      });
    }
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
    if (apiMode) {
      return withApiSave(async () => {
        const payload = await apiClient.users.resetPassword(userId, input);
        upsertById(state.users, payload.user);
        if (authState.user?.id === payload.user.id) markUnauthenticated();
        return { ok: true, user: payload.user };
      });
    }
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
    auth: authState,
    operation: operationState,
    apiMode,
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
    loadProjectBoard,
    summarizeProject,
    login,
    logout,
    restoreSession,
    refreshApiState,
    createProject,
    updateProject,
    updateSettings,
    deleteProject,
    addProjectMember,
    updateProjectMember,
    removeProjectMember,
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
    deleteTimeEntry,
    submitTimeEntry,
    approveTimeEntry,
    rejectTimeEntry,
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

function localDemoUser(users) {
  return users.find((user) => user.id === "user-linxia") || users.find((user) => user.status === "ACTIVE" && user.role !== "ADMIN") || users[0] || null;
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

function upsertById(list, item, prepend = false) {
  if (!item?.id) return;
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index >= 0) list.splice(index, 1, item);
  else if (prepend) list.unshift(item);
  else list.push(item);
}

function removeById(list, id) {
  const index = list.findIndex((entry) => entry.id === id);
  if (index >= 0) list.splice(index, 1);
}

function replaceProjectScoped(list, projectId, rows = []) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].projectId === projectId) list.splice(index, 1);
  }
  list.unshift(...rows);
}

async function refreshTrash() {
  if (!apiMode) return null;
  const payload = await apiClient.trash.list();
  state.trash.splice(0, state.trash.length, ...(payload.rows || []));
  return payload;
}

function replaceProjectMilestones(projectId, milestones = []) {
  const project = state.projects.find((item) => item.id === projectId);
  if (project) project.milestones = milestones;
}

function replaceMilestone(projectId, milestone) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || !milestone?.id) return;
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const index = milestones.findIndex((item) => item.id === milestone.id);
  if (index >= 0) milestones.splice(index, 1, milestone);
  else milestones.push(milestone);
  project.milestones = milestones;
}

function milestoneChanged(previous, next) {
  return ["name", "title", "window", "focus", "status", "dueDate", "completedAt"].some((key) => String(previous?.[key] ?? "") !== String(next?.[key] ?? ""));
}

function milestonePatchPayload(milestone) {
  return {
    name: milestone.name || milestone.title,
    window: milestone.window || "",
    focus: milestone.focus || "",
    status: milestone.status,
    dueDate: milestone.dueDate || null,
    ...(milestone.completedAt !== undefined ? { completedAt: milestone.completedAt } : {}),
  };
}

function issuePayload(input = {}, users = [], currentUser = null) {
  const payload = {};
  const copyIfPresent = [
    "code", "title", "type", "status", "priority", "startDate", "dueDate", "description", "next",
    "scheduleKey", "scheduleModel", "scheduleOwners", "scheduleWorkdays", "scheduleImportedAt", "scheduleSource",
  ];
  copyIfPresent.forEach((key) => {
    if (input[key] !== undefined) payload[key] = input[key];
  });

  ["estimatedHours", "actualHours"].forEach((key) => {
    if (input[key] === undefined) return;
    payload[key] = input[key] === "" || input[key] === null ? null : Number(input[key]);
  });

  if (input.ownerId !== undefined) payload.ownerId = input.ownerId || null;
  else if (input.owner !== undefined) payload.ownerId = userIdForName(users, input.owner) || currentUser?.id || null;

  return payload;
}

function projectPayload(input = {}, users = [], currentUser = null) {
  const payload = {};
  const copyIfPresent = [
    "name", "code", "templateId", "description", "status", "health", "executionTeams",
    "startDate", "dueDate", "testDate", "acceptanceDate", "releaseDate",
  ];
  copyIfPresent.forEach((key) => {
    if (input[key] !== undefined) payload[key] = input[key];
  });
  if (input.ownerId !== undefined) payload.ownerId = input.ownerId || currentUser?.id;
  else if (input.owner !== undefined) payload.ownerId = userIdForName(users, input.owner) || currentUser?.id;
  return payload;
}

function applyRestoredEntity(type, entity) {
  if (!entity) return;
  if (type === "project") upsertById(state.projects, entity, true);
  else if (type === "issue") upsertById(state.issues, entity, true);
  else if (type === "costRecord") upsertById(state.costRecords, entity, true);
  else if (type === "user") upsertById(state.users, entity, true);
  else if (type === "milestone") replaceMilestone(entity.projectId, entity);
}

function timeEntryPayload(input, users, currentUser) {
  const reporterUserId = input.userId || userIdForName(users, input.reporter) || currentUser?.id;
  return {
    projectId: input.projectId,
    issueId: input.issueId,
    userId: reporterUserId,
    workDate: input.workDate || input.spentDate,
    hours: Number(input.hours),
    description: input.note || input.description || "",
  };
}

function timeEntryPatchPayload(patch) {
  return {
    ...(patch.issueId !== undefined ? { issueId: patch.issueId } : {}),
    ...(patch.workDate !== undefined || patch.spentDate !== undefined ? { workDate: patch.workDate || patch.spentDate } : {}),
    ...(patch.hours !== undefined ? { hours: Number(patch.hours) } : {}),
    ...(patch.note !== undefined || patch.description !== undefined ? { description: patch.note || patch.description || "" } : {}),
    ...(patch.correctionReason !== undefined ? { correctionReason: patch.correctionReason } : {}),
  };
}

function queryString(filter = {}) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function downloadResponse(response) {
  if (typeof window === "undefined" || !response?.blob) return;
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const fileName = encoded ? decodeURIComponent(encoded) : "gridproject-export.xlsx";
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
