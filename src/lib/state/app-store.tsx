import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppState, CostRecord, Issue, PlatformSettings, Preferences, Project, ProjectMember, TimeEntry, TrashItem, User } from "@/types/domain";
import { authApi } from "@/lib/api/auth";
import { costsApi } from "@/lib/api/costs";
import { downloadResponse, onUnauthorized } from "@/lib/api/client";
import { peopleApi } from "@/lib/api/people";
import { projectsApi } from "@/lib/api/projects";
import { settingsApi } from "@/lib/api/settings";
import { tasksApi } from "@/lib/api/tasks";
import { timesheetsApi } from "@/lib/api/timesheets";
import { trashApi } from "@/lib/api/trash";
import { apiErrorMessage } from "@/lib/api/errors";
import { isApiDataSource, storageKey } from "@/lib/env";
import { buildAccessContext, canCreateOwnTimeEntry, permissionsForProject } from "@/lib/permissions/policies";
import { queryKeys } from "@/lib/query/keys";
import { DEFAULT_PREFERENCES, DEMO_USERS, seedState } from "./seed";
import { getTemplateById, normalizeIssue } from "./calculations";

type AppStore = {
  state: AppState;
  currentUser: User | null;
  context: ReturnType<typeof buildAccessContext>;
  apiMode: boolean;
  initializing: boolean;
  authenticated: boolean;
  refresh: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (input: { name: string; avatarColor?: string }) => Promise<boolean>;
  updatePreferences: (input: Preferences) => Promise<boolean>;
  updatePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<boolean>;
  getProjectPermissions: (projectId: string) => ReturnType<typeof permissionsForProject>;
  createProject: (input: Partial<Project>) => Promise<Project | null>;
  updateProject: (projectId: string, patch: Partial<Project>) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  addProjectMember: (projectId: string, userId: string) => Promise<boolean>;
  removeProjectMember: (projectId: string, memberId: string) => Promise<boolean>;
  createIssue: (projectId: string, input: Partial<Issue>) => Promise<Issue | null>;
  updateIssue: (issueId: string, patch: Partial<Issue>) => Promise<Issue | null>;
  deleteIssue: (issueId: string) => Promise<boolean>;
  addIssueComment: (issueId: string, text: string) => Promise<boolean>;
  importSchedule: (projectId: string, text: string) => Promise<number>;
  createTimeEntry: (input: Partial<TimeEntry> & { submit?: boolean }) => Promise<TimeEntry | null>;
  updateTimeEntry: (entryId: string, patch: Partial<TimeEntry>) => Promise<TimeEntry | null>;
  submitTimeEntry: (entryId: string) => Promise<boolean>;
  approveTimeEntry: (entryId: string) => Promise<boolean>;
  rejectTimeEntry: (entryId: string, reason: string) => Promise<boolean>;
  deleteTimeEntry: (entryId: string) => Promise<boolean>;
  createCostRecord: (input: Partial<CostRecord>) => Promise<boolean>;
  updateCostRecord: (recordId: string, patch: Partial<CostRecord>) => Promise<boolean>;
  deleteCostRecord: (recordId: string) => Promise<boolean>;
  exportCostRecord: (recordId: string, filter?: Record<string, string | number>) => Promise<boolean>;
  restoreTrashItem: (item: TrashItem) => Promise<boolean>;
  createUser: (input: { name: string; email: string; role: string; initialPassword: string; confirmInitialPassword: string }) => Promise<boolean>;
  updateUser: (userId: string, patch: Partial<User>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  resetUserPassword: (userId: string, input: { newPassword: string; confirmNewPassword: string }) => Promise<boolean>;
  updateSettings: (patch: Partial<PlatformSettings>) => Promise<boolean>;
};

const AppStoreContext = React.createContext<AppStore | null>(null);
const LOCAL_STORAGE_KEY = storageKey("react-gridproject-state-v1");
const LOCAL_USER_KEY = storageKey("react-gridproject-user-v1");

export function AppProvider({ children }: { children: React.ReactNode }) {
  const apiMode = isApiDataSource();
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<AppState>(() => loadLocalState());
  const [currentUser, setCurrentUser] = React.useState<User | null>(() => (apiMode ? null : loadLocalUser()));
  const [authenticated, setAuthenticated] = React.useState(() => !apiMode && Boolean(loadLocalUser()));
  const [authRejected, setAuthRejected] = React.useState(false);
  const [bootstrapReady, setBootstrapReady] = React.useState(!apiMode);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: apiMode,
    retry: false,
  });

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: authApi.bootstrap,
    enabled: apiMode && Boolean(meQuery.data?.user),
    retry: false,
  });

  React.useEffect(() => {
    if (!apiMode) return;
    const unsubscribe = onUnauthorized(() => {
      setAuthenticated(false);
      setCurrentUser(null);
      setAuthRejected(true);
      setBootstrapReady(false);
    });
    return () => {
      unsubscribe();
    };
  }, [apiMode, queryClient]);

  React.useEffect(() => {
    if (!apiMode) return;
    if (meQuery.data?.user) {
      setCurrentUser(meQuery.data.user);
      setAuthenticated(true);
      setAuthRejected(false);
      if (meQuery.data.organization) {
        setState((previous) => ({ ...previous, organization: meQuery.data.organization }));
      }
    } else if (meQuery.isError) {
      setAuthenticated(false);
      setCurrentUser(null);
      setAuthRejected(true);
      setBootstrapReady(false);
    }
  }, [apiMode, meQuery.data, meQuery.isError]);

  React.useEffect(() => {
    if (!apiMode || !bootstrapQuery.data) return;
    const { currentUser: bootstrapUser, ...bootstrapState } = bootstrapQuery.data as Partial<AppState> & { currentUser?: User };
    setState(normalizeState(bootstrapState));
    if (bootstrapUser) setCurrentUser(bootstrapUser);
    setBootstrapReady(true);
  }, [apiMode, bootstrapQuery.data]);

  React.useEffect(() => {
    if (apiMode) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [apiMode, state]);

  const context = React.useMemo(() => buildAccessContext(currentUser, state.organization.id), [currentUser, state.organization.id]);
  const effectiveAuthenticated = apiMode ? !authRejected && Boolean(authenticated || currentUser || meQuery.data?.user) : authenticated;
  const bootstrapPending = effectiveAuthenticated && !bootstrapReady && !bootstrapQuery.isError;
  const initializing = apiMode && !authRejected && (
    meQuery.isLoading
    || Boolean(meQuery.data?.user && !currentUser)
    || bootstrapPending
    || (effectiveAuthenticated && bootstrapQuery.isLoading)
  );

  async function refresh() {
    if (!apiMode) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap }),
    ]);
  }

  async function run<T>(label: string, callback: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await callback();
      if (success) toast.success(success);
      return result;
    } catch (error) {
      toast.error(`${label}失败`, { description: apiErrorMessage(error) });
      return null;
    }
  }

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (payload) => {
      setAuthRejected(false);
      if (payload.user) {
        setCurrentUser(payload.user);
        setAuthenticated(true);
      }
      setBootstrapReady(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
      setAuthenticated(true);
    },
  });

  const store = React.useMemo<AppStore>(() => ({
    state,
    currentUser,
    context,
    apiMode,
    initializing,
    authenticated: effectiveAuthenticated,
    refresh,
    login: async (input) => {
      if (!apiMode) {
        const user = DEMO_USERS.find((item) => item.email.toLowerCase() === input.email.toLowerCase()) || DEMO_USERS.find((item) => item.id === "user-linxia") || DEMO_USERS[0];
        window.localStorage.setItem(LOCAL_USER_KEY, user.id);
        setCurrentUser(user);
        setAuthenticated(true);
        toast.success(`已进入本地演示账号：${user.name}`);
        return true;
      }
      const ok = await run("登录", () => loginMutation.mutateAsync(input));
      return Boolean(ok);
    },
    logout: async () => {
      if (apiMode) await authApi.logout().catch(() => null);
      if (!apiMode) window.localStorage.removeItem(LOCAL_USER_KEY);
      setAuthenticated(false);
      setCurrentUser(null);
      setAuthRejected(apiMode);
      setBootstrapReady(false);
      queryClient.clear();
      toast.success(apiMode ? "已退出登录" : "本地演示模式无需退出");
    },
    updateProfile: async (input) => {
      if (apiMode) {
        const payload = await run("保存个人资料", () => authApi.updateProfile(input), "个人资料已保存");
        if (!payload?.user) return false;
        setCurrentUser(payload.user);
        setState((previous) => upsertUser(previous, payload.user));
        return true;
      }
      setState((previous) => upsertUser(previous, { ...context.user!, name: input.name }));
      setCurrentUser((user) => user ? { ...user, name: input.name } : user);
      toast.success("个人资料已保存");
      return true;
    },
    updatePreferences: async (input) => {
      if (apiMode) {
        const payload = await run("保存偏好", () => authApi.updatePreferences(input), "偏好设置已保存");
        if (!payload?.user) return false;
        setCurrentUser(payload.user);
        setState((previous) => upsertUser(previous, payload.user));
        return true;
      }
      setCurrentUser((user) => user ? { ...user, preferences: input } : user);
      setState((previous) => upsertUser(previous, { ...context.user!, preferences: input }));
      toast.success("偏好设置已保存");
      return true;
    },
    updatePassword: async (input) => {
      if (!apiMode) {
        toast.error("本地演示模式不保存登录密码");
        return false;
      }
      return Boolean(await run("更新密码", () => authApi.updatePassword(input), "密码已更新，其他设备已退出登录"));
    },
    getProjectPermissions: (projectId) => permissionsForProject(context, state.projects.find((project) => project.id === projectId), state.projectMembers),
    createProject: async (input) => {
      if (apiMode) {
        const payload = await run("创建项目", () => projectsApi.create(projectPayload(input)), "项目已创建");
        if (!payload?.project) return null;
        setState((previous) => ({ ...previous, projects: [payload.project, ...previous.projects] }));
        await refresh();
        return payload.project;
      }
      const project = localProject(input, context.user!);
      setState((previous) => ({
        ...previous,
        projects: [project, ...previous.projects],
        projectMembers: [{ id: `pm-${project.id}-${project.ownerId}`, organizationId: project.organizationId, projectId: project.id, userId: project.ownerId, status: "ACTIVE" }, ...previous.projectMembers],
      }));
      toast.success("项目已创建");
      return project;
    },
    updateProject: async (projectId, patch) => {
      if (apiMode) {
        const payload = await run("保存项目", () => projectsApi.update(projectId, projectPayload(patch)), "项目已更新");
        if (!payload?.project) return null;
        setState((previous) => replaceById(previous, "projects", payload.project));
        return payload.project;
      }
      let updated: Project | null = null;
      setState((previous) => ({
        ...previous,
        projects: previous.projects.map((project) => {
          if (project.id !== projectId) return project;
          updated = { ...project, ...patch, updatedAt: new Date().toISOString() };
          return updated;
        }),
      }));
      toast.success("项目已更新");
      return updated;
    },
    deleteProject: async (projectId) => {
      if (state.issues.some((issue) => issue.projectId === projectId && !issue.deletedAt)) {
        toast.error("项目下还有任务，请先删除或迁移任务。");
        return false;
      }
      if (apiMode) {
        const payload = await run("删除项目", () => projectsApi.delete(projectId), "项目已移入回收站");
        if (!payload) return false;
      }
      setState((previous) => {
        const project = previous.projects.find((item) => item.id === projectId);
        return {
          ...previous,
          projects: previous.projects.filter((item) => item.id !== projectId),
          trash: project ? [trashItem("project", project), ...previous.trash] : previous.trash,
        };
      });
      return true;
    },
    addProjectMember: async (projectId, userId) => {
      if (apiMode) {
        const payload = await run("添加成员", () => projectsApi.members.create(projectId, { userId }), "成员已加入项目");
        if (!payload?.member) return false;
        setState((previous) => ({ ...previous, projectMembers: [payload.member, ...previous.projectMembers.filter((item) => item.id !== payload.member.id)] }));
        return true;
      }
      const member: ProjectMember = { id: `pm-${projectId}-${userId}`, organizationId: context.organizationId, projectId, userId, status: "ACTIVE", createdAt: new Date().toISOString() };
      setState((previous) => ({ ...previous, projectMembers: [member, ...previous.projectMembers.filter((item) => !(item.projectId === projectId && item.userId === userId))] }));
      toast.success("成员已加入项目");
      return true;
    },
    removeProjectMember: async (projectId, memberId) => {
      if (apiMode) {
        const payload = await run("移除成员", () => projectsApi.members.delete(projectId, memberId), "成员已移出项目");
        if (!payload?.member) return false;
      }
      setState((previous) => ({ ...previous, projectMembers: previous.projectMembers.map((member) => member.id === memberId ? { ...member, status: "INACTIVE" } : member) }));
      return true;
    },
    createIssue: async (projectId, input) => {
      if (apiMode) {
        const payload = await run("创建事项", () => projectsApi.issues.create(projectId, issuePayload(input)), "事项已创建");
        if (!payload?.issue) return null;
        setState((previous) => ({ ...previous, issues: [payload.issue, ...previous.issues] }));
        return payload.issue;
      }
      const issue = normalizeIssue({
        ...input,
        id: `issue-${Date.now()}`,
        code: `${getTemplateById(state.projects.find((project) => project.id === projectId)?.templateId).id === "agile" ? "AGL" : "WAT"}-${Math.floor(Math.random() * 700 + 200)}`,
        projectId,
        title: input.title || "未命名事项",
        creator: context.user?.name,
        creatorId: context.userId,
      });
      setState((previous) => ({ ...previous, issues: [issue, ...previous.issues] }));
      toast.success("事项已创建");
      return issue;
    },
    updateIssue: async (issueId, patch) => {
      if (apiMode) {
        const payload = await run("保存事项", () => tasksApi.update(issueId, issuePayload(patch)), "事项已保存");
        if (!payload?.issue) return null;
        setState((previous) => replaceById(previous, "issues", payload.issue));
        return payload.issue;
      }
      let updated: Issue | null = null;
      setState((previous) => ({ ...previous, issues: previous.issues.map((issue) => {
        if (issue.id !== issueId) return issue;
        updated = { ...issue, ...patch, updatedAt: new Date().toISOString(), activity: [{ id: `activity-${Date.now()}`, type: "updated", text: "更新事项信息", actor: context.user?.name, at: new Date().toISOString() }, ...(issue.activity || [])] };
        return updated;
      }) }));
      toast.success("事项已保存");
      return updated;
    },
    deleteIssue: async (issueId) => {
      if (apiMode) {
        const payload = await run("删除事项", () => tasksApi.delete(issueId), "事项已移入回收站");
        if (!payload) return false;
      }
      setState((previous) => {
        const issue = previous.issues.find((item) => item.id === issueId);
        return {
          ...previous,
          issues: previous.issues.filter((item) => item.id !== issueId),
          trash: issue ? [trashItem("issue", issue), ...previous.trash] : previous.trash,
        };
      });
      return true;
    },
    addIssueComment: async (issueId, text) => {
      if (!text.trim()) return false;
      if (apiMode) {
        const payload = await run("添加评论", () => tasksApi.comments.create(issueId, { text }), "评论已添加");
        if (!payload?.comment) return false;
      }
      setState((previous) => ({ ...previous, issues: previous.issues.map((issue) => issue.id === issueId ? { ...issue, comments: [{ id: `comment-${Date.now()}`, actor: context.user?.name, text, at: new Date().toISOString() }, ...(issue.comments || [])] } : issue) }));
      return true;
    },
    importSchedule: async (projectId, text) => {
      const rows = parseScheduleText(text, projectId, context.user);
      if (!rows.length) {
        toast.error("没有可导入的排期事项");
        return 0;
      }
      if (apiMode) {
        const imported: Issue[] = [];
        for (const row of rows) {
          const payload = await run("导入排期", () => projectsApi.issues.create(projectId, issuePayload(row)));
          if (payload?.issue) imported.push(payload.issue);
        }
        if (!imported.length) return 0;
        setState((previous) => ({ ...previous, issues: [...imported, ...previous.issues] }));
        toast.success(`已导入 ${imported.length} 个排期事项`);
        return imported.length;
      }
      const project = state.projects.find((item) => item.id === projectId);
      const prefix = getTemplateById(project?.templateId).id === "agile" ? "AGL" : "WAT";
      const imported = rows.map((row, index) => normalizeIssue({
        ...row,
        id: `issue-${Date.now()}-${index}`,
        code: `${prefix}-${Math.floor(Math.random() * 700 + 200)}`,
        projectId,
        title: row.title || `导入任务 ${index + 1}`,
        creator: context.user?.name,
        creatorId: context.userId,
      }));
      setState((previous) => ({ ...previous, issues: [...imported, ...previous.issues] }));
      toast.success(`已导入 ${imported.length} 个排期事项`);
      return imported.length;
    },
    createTimeEntry: async (input) => {
      const project = state.projects.find((item) => item.id === input.projectId);
      if (!canCreateOwnTimeEntry(context, project, state.projectMembers, context.userId)) {
        toast.error("只能为自己在已加入的项目填报工时");
        return null;
      }
      const payload = {
        projectId: input.projectId!,
        issueId: input.issueId || null,
        userId: context.userId,
        workDate: input.workDate || input.spentDate!,
        hours: Number(input.hours),
        description: input.description || input.note || "",
      };
      if (apiMode) {
        const result = await run("保存工时", () => timesheetsApi.create(payload), input.submit ? undefined : "工时草稿已保存");
        if (!result?.entry) return null;
        const finalEntry = input.submit ? await run("提交工时", () => timesheetsApi.submit(result.entry.id), "工时已提交") : result;
        if (!finalEntry?.entry) return result.entry;
        setState((previous) => ({ ...previous, timeEntries: [finalEntry.entry, ...previous.timeEntries.filter((entry) => entry.id !== finalEntry.entry.id)] }));
        return finalEntry.entry;
      }
      const entry: TimeEntry = {
        id: `time-${Date.now()}`,
        organizationId: context.organizationId,
        projectId: payload.projectId,
        issueId: payload.issueId,
        userId: context.userId,
        reporter: context.user?.name,
        workDate: payload.workDate,
        spentDate: payload.workDate,
        hours: payload.hours,
        note: payload.description,
        status: input.submit ? "SUBMITTED" : "DRAFT",
        createdAt: new Date().toISOString(),
      };
      setState((previous) => ({ ...previous, timeEntries: [entry, ...previous.timeEntries] }));
      toast.success(input.submit ? "工时已提交" : "工时草稿已保存");
      return entry;
    },
    updateTimeEntry: async (entryId, patch) => {
      if (apiMode) {
        const payload = await run("更新工时", () => timesheetsApi.update(entryId, patch), "工时已更新");
        if (!payload?.entry) return null;
        setState((previous) => replaceById(previous, "timeEntries", payload.entry));
        return payload.entry;
      }
      let updated: TimeEntry | null = null;
      setState((previous) => ({ ...previous, timeEntries: previous.timeEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        updated = { ...entry, ...patch, updatedAt: new Date().toISOString() };
        return updated;
      }) }));
      toast.success("工时已更新");
      return updated;
    },
    submitTimeEntry: async (entryId) => {
      if (apiMode) {
        const payload = await run("提交工时", () => timesheetsApi.submit(entryId), "工时已提交");
        if (!payload?.entry) return false;
        setState((previous) => replaceById(previous, "timeEntries", payload.entry));
        return true;
      }
      setState((previous) => ({ ...previous, timeEntries: previous.timeEntries.map((entry) => entry.id === entryId ? { ...entry, status: "SUBMITTED" } : entry) }));
      toast.success("工时已提交");
      return true;
    },
    approveTimeEntry: async (entryId) => {
      if (apiMode) {
        const payload = await run("审批工时", () => timesheetsApi.approve(entryId), "工时已审批");
        if (!payload?.entry) return false;
      }
      setState((previous) => ({ ...previous, timeEntries: previous.timeEntries.map((entry) => entry.id === entryId ? { ...entry, status: "APPROVED" } : entry) }));
      return true;
    },
    rejectTimeEntry: async (entryId, reason) => {
      if (apiMode) {
        const payload = await run("驳回工时", () => timesheetsApi.reject(entryId, reason), "工时已驳回");
        if (!payload?.entry) return false;
      }
      setState((previous) => ({ ...previous, timeEntries: previous.timeEntries.map((entry) => entry.id === entryId ? { ...entry, status: "REJECTED", correctionReason: reason } : entry) }));
      return true;
    },
    deleteTimeEntry: async (entryId) => {
      if (apiMode) {
        const payload = await run("删除工时", () => timesheetsApi.delete(entryId, "前端请求删除工时"), "工时已删除");
        if (!payload) return false;
      }
      setState((previous) => ({ ...previous, timeEntries: previous.timeEntries.filter((entry) => entry.id !== entryId) }));
      return true;
    },
    createCostRecord: async (input) => {
      if (apiMode) {
        const payload = await run("创建成本记录", () => costsApi.create(input), "成本记录已创建");
        if (!payload?.record) return false;
        setState((previous) => ({ ...previous, costRecords: [payload.record, ...previous.costRecords] }));
        return true;
      }
      const record: CostRecord = { id: `cost-${Date.now()}`, organizationId: context.organizationId, projectId: input.projectId!, plannedPersonDays: Number(input.plannedPersonDays || 0), standardHoursPerDay: Number(input.standardHoursPerDay || 8), notes: input.notes || "", status: "ACTIVE", createdById: context.userId, updatedById: context.userId };
      setState((previous) => ({ ...previous, costRecords: [record, ...previous.costRecords] }));
      toast.success("成本记录已创建");
      return true;
    },
    updateCostRecord: async (recordId, patch) => {
      if (apiMode) {
        const payload = await run("保存成本记录", () => costsApi.update(recordId, patch), "成本设置已保存");
        if (!payload?.record) return false;
        setState((previous) => replaceById(previous, "costRecords", payload.record));
        return true;
      }
      setState((previous) => ({ ...previous, costRecords: previous.costRecords.map((record) => record.id === recordId ? { ...record, ...patch, updatedAt: new Date().toISOString() } : record) }));
      toast.success("成本设置已保存");
      return true;
    },
    deleteCostRecord: async (recordId) => {
      if (apiMode) {
        const payload = await run("归档成本记录", () => costsApi.delete(recordId), "成本记录已归档");
        if (!payload?.record) return false;
      }
      setState((previous) => {
        const record = previous.costRecords.find((item) => item.id === recordId);
        return {
          ...previous,
          costRecords: previous.costRecords.map((item) => item.id === recordId ? { ...item, status: "ARCHIVED" } : item),
          trash: record ? [trashItem("costRecord", record), ...previous.trash] : previous.trash,
        };
      });
      return true;
    },
    exportCostRecord: async (recordId, filter = {}) => {
      if (apiMode) {
        const response = await run("导出成本", () => costsApi.export(recordId, filter));
        if (!response) return false;
        await downloadResponse(response);
      }
      toast.success("导出请求已完成");
      return true;
    },
    restoreTrashItem: async (item) => {
      if (apiMode) {
        const payload = await run("恢复记录", () => trashApi.restore(item.type, item.entityId || item.id), "记录已恢复");
        if (!payload) return false;
        await refresh();
        return true;
      }
      setState((previous) => restoreLocalTrash(previous, item));
      toast.success("记录已恢复");
      return true;
    },
    createUser: async (input) => {
      if (apiMode) {
        const payload = await run("创建人员", () => peopleApi.create(input), "人员已创建");
        if (!payload?.user) return false;
        setState((previous) => ({ ...previous, users: [payload.user, ...previous.users] }));
        return true;
      }
      const user: User = { id: `user-${Date.now()}`, organizationId: context.organizationId, name: input.name, email: input.email, role: input.role === "ADMIN" ? "ADMIN" : "MEMBER", status: "ACTIVE", preferences: DEFAULT_PREFERENCES };
      setState((previous) => ({ ...previous, users: [user, ...previous.users] }));
      toast.success("人员已创建");
      return true;
    },
    updateUser: async (userId, patch) => {
      if (apiMode) {
        const payload = await run("保存人员", () => peopleApi.update(userId, patch), "人员信息已保存");
        if (!payload?.user) return false;
        setState((previous) => replaceById(previous, "users", payload.user));
        return true;
      }
      setState((previous) => ({ ...previous, users: previous.users.map((user) => user.id === userId ? { ...user, ...patch, updatedAt: new Date().toISOString() } : user) }));
      toast.success("人员信息已保存");
      return true;
    },
    deleteUser: async (userId) => {
      const user = state.users.find((item) => item.id === userId);
      if (state.projects.some((project) => project.ownerId === userId && !project.deletedAt)) {
        toast.error("该用户仍是项目 Owner，请先转移所有负责项目。");
        return false;
      }
      if (apiMode) {
        const payload = await run("删除人员", () => peopleApi.delete(userId), "人员已停用");
        if (!payload?.user) return false;
      }
      setState((previous) => {
        const target = previous.users.find((item) => item.id === userId);
        return {
          ...previous,
          users: previous.users.map((item) => item.id === userId ? { ...item, status: "INACTIVE", deletedAt: new Date().toISOString(), deletedById: context.userId } : item),
          trash: target ? [trashItem("user", target), ...previous.trash] : previous.trash,
        };
      });
      if (user?.id === currentUser?.id) setAuthenticated(false);
      return true;
    },
    resetUserPassword: async (userId, input) => Boolean(await run("重置密码", () => peopleApi.resetPassword(userId, input), "密码已重置")),
    updateSettings: async (patch) => {
      const next = { platformName: patch.platformName || state.settings.platformName, logoText: (patch.logoText || state.settings.logoText || "G").slice(0, 2) };
      if (apiMode) {
        const payload = await run("保存平台设置", () => settingsApi.update(next), "平台设置已保存");
        if (!payload?.settings) return false;
        setState((previous) => ({ ...previous, settings: payload.settings }));
        return true;
      }
      setState((previous) => ({ ...previous, settings: next }));
      toast.success("平台设置已保存");
      return true;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, currentUser, context, apiMode, authenticated, authRejected, bootstrapReady, meQuery.data, meQuery.isLoading, bootstrapQuery.isError, bootstrapQuery.isLoading, queryClient]);

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const store = React.useContext(AppStoreContext);
  if (!store) throw new Error("useAppStore must be used within AppProvider");
  return store;
}

function loadLocalState(): AppState {
  const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return seedState;
  try {
    return normalizeState(JSON.parse(saved) as AppState);
  } catch {
    return seedState;
  }
}

function loadLocalUser(): User {
  const savedUserId = window.localStorage.getItem(LOCAL_USER_KEY);
  return DEMO_USERS.find((user) => user.id === savedUserId) || DEMO_USERS.find((user) => user.id === "user-linxia") || DEMO_USERS[0];
}

function normalizeState(input: Partial<AppState>): AppState {
  return {
    organization: input.organization || seedState.organization,
    settings: input.settings || seedState.settings,
    users: input.users || seedState.users,
    projects: input.projects || seedState.projects,
    projectMembers: input.projectMembers || seedState.projectMembers,
    issues: (input.issues || seedState.issues).map((issue) => normalizeIssue(issue)),
    timeEntries: input.timeEntries || seedState.timeEntries,
    costRecords: input.costRecords || seedState.costRecords,
    trash: input.trash || [],
  };
}

function replaceById<Key extends "projects" | "issues" | "timeEntries" | "costRecords" | "users">(state: AppState, key: Key, item: AppState[Key][number]): AppState {
  return {
    ...state,
    [key]: state[key].map((entry: { id: string }) => entry.id === item.id ? item : entry),
  } as AppState;
}

function upsertUser(state: AppState, user: User): AppState {
  return {
    ...state,
    users: state.users.map((item) => item.id === user.id ? user : item),
  };
}

function projectPayload(input: Partial<Project>) {
  return {
    name: input.name,
    code: input.code,
    templateId: input.templateId,
    ownerId: input.ownerId,
    status: input.status,
    description: input.description,
    executionTeams: input.executionTeams,
    startDate: input.startDate,
    dueDate: input.dueDate,
    testDate: input.testDate,
    acceptanceDate: input.acceptanceDate,
    releaseDate: input.releaseDate,
  };
}

function issuePayload(input: Partial<Issue>) {
  return {
    title: input.title,
    type: input.type,
    status: input.status,
    priority: input.priority,
    ownerId: input.ownerId || null,
    startDate: input.startDate,
    dueDate: input.dueDate,
    estimatedHours: input.estimatedHours,
    actualHours: input.actualHours,
    description: input.description,
    next: input.next,
    scheduleKey: input.scheduleKey,
    scheduleModel: input.scheduleModel,
    scheduleOwners: input.scheduleOwners,
    scheduleWorkdays: input.scheduleWorkdays,
    scheduleImportedAt: input.scheduleImportedAt,
    scheduleSource: input.scheduleSource,
  };
}

function localProject(input: Partial<Project>, user: User): Project {
  const id = `project-${Date.now()}`;
  const template = getTemplateById(input.templateId);
  return {
    id,
    organizationId: user.organizationId,
    name: input.name || "未命名项目",
    code: input.code || id.slice(-6).toUpperCase(),
    templateId: template.id,
    ownerId: input.ownerId || user.id,
    owner: input.owner,
    createdById: user.id,
    status: input.status || "规划中",
    executionTeams: input.executionTeams || [],
    startDate: input.startDate || "",
    dueDate: input.dueDate || "",
    testDate: input.testDate || "",
    acceptanceDate: input.acceptanceDate || "",
    releaseDate: input.releaseDate || "",
    milestones: template.milestones.map((milestone, index) => ({ id: `${id}-milestone-${index}`, name: milestone.name, title: milestone.name, window: milestone.window, focus: milestone.focus, status: index ? "未开始" : "进行中", dueDate: input.releaseDate })),
    health: 90,
    description: input.description || "暂无项目概述。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    deletedById: null,
  };
}

function parseScheduleText(text: string, projectId: string, user: User | null): Partial<Issue>[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line, index) => {
      const cells = line.split(/\t|,/).map((cell) => cell.trim());
      const [model, title, owner, startDate, dueDate] = cells.length >= 5 ? cells : ["Timeline", cells[0], user?.name || "", "", ""];
      return {
        title: title || `导入任务 ${index + 1}`,
        type: /验收|交付/.test(title) ? "交付物" : "任务",
        status: "未开始",
        priority: index === 0 ? "P1" : "P2",
        owner,
        startDate,
        dueDate,
        description: `从 Timeline 导入：${line}`,
        next: "确认排期并推进状态",
        scheduleKey: `${projectId}-${index}-${title}`,
        scheduleModel: model,
        scheduleOwners: owner ? [owner] : [],
        scheduleWorkdays: 1,
        scheduleImportedAt: new Date().toISOString(),
        scheduleSource: "gridtimeline",
      };
    });
}

function trashItem(type: TrashItem["type"], entity: { id: string }): TrashItem {
  return {
    id: `trash-${type}-${entity.id}-${Date.now()}`,
    type,
    entityId: entity.id,
    entity,
    deletedAt: new Date().toISOString(),
  };
}

function restoreLocalTrash(state: AppState, item: TrashItem): AppState {
  const entity = item.entity as { id?: string } | null | undefined;
  const entityId = item.entityId || entity?.id;
  const withoutItem = state.trash.filter((entry) => entry.id !== item.id);
  if (!entityId || !entity) return { ...state, trash: withoutItem };
  if (item.type === "project") {
    const project = { ...(entity as Project), deletedAt: null, deletedById: null };
    return { ...state, projects: upsertById(state.projects, project), trash: withoutItem };
  }
  if (item.type === "issue") {
    const issue = normalizeIssue({ ...(entity as Issue), deletedAt: null, deletedById: null });
    return { ...state, issues: upsertById(state.issues, issue), trash: withoutItem };
  }
  if (item.type === "costRecord") {
    const record = { ...(entity as CostRecord), status: "ACTIVE" as const, deletedAt: null, deletedById: null };
    return { ...state, costRecords: upsertById(state.costRecords, record), trash: withoutItem };
  }
  if (item.type === "user") {
    const user = { ...(entity as User), status: "ACTIVE" as const, deletedAt: null, deletedById: null };
    return { ...state, users: upsertById(state.users, user), trash: withoutItem };
  }
  return { ...state, trash: withoutItem };
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some((entry) => entry.id === item.id) ? items.map((entry) => entry.id === item.id ? item : entry) : [item, ...items];
}
