<template>
  <section class="view-stack timesheet-list-view cost-time-workspace">
    <header class="timesheet-page-header">
      <div>
        <h1>工时列表</h1>
        <p>查看完整工时明细，按时间、项目、人员、状态和事项关联筛选。</p>
      </div>
      <Button variant="ghost" size="small" @click="emit('open-fill')">返回填报</Button>
    </header>

    <section class="timesheet-list-filters" aria-label="工时列表筛选">
      <label>
        <span>范围</span>
        <select v-model="filters.scope">
          <option v-for="option in scopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label>
        <span>月份</span>
        <input v-model="filters.month" type="month" />
      </label>
      <label>
        <span>开始</span>
        <input v-model="filters.dateFrom" type="date" />
      </label>
      <label>
        <span>结束</span>
        <input v-model="filters.dateTo" type="date" />
      </label>
      <label>
        <span>项目</span>
        <select v-model="filters.projectId">
          <option value="">全部项目</option>
          <option v-for="project in projectOptions" :key="project.id" :value="project.id">{{ project.name }}</option>
        </select>
      </label>
      <label>
        <span>人员</span>
        <select v-model="filters.userId">
          <option value="">全部人员</option>
          <option v-for="user in userOptions" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
      </label>
      <label>
        <span>状态</span>
        <select v-model="filters.status">
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="SUBMITTED">已提交</option>
        </select>
      </label>
      <label>
        <span>关联事项</span>
        <select v-model="filters.issueState">
          <option value="">全部</option>
          <option value="with">有关联事项</option>
          <option value="without">无关联事项</option>
        </select>
      </label>
      <Button variant="ghost" size="small" @click="clearFilters">清除</Button>
    </section>

    <div class="timesheet-list-table" role="table" aria-label="完整工时列表">
      <div class="timesheet-list-head" role="row">
        <span>日期</span>
        <span>填报人</span>
        <span>项目</span>
        <span>关联事项</span>
        <span>说明</span>
        <span>工时</span>
        <span>状态</span>
        <span>创建时间</span>
        <span>提交时间</span>
        <span>操作</span>
      </div>
      <div v-for="entry in pagedRows" :key="entry.id" class="timesheet-list-row" role="row">
        <span>{{ displayDate(entry) }}</span>
        <span>{{ entry.reporter || userName(entry.userId) }}</span>
        <span>
          <strong>{{ projectName(entry.projectId) }}</strong>
          <small>{{ projectCode(entry.projectId) }}</small>
        </span>
        <span>{{ issueName(entry.issueId) || "未关联" }}</span>
        <span>{{ entry.note || entry.description || "无说明" }}</span>
        <strong>{{ entry.hours }}h</strong>
        <span><StatusLozenge :label="statusDisplay(entry.status)" :tone="statusTone(entry.status)" /></span>
        <span>{{ dateTimeLabel(entry.createdAt) }}</span>
        <span>{{ normalizedStatus(entry.status) === "SUBMITTED" ? dateTimeLabel(entry.updatedAt || entry.createdAt) : "未提交" }}</span>
        <span class="timesheet-list-actions">
          <Button v-if="canSubmit(entry)" variant="ghost" size="tiny" @click="emit('submit', entry.id)">提交</Button>
          <span v-else>{{ isOwnEntry(entry) ? "只读" : "无权限" }}</span>
        </span>
      </div>

      <EmptyState
        v-if="!pagedRows.length"
        title="暂无工时明细"
        description="当前筛选条件下没有可查看的工时记录。"
      />
    </div>

    <div v-if="filteredRows.length" class="pagination-bar">
      <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ filteredRows.length }} 条</span>
      <div>
        <Button variant="ghost" size="small" :disabled="page <= 1" @click="page -= 1">上一页</Button>
        <Button variant="ghost" size="small" :disabled="page >= totalPages" @click="page += 1">下一页</Button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import EmptyState from "../components/common/EmptyState.vue";
import Button from "../components/ui/Button.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import { canMutateOwnDraft, filterTimeEntriesForScope, getManagedProjects, TIMESHEET_SCOPES } from "../services/timesheetAccessService.js";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  people: { type: Array, required: true },
  context: { type: Object, required: true },
  projectMembers: { type: Array, default: () => [] },
});

const emit = defineEmits(["open-fill", "submit"]);
const page = ref(1);
const pageSize = 12;
const filters = reactive({
  scope: TIMESHEET_SCOPES.OWN,
  month: "",
  dateFrom: "",
  dateTo: "",
  projectId: "",
  userId: "",
  status: "",
  issueState: "",
});

const managedProjects = computed(() => getManagedProjects(props.projects, props.context));
const scopeOptions = computed(() => {
  if (props.context.isAdmin) {
    return [
      { value: TIMESHEET_SCOPES.ALL, label: "全部工时" },
      { value: TIMESHEET_SCOPES.OWN, label: "我的工时" },
      { value: TIMESHEET_SCOPES.OWNED, label: "我负责的项目" },
    ];
  }
  const options = [{ value: TIMESHEET_SCOPES.OWN, label: "我的工时" }];
  if (managedProjects.value.length) options.push({ value: TIMESHEET_SCOPES.OWNED, label: "我负责的项目" });
  return options;
});
const scopedRows = computed(() => filterTimeEntriesForScope(props.timeEntries, {
  projects: props.projects,
  context: props.context,
  scope: filters.scope,
}));
const filteredRows = computed(() => scopedRows.value
  .filter((entry) => !filters.month || displayDate(entry).startsWith(filters.month))
  .filter((entry) => !filters.dateFrom || displayDate(entry) >= filters.dateFrom)
  .filter((entry) => !filters.dateTo || displayDate(entry) <= filters.dateTo)
  .filter((entry) => !filters.projectId || entry.projectId === filters.projectId)
  .filter((entry) => !filters.userId || entry.userId === filters.userId)
  .filter((entry) => !filters.status || normalizedStatus(entry.status) === filters.status)
  .filter((entry) => filters.issueState !== "with" || Boolean(entry.issueId))
  .filter((entry) => filters.issueState !== "without" || !entry.issueId)
  .sort((a, b) => displayDate(b).localeCompare(displayDate(a)) || String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))));
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const projectOptions = computed(() => {
  const ids = new Set(scopedRows.value.map((entry) => entry.projectId));
  return props.projects.filter((project) => ids.has(project.id));
});
const userOptions = computed(() => {
  const ids = new Set(scopedRows.value.map((entry) => entry.userId).filter(Boolean));
  const fromEntries = scopedRows.value
    .filter((entry) => entry.userId && entry.reporter)
    .map((entry) => ({ id: entry.userId, name: entry.reporter }));
  const fromPeople = props.people
    .filter((person) => typeof person === "object" && person?.id)
    .map((person) => ({ id: person.id, name: person.name }));
  const fromContext = props.context.user ? [{ id: props.context.user.id, name: props.context.user.name }] : [];
  const fromMembers = props.projectMembers
    .map((member) => member.user)
    .filter(Boolean)
    .map((user) => ({ id: user.id, name: user.name }));
  return [...fromEntries, ...fromPeople, ...fromContext, ...fromMembers]
    .filter((user, index, list) => ids.has(user.id) && list.findIndex((item) => item.id === user.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
});

watch(() => props.context.isAdmin, () => {
  filters.scope = props.context.isAdmin ? TIMESHEET_SCOPES.ALL : TIMESHEET_SCOPES.OWN;
}, { immediate: true });
watch(filters, () => { page.value = 1; });
watch(totalPages, () => {
  if (page.value > totalPages.value) page.value = totalPages.value;
});

function clearFilters() {
  filters.month = "";
  filters.dateFrom = "";
  filters.dateTo = "";
  filters.projectId = "";
  filters.userId = "";
  filters.status = "";
  filters.issueState = "";
}

function canSubmit(entry) {
  return canMutateOwnDraft(entry, props.context);
}

function isOwnEntry(entry) {
  return entry.userId === props.context.userId || entry.reporter === props.context.user?.name;
}

function displayDate(entry) {
  return entry?.spentDate || entry?.workDate || "";
}

function normalizedStatus(status) {
  return ({ 草稿: "DRAFT", DRAFT: "DRAFT" })[status] || "SUBMITTED";
}

function statusDisplay(status) {
  return normalizedStatus(status) === "DRAFT" ? "草稿" : "已提交";
}

function statusTone(status) {
  return normalizedStatus(status) === "DRAFT" ? "warn" : "success";
}

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function projectCode(projectId) {
  return props.projects.find((project) => project.id === projectId)?.code || projectId || "-";
}

function issueName(issueId) {
  if (!issueId) return "";
  return props.issues.find((issue) => issue.id === issueId)?.title || "未关联事项";
}

function userName(userId) {
  return userOptions.value.find((user) => user.id === userId)?.name || "未知成员";
}

function dateTimeLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
</script>
