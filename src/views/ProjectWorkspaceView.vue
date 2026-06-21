<template>
  <section class="view-stack">
    <ProjectContextHeader
      :project="project"
      :summary="summary"
      :permissions="permissions"
      @import-schedule="$emit('import-schedule')"
      @update-project="(...args) => $emit('update-project', ...args)"
      @edit-project="$emit('edit-project', $event)"
      @delete-project="$emit('delete-project', $event)"
    />

    <div class="project-view-tabs">
      <Tabs v-model="activeView" :items="availableViews" id-base="project-workspace-tabs" />
    </div>

    <ViewToolbar
      v-model:active-view="activeView"
      v-model:filters="filters"
      v-model:sort="issueSort"
      v-model:view-mode="issueViewMode"
      :people="people"
      :views="availableViews"
      @create="$emit('create-issue')"
      @reset="resetFilters"
    />

    <section v-if="activeView === '概览'" :id="tabPanelId('概览')" class="workspace-grid" role="tabpanel" :aria-labelledby="tabId('概览')">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>风险雷达</h2>
            <p>优先暴露逾期、P0、风险和 3 天内到期事项。</p>
          </div>
        </div>
        <div v-if="projectAlerts.length" class="insight-list">
          <button
            v-for="alert in projectAlerts"
            :key="alert.issueId"
            class="insight-item"
            type="button"
            @click="$emit('open-issue', alert.issueId)"
          >
            <span class="insight-tone" :class="alert.tone">{{ alert.label }}</span>
            <strong>{{ alert.title }}</strong>
            <small>{{ alert.owner }} · 截止 {{ alert.dueDate || "未设置" }} · {{ alert.reason || alert.next }}</small>
          </button>
        </div>
        <p v-else class="quiet-text">暂无逾期、P0、风险或临近到期事项。</p>

        <h3 class="panel-divider-title">当前重点事项</h3>
        <IssueTable
          v-if="filteredIssues.length"
          :issues="filteredIssues.slice(0, 6)"
          :statuses="template.workflow"
          @open="$emit('open-issue', $event)"
          @status="(...args) => $emit('status', ...args)"
        />
        <EmptyState
          v-else
          :title="template.emptyState.title"
          :description="template.emptyState.description"
          :action="template.emptyState.action"
          @action="$emit('create-issue')"
        />
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>最近动态</h2>
            <p>聚合本项目事项的创建、评论、编辑和状态流转。</p>
          </div>
        </div>
        <div v-if="recentActivities.length" class="project-activity-stream">
          <button
            v-for="activity in recentActivities"
            :key="activity.id"
            class="project-activity-item"
            type="button"
            @click="$emit('open-issue', activity.issueId)"
          >
            <span>{{ activity.issueCode }}</span>
            <strong>{{ activity.issueTitle }}</strong>
            <small>{{ activity.actor }} · {{ activity.text }} · {{ formatActivityTime(activity.at) }}</small>
          </button>
        </div>
        <p v-else class="quiet-text">暂无项目动态。</p>

        <h3 class="panel-divider-title">{{ template.id === 'agile' ? '迭代里程碑' : '交付阶段' }}</h3>
        <WaterfallPhaseView
          :milestones="project.milestones"
          :issues="issues"
          editable
          @status="updateMilestoneStatus"
        />
      </div>
    </section>

    <section v-else-if="activeView === '看板' || activeView === '阶段计划'" :id="tabPanelId(activeView)" class="workspace-view-surface board-view-surface" role="tabpanel" :aria-labelledby="tabId(activeView)">
      <AgileBoard
        :issues="filteredVisibleIssues"
        :statuses="template.workflow"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
      />
    </section>

    <section v-else-if="activeView === '里程碑'" :id="tabPanelId('里程碑')" class="panel" role="tabpanel" :aria-labelledby="tabId('里程碑')">
      <WaterfallPhaseView
        :milestones="project.milestones"
        :issues="issues"
        editable
        @status="updateMilestoneStatus"
      />
    </section>

    <section v-else-if="activeView === '甘特图'" :id="tabPanelId('甘特图')" class="panel" role="tabpanel" :aria-labelledby="tabId('甘特图')">
      <GanttChart :issues="filteredVisibleIssues" @open="$emit('open-issue', $event)" />
    </section>

    <section v-else :id="tabPanelId(activeView)" class="workspace-view-surface issue-list-panel" :class="`is-${normalizedViewMode}`" role="tabpanel" :aria-labelledby="tabId(activeView)">
      <IssueTable
        v-if="paginatedVisibleIssues.length"
        :issues="paginatedVisibleIssues"
        :statuses="template.workflow"
        :density="normalizedViewMode"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
      />
      <EmptyState
        v-else
        :title="template.emptyState.title"
        :description="template.emptyState.description"
        :action="template.emptyState.action"
        @action="$emit('create-issue')"
      />
      <div v-if="filteredVisibleIssues.length" class="pagination-bar">
        <span>第 {{ currentPage }} / {{ totalPages }} 页 · 共 {{ filteredVisibleIssues.length }} 项</span>
        <div>
          <Button variant="ghost" size="small" :disabled="currentPage <= 1" @click="setIssuePage(currentPage - 1)">上一页</Button>
          <Button variant="ghost" size="small" :disabled="currentPage >= totalPages" @click="setIssuePage(currentPage + 1)">下一页</Button>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { filterIssues } from "../domain/issue.js";
import { getProjectActivities, getProjectAlerts } from "../domain/projectInsight.js";
import Button from "../components/ui/Button.vue";
import Tabs from "../components/ui/Tabs.vue";
import AgileBoard from "../components/project/AgileBoard.vue";
import ProjectContextHeader from "../components/project/ProjectContextHeader.vue";
import ViewToolbar from "../components/project/ViewToolbar.vue";
import WaterfallPhaseView from "../components/project/WaterfallPhaseView.vue";
import GanttChart from "../components/project/GanttChart.vue";
import IssueTable from "../components/issue/IssueTable.vue";
import EmptyState from "../components/common/EmptyState.vue";

const props = defineProps({
  project: { type: Object, required: true },
  template: { type: Object, required: true },
  issues: { type: Array, required: true },
  summary: { type: Object, required: true },
  visibleIssues: { type: Array, required: true },
  people: { type: Array, required: true },
  permissions: { type: Object, required: true },
  urlFilters: { type: Object, default: () => ({}) },
  sort: { type: String, default: "" },
  page: { type: String, default: "" },
  viewMode: { type: String, default: "" },
});

const activeView = defineModel("activeView", { type: String, required: true });

const emit = defineEmits(["create-issue", "import-schedule", "open-issue", "status", "update-project", "edit-project", "delete-project", "url-state"]);
const pageSizes = {
  comfortable: 6,
  compact: 10,
};
let applyingUrlState = false;

let filters = reactive({
  keyword: "",
  dateFrom: "",
  dateTo: "",
  owner: "",
  creator: "",
});
const issueSort = ref(props.sort || "");
const issuePage = ref(props.page || "");
const issueViewMode = ref(props.viewMode || "");

const filteredIssues = computed(() => sortIssues(filterIssues(props.issues, filters)));
const filteredVisibleIssues = computed(() => sortIssues(filterIssues(props.visibleIssues, filters)));
const availableViews = computed(() => props.template.views.filter((view) => props.permissions.canViewBoard || !["看板", "阶段计划"].includes(view)));
const normalizedViewMode = computed(() => issueViewMode.value === "compact" ? "compact" : "comfortable");
const pageSize = computed(() => pageSizes[normalizedViewMode.value]);
const totalPages = computed(() => Math.max(1, Math.ceil(filteredVisibleIssues.value.length / pageSize.value)));
const currentPage = computed(() => clamp(parseInt(issuePage.value || "1", 10) || 1, 1, totalPages.value));
const paginatedVisibleIssues = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredVisibleIssues.value.slice(start, start + pageSize.value);
});
const projectAlerts = computed(() => getProjectAlerts(filteredIssues.value));
const recentActivities = computed(() => getProjectActivities(props.issues));

watch(availableViews, (views) => {
  if (!views.includes(activeView.value)) activeView.value = views[0] || "概览";
}, { immediate: true });

watch(() => props.urlFilters, (nextFilters) => {
  applyingUrlState = true;
  applyFilters(nextFilters || {});
  applyingUrlState = false;
}, { immediate: true, deep: true });

watch(() => props.sort, (value) => { issueSort.value = value || ""; }, { immediate: true });
watch(() => props.page, (value) => { issuePage.value = normalizePageParam(value); }, { immediate: true });
watch(() => props.viewMode, (value) => { issueViewMode.value = value === "compact" ? "compact" : ""; }, { immediate: true });

watch(filters, () => {
  if (!applyingUrlState) issuePage.value = "";
  emitUrlState();
}, { deep: true });
watch(issueSort, () => {
  if (!applyingUrlState) issuePage.value = "";
  emitUrlState();
});
watch([issuePage, issueViewMode], () => emitUrlState());
watch(totalPages, () => {
  if ((parseInt(issuePage.value || "1", 10) || 1) > totalPages.value) setIssuePage(totalPages.value);
});

function resetFilters() {
  applyFilters({});
}

function setIssuePage(page) {
  const nextPage = clamp(page, 1, totalPages.value);
  issuePage.value = nextPage > 1 ? String(nextPage) : "";
}

function updateMilestoneStatus(index, status) {
  const milestones = props.project.milestones.map((milestone, milestoneIndex) => (
    milestoneIndex === index ? { ...milestone, status } : milestone
  ));
  emit("update-project", props.project.id, { milestones });
}

function formatActivityTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tabId(value) {
  return `project-workspace-tabs-tab-${slug(value)}`;
}

function tabPanelId(value) {
  return `project-workspace-tabs-panel-${slug(value)}`;
}

function slug(value) {
  return encodeURIComponent(String(value)).replace(/%/g, "");
}

function applyFilters(nextFilters) {
  filters.keyword = nextFilters.keyword || "";
  filters.dateFrom = nextFilters.dateFrom || "";
  filters.dateTo = nextFilters.dateTo || "";
  filters.owner = nextFilters.owner || "";
  filters.creator = nextFilters.creator || "";
}

function emitUrlState() {
  if (applyingUrlState) return;
  emit("url-state", {
    filters: { ...filters },
    sort: issueSort.value,
    page: currentPage.value > 1 ? String(currentPage.value) : "",
    viewMode: normalizedViewMode.value === "compact" ? "compact" : "",
  });
}

function sortIssues(issues) {
  if (issueSort.value === "dueDate:asc") return [...issues].sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate));
  if (issueSort.value === "dueDate:desc") return [...issues].sort((a, b) => dateValue(b.dueDate) - dateValue(a.dueDate));
  if (issueSort.value === "priority") return [...issues].sort((a, b) => priorityValue(a.priority) - priorityValue(b.priority));
  return issues;
}

function dateValue(value) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function priorityValue(value) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[value] ?? 4;
}

function normalizePageParam(value) {
  const page = parseInt(value || "1", 10);
  return Number.isFinite(page) && page > 1 ? String(page) : "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
</script>
