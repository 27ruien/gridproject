<template>
  <section class="view-stack project-workspace">
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
      v-if="showIssueToolbar"
      v-model:active-view="activeView"
      v-model:filters="filters"
      v-model:sort="issueSort"
      v-model:view-mode="issueViewMode"
      :people="people"
      :views="availableViews"
      :show-view-menu="false"
      @create="$emit('create-issue')"
      @reset="resetFilters"
    />

    <section v-if="activeView === '概览'" :id="tabPanelId('概览')" class="project-overview-console" role="tabpanel" :aria-labelledby="tabId('概览')">
      <div class="overview-metrics-row" aria-label="项目核心指标">
        <article class="overview-metric">
          <span>整体完成度</span>
          <strong>{{ summary.progress }}%</strong>
          <small>{{ summary.doneCount }} / {{ summary.totalCount }} 个事项完成</small>
        </article>
        <article class="overview-metric">
          <span>进度健康</span>
          <strong :class="scheduleHealth.tone">{{ scheduleHealth.label }}</strong>
          <small>{{ attentionCounts.overdue }} 个逾期 · {{ attentionCounts.dueSoon }} 个 7 天内到期</small>
        </article>
        <article class="overview-metric">
          <span>工时消耗</span>
          <strong>{{ summary.actualHours }}h</strong>
          <small v-if="summary.estimatedHours">预计 {{ summary.estimatedHours }}h · 使用 {{ hourUsageRate }}%</small>
          <small v-else>已投入工时</small>
        </article>
        <article class="overview-metric">
          <span>下一个里程碑</span>
          <strong v-if="nextMilestone">{{ nextMilestone.name }}</strong>
          <strong v-else>暂无</strong>
          <small v-if="nextMilestone">{{ nextMilestone.dueDate || "未设置日期" }} · {{ daysLeftText(nextMilestone.dueDate) }}</small>
          <small v-else>还没有可推进的里程碑</small>
        </article>
      </div>

      <section class="attention-strip" aria-label="需要关注">
        <button
          v-for="item in attentionItems"
          :key="item.key"
          type="button"
          :class="item.tone"
          @click="applyAttentionFilter(item.key)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </button>
      </section>

      <div class="overview-work-grid">
        <main class="overview-main-column">
          <section class="overview-panel">
            <header class="overview-section-head">
              <div>
                <h2>本周和下周工作</h2>
                <p>按负责人查看接下来两周的待办、临期和预计投入。</p>
              </div>
              <div class="segmented-control compact" role="group" aria-label="周视图">
                <button v-for="option in weekTabs" :key="option.value" type="button" :class="{ active: activeWeek === option.value }" @click="activeWeek = option.value">{{ option.label }}</button>
              </div>
            </header>
            <div class="overview-section-tools">
              <div class="segmented-control compact" role="group" aria-label="工作视角">
                <button type="button" :class="{ active: overviewPerspective === 'people' }" @click="overviewPerspective = 'people'">按人员</button>
                <button type="button" :class="{ active: overviewPerspective === 'items' }" @click="overviewPerspective = 'items'">按事项</button>
              </div>
            </div>

            <div v-if="overviewPerspective === 'people'" class="owner-work-list">
              <article v-for="group in weeklyOwnerGroups" :key="group.owner" class="owner-work-group">
                <header>
                  <span class="owner-avatar">{{ group.owner.slice(0, 1) }}</span>
                  <div>
                    <strong>{{ group.owner }}</strong>
                    <small>{{ group.count }} 项 · 临期 {{ group.dueSoonCount }} 项<span v-if="group.estimatedHours"> · {{ group.estimatedHours }}h</span></small>
                  </div>
                </header>
                <div class="overview-task-list">
                  <button v-for="issue in group.issues" :key="issue.id" type="button" @click="$emit('open-issue', issue.id)">
                    <strong>{{ issue.title }}</strong>
                    <span><PriorityPill :priority="issue.priority" /> <StatusLozenge :label="issue.status" /> 截止 {{ issue.dueDate || "未设置" }}<template v-if="issue.estimatedHours"> · {{ issue.estimatedHours }}h</template></span>
                  </button>
                </div>
              </article>
              <p v-if="!weeklyOwnerGroups.length" class="quiet-text">这个周期暂无待办事项。</p>
            </div>

            <div v-else class="overview-task-list flat">
              <button v-for="issue in weeklyIssues" :key="issue.id" type="button" @click="$emit('open-issue', issue.id)">
                <strong>{{ issue.title }}</strong>
                <span>{{ issue.owner || "未分配" }} · <PriorityPill :priority="issue.priority" /> <StatusLozenge :label="issue.status" /> 截止 {{ issue.dueDate || "未设置" }}<template v-if="issue.estimatedHours"> · {{ issue.estimatedHours }}h</template></span>
              </button>
              <p v-if="!weeklyIssues.length" class="quiet-text">这个周期暂无待办事项。</p>
            </div>
          </section>

          <section class="overview-panel recent-activity-panel">
            <header class="overview-section-head">
              <div>
                <h2>最近动态</h2>
                <p>仅保留状态、负责人、风险、里程碑、交付验收和工时相关动作。</p>
              </div>
            </header>
            <div v-if="managementActivities.length" class="project-activity-stream compact">
              <button v-for="activity in managementActivities" :key="activity.id" class="project-activity-item" type="button" @click="$emit('open-issue', activity.issueId)">
                <span>{{ activity.issueCode }}</span>
                <strong>{{ activity.issueTitle }}</strong>
                <small>{{ activity.actor }} · {{ activity.text }} · {{ formatActivityTime(activity.at) }}</small>
              </button>
            </div>
            <p v-else class="quiet-text">暂无项目管理相关动态。</p>
          </section>
        </main>

        <aside class="overview-side-column">
          <section class="overview-panel">
            <header class="overview-section-head">
              <div>
                <h2>即将到来</h2>
                <p>里程碑与交付物</p>
              </div>
            </header>
            <div class="upcoming-list">
              <button v-for="item in upcomingMilestonesAndDeliveries" :key="item.key" type="button" @click="openUpcoming(item)">
                <span class="pill neutral">{{ item.type }}</span>
                <strong>{{ item.name }}</strong>
                <small>{{ item.date || "未设置日期" }} · {{ item.status }}</small>
              </button>
              <p v-if="!upcomingMilestonesAndDeliveries.length" class="quiet-text">暂无即将到来的里程碑或交付。</p>
            </div>
          </section>

          <section class="overview-panel">
            <header class="overview-section-head">
              <div>
                <h2>团队本周负载</h2>
                <p>按已安排预计工时统计</p>
              </div>
            </header>
            <div class="team-load-list">
              <div v-for="load in teamLoad" :key="load.owner">
                <span>{{ load.owner }}</span>
                <strong>{{ load.hours }}h</strong>
                <i><b :style="{ width: `${load.percent}%` }"></b></i>
              </div>
              <p v-if="!teamLoad.length" class="quiet-text">本周暂无已安排工时。</p>
            </div>
          </section>
        </aside>
      </div>
    </section>

    <section v-else-if="activeView === '工作项'" :id="tabPanelId('工作项')" class="work-items-page" role="tabpanel" :aria-labelledby="tabId('工作项')">
      <div class="work-item-controls">
        <div>
          <strong>工作项视图</strong>
          <div class="segmented-control" role="group" aria-label="工作项视图">
            <button v-for="view in workItemViews" :key="view" type="button" :class="{ active: workItemView === view }" @click="workItemView = view">{{ view }}</button>
          </div>
        </div>
        <div>
          <strong>分组</strong>
          <div class="segmented-control" role="group" aria-label="工作项分组">
            <button v-for="option in groupOptions" :key="option.value" type="button" :class="{ active: workItemGroupBy === option.value }" @click="workItemGroupBy = option.value">{{ option.label }}</button>
          </div>
        </div>
      </div>

      <AgileBoard
        v-if="workItemView === '看板' && workItemGroupBy === 'status'"
        :issues="filteredVisibleIssues"
        :statuses="template.workflow"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
        @create="$emit('create-issue')"
      />
      <div v-else-if="workItemView === '看板'" class="grouped-board">
        <section v-for="group in groupedVisibleIssues" :key="group.key" class="board-column">
          <header>
            <div class="board-column-title">
              <span class="board-status-dot neutral"></span>
              <h3>{{ group.label }}</h3>
              <span>{{ group.issues.length }}</span>
            </div>
          </header>
          <div class="cards">
            <IssueCard
              v-for="issue in group.issues"
              :key="issue.id"
              :issue="issue"
              :statuses="template.workflow"
              @open="$emit('open-issue', $event)"
              @status="(...args) => $emit('status', ...args)"
            />
            <p v-if="!group.issues.length" class="board-empty-note">暂无事项</p>
          </div>
        </section>
      </div>

      <div v-else-if="workItemView === '列表'" class="grouped-list-view">
        <section v-for="group in groupedVisibleIssues" :key="group.key" class="work-list-group">
          <header><strong>{{ group.label }}</strong><span>{{ group.issues.length }} 项</span></header>
          <button v-for="issue in group.issues" :key="issue.id" type="button" class="work-list-row" @click="$emit('open-issue', issue.id)">
            <span>
              <strong>{{ issue.title }}</strong>
              <small>{{ issue.code }} · {{ issue.type }} · {{ issue.owner || "未分配" }}</small>
            </span>
            <PriorityPill :priority="issue.priority" />
            <StatusLozenge :label="issue.status" />
            <small>截止 {{ issue.dueDate || "未设置" }}<template v-if="issue.estimatedHours"> · {{ issue.estimatedHours }}h</template></small>
          </button>
        </section>
        <EmptyState v-if="!filteredVisibleIssues.length" :title="template.emptyState.title" :description="template.emptyState.description" :action="template.emptyState.action" @action="$emit('create-issue')" />
      </div>

      <section v-else-if="workItemView === '甘特图'" class="workspace-view-surface">
        <GanttChart :issues="filteredVisibleIssues" :project="project" @open="$emit('open-issue', $event)" />
      </section>

      <section v-else class="workspace-view-surface issue-list-panel" :class="`is-${normalizedViewMode}`">
        <IssueTable
          v-if="paginatedVisibleIssues.length"
          :issues="paginatedVisibleIssues"
          :statuses="template.workflow"
          :density="normalizedViewMode"
          @open="$emit('open-issue', $event)"
          @status="(...args) => $emit('status', ...args)"
        />
        <EmptyState v-else :title="template.emptyState.title" :description="template.emptyState.description" :action="template.emptyState.action" @action="$emit('create-issue')" />
        <div v-if="filteredVisibleIssues.length" class="pagination-bar">
          <span>第 {{ currentPage }} / {{ totalPages }} 页 · 共 {{ filteredVisibleIssues.length }} 项</span>
          <div>
            <Button variant="ghost" size="small" :disabled="currentPage <= 1" @click="setIssuePage(currentPage - 1)">上一页</Button>
            <Button variant="ghost" size="small" :disabled="currentPage >= totalPages" @click="setIssuePage(currentPage + 1)">下一页</Button>
          </div>
        </div>
      </section>
    </section>

    <section v-else-if="activeView === '里程碑'" :id="tabPanelId('里程碑')" class="panel" role="tabpanel" :aria-labelledby="tabId('里程碑')">
      <WaterfallPhaseView :milestones="project.milestones" :issues="issues" editable @status="updateMilestoneStatus" />
    </section>

    <section v-else-if="activeView === '交付与验收'" :id="tabPanelId('交付与验收')" class="workspace-view-surface delivery-page" role="tabpanel" :aria-labelledby="tabId('交付与验收')">
      <div class="module-subtabs">
        <button v-for="filter in deliveryFilters" :key="filter.value" type="button" :class="{ active: deliveryFilter === filter.value }" @click="deliveryFilter = filter.value">
          {{ filter.label }} <span>{{ deliveryCount(filter.value) }}</span>
        </button>
      </div>
      <IssueTable v-if="deliveryIssues.length" :issues="deliveryIssues" :statuses="template.workflow" :density="normalizedViewMode" @open="$emit('open-issue', $event)" @status="(...args) => $emit('status', ...args)" />
      <EmptyState v-else title="暂无交付与验收事项" description="将事项类型设为交付物或验收项后，会在这里统一管理提交与验收状态。" action="新建事项" @action="$emit('create-issue')" />
    </section>

    <section v-else-if="activeView === '风险'" :id="tabPanelId('风险')" class="workspace-view-surface issue-list-panel" role="tabpanel" :aria-labelledby="tabId('风险')">
      <IssueTable v-if="riskIssues.length" :issues="riskIssues" :statuses="template.workflow" :density="normalizedViewMode" @open="$emit('open-issue', $event)" @status="(...args) => $emit('status', ...args)" />
      <EmptyState v-else title="暂无风险事项" description="P0、风险类型或存在排期风险的事项会在这里集中展示。" action="新建风险" @action="$emit('create-issue')" />
    </section>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { filterIssues, isIssueRisky } from "../domain/issue.js";
import { getProjectActivities } from "../domain/projectInsight.js";
import { isClosedStatus } from "../domain/workflow.js";
import Button from "../components/ui/Button.vue";
import Tabs from "../components/ui/Tabs.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import AgileBoard from "../components/project/AgileBoard.vue";
import ProjectContextHeader from "../components/project/ProjectContextHeader.vue";
import ViewToolbar from "../components/project/ViewToolbar.vue";
import WaterfallPhaseView from "../components/project/WaterfallPhaseView.vue";
import GanttChart from "../components/project/GanttChart.vue";
import IssueCard from "../components/issue/IssueCard.vue";
import IssueTable from "../components/issue/IssueTable.vue";
import EmptyState from "../components/common/EmptyState.vue";
import PriorityPill from "../components/common/PriorityPill.vue";

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
  visualReviewMode: { type: String, default: "" },
});

const activeView = defineModel("activeView", { type: String, required: true });

const emit = defineEmits(["create-issue", "import-schedule", "open-issue", "status", "update-project", "edit-project", "delete-project", "url-state"]);
const workspaceViews = ["概览", "工作项", "里程碑", "交付与验收", "风险"];
const workItemViews = ["看板", "列表", "表格", "甘特图"];
const groupOptions = [
  { value: "phase", label: "按阶段" },
  { value: "status", label: "按状态" },
  { value: "owner", label: "按负责人" },
  { value: "priority", label: "按优先级" },
];
const deliveryFilters = [
  { value: "all", label: "全部交付物" },
  { value: "pending", label: "待验收" },
  { value: "accepted", label: "已验收" },
];
const weekTabs = [
  { value: "this", label: "本周" },
  { value: "next", label: "下周" },
];
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
const workItemView = ref("看板");
const workItemGroupBy = ref("status");
const deliveryFilter = ref("all");
const attentionFilter = ref("");
const activeWeek = ref("this");
const overviewPerspective = ref("people");

const availableViews = computed(() => workspaceViews.filter((view) => props.template.views.includes(view)));
const showIssueToolbar = computed(() => ["工作项", "交付与验收", "风险"].includes(activeView.value));
const normalizedViewMode = computed(() => issueViewMode.value === "compact" ? "compact" : "comfortable");
const pageSize = computed(() => props.visualReviewMode === "plane-r1-list-dense" ? 24 : pageSizes[normalizedViewMode.value]);
const filteredIssues = computed(() => sortIssues(applyAttentionFilterToIssues(filterIssues(props.issues, filters))));
const filteredVisibleIssues = computed(() => sortIssues(applyAttentionFilterToIssues(filterIssues(props.visibleIssues, filters))));
const totalPages = computed(() => Math.max(1, Math.ceil(filteredVisibleIssues.value.length / pageSize.value)));
const currentPage = computed(() => clamp(parseInt(issuePage.value || "1", 10) || 1, 1, totalPages.value));
const paginatedVisibleIssues = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredVisibleIssues.value.slice(start, start + pageSize.value);
});
const groupedVisibleIssues = computed(() => groupIssues(filteredVisibleIssues.value, workItemGroupBy.value));
const deliveryBaseIssues = computed(() => filteredIssues.value.filter(isDeliveryIssue));
const deliveryIssues = computed(() => {
  if (deliveryFilter.value === "pending") return deliveryBaseIssues.value.filter(isPendingAcceptance);
  if (deliveryFilter.value === "accepted") return deliveryBaseIssues.value.filter((issue) => issue.status === "已验收");
  return deliveryBaseIssues.value;
});
const riskIssues = computed(() => filteredIssues.value.filter((issue) => isIssueRisky(issue)));
const dueSoonIssues = computed(() => props.issues.filter((issue) => !isClosedStatus(issue.status) && daysUntil(issue.dueDate) >= 0 && daysUntil(issue.dueDate) <= 7));
const overdueIssues = computed(() => props.issues.filter((issue) => isOverdue(issue)));
const blockedIssues = computed(() => props.issues.filter((issue) => /阻塞/.test(`${issue.status} ${issue.next} ${issue.description}`)));
const highRiskIssues = computed(() => props.issues.filter((issue) => isIssueRisky(issue)));
const unassignedIssues = computed(() => props.issues.filter((issue) => !issue.owner || issue.owner === "未分配"));
const pendingAcceptanceIssues = computed(() => props.issues.filter((issue) => isDeliveryIssue(issue) && isPendingAcceptance(issue)));
const attentionCounts = computed(() => ({
  overdue: overdueIssues.value.length,
  dueSoon: dueSoonIssues.value.length,
  blocked: blockedIssues.value.length,
  highRisk: highRiskIssues.value.length,
  unassigned: unassignedIssues.value.length,
  pendingAcceptance: pendingAcceptanceIssues.value.length,
}));
const attentionItems = computed(() => [
  { key: "overdue", label: "已逾期", count: attentionCounts.value.overdue, tone: "danger" },
  { key: "dueSoon", label: "7 天内到期", count: attentionCounts.value.dueSoon, tone: "info" },
  { key: "blocked", label: "被阻塞", count: attentionCounts.value.blocked, tone: "warn" },
  { key: "highRisk", label: "高风险", count: attentionCounts.value.highRisk, tone: "danger" },
  { key: "unassigned", label: "未分配", count: attentionCounts.value.unassigned, tone: "neutral" },
  { key: "pendingAcceptance", label: "待验收", count: attentionCounts.value.pendingAcceptance, tone: "info" },
]);
const scheduleHealth = computed(() => {
  if (attentionCounts.value.overdue >= 3 || props.summary.scheduleRiskCount >= 2) return { label: "严重延期", tone: "danger" };
  if (attentionCounts.value.overdue || props.summary.scheduleRiskCount || attentionCounts.value.dueSoon) return { label: "轻微延期", tone: "warn" };
  return { label: "正常", tone: "success" };
});
const hourUsageRate = computed(() => props.summary.estimatedHours ? Math.round((props.summary.actualHours / props.summary.estimatedHours) * 100) : 0);
const nextMilestone = computed(() => upcomingMilestones.value[0] || null);
const upcomingMilestones = computed(() => [...(props.project.milestones || [])]
  .filter((milestone) => milestone.status !== "已完成")
  .sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate)));
const upcomingMilestonesAndDeliveries = computed(() => [
  ...upcomingMilestones.value.map((milestone) => ({
    key: `milestone-${milestone.id || milestone.name}`,
    type: "里程碑",
    name: milestone.name,
    date: milestone.dueDate,
    status: milestone.status,
    target: "",
  })),
  ...props.issues.filter(isDeliveryIssue).map((issue) => ({
    key: `delivery-${issue.id}`,
    type: issue.type,
    name: issue.title,
    date: issue.dueDate,
    status: issue.status,
    target: issue.id,
  })),
].sort((a, b) => dateValue(a.date) - dateValue(b.date)).slice(0, 6));
const weeklyRange = computed(() => {
  const weekStart = startOfWeek(new Date());
  const start = activeWeek.value === "next" ? addDays(weekStart, 7) : weekStart;
  return { start, end: addDays(start, 6) };
});
const weeklyIssues = computed(() => props.issues
  .filter((issue) => !isClosedStatus(issue.status) && isDateInRange(issue.dueDate, weeklyRange.value.start, weeklyRange.value.end))
  .sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate) || priorityValue(a.priority) - priorityValue(b.priority)));
const weeklyOwnerGroups = computed(() => groupIssues(weeklyIssues.value, "owner").map((group) => ({
  owner: group.label,
  count: group.issues.length,
  dueSoonCount: group.issues.filter((issue) => daysUntil(issue.dueDate) <= 3).length,
  estimatedHours: group.issues.reduce((sum, issue) => sum + (Number(issue.estimatedHours) || 0), 0),
  issues: group.issues,
})));
const teamLoad = computed(() => {
  const loads = weeklyOwnerGroups.value.map((group) => ({ owner: group.owner, hours: group.estimatedHours || 0 }));
  const max = Math.max(...loads.map((load) => load.hours), 0);
  return loads.map((load) => ({ ...load, percent: max ? Math.round((load.hours / max) * 100) : 0 }));
});
const managementActivities = computed(() => getProjectActivities(props.issues, 30)
  .filter((activity) => isManagementActivity(activity))
  .slice(0, 10));

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
  attentionFilter.value = "";
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
  attentionFilter.value = "";
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

function applyAttentionFilter(key) {
  attentionFilter.value = key;
  if (key === "pendingAcceptance") {
    activeView.value = "交付与验收";
    deliveryFilter.value = "pending";
    return;
  }
  activeView.value = key === "highRisk" ? "风险" : "工作项";
  if (key === "dueSoon") {
    filters.dateFrom = formatDate(startOfDay(new Date()));
    filters.dateTo = formatDate(addDays(startOfDay(new Date()), 7));
  }
}

function applyAttentionFilterToIssues(rows) {
  if (!attentionFilter.value) return rows;
  const filtersByKey = {
    overdue: isOverdue,
    dueSoon: (issue) => !isClosedStatus(issue.status) && daysUntil(issue.dueDate) >= 0 && daysUntil(issue.dueDate) <= 7,
    blocked: (issue) => /阻塞/.test(`${issue.status} ${issue.next} ${issue.description}`),
    highRisk: (issue) => isIssueRisky(issue),
    unassigned: (issue) => !issue.owner || issue.owner === "未分配",
    pendingAcceptance: (issue) => isDeliveryIssue(issue) && isPendingAcceptance(issue),
  };
  return rows.filter(filtersByKey[attentionFilter.value] || (() => true));
}

function deliveryCount(filter) {
  if (filter === "pending") return deliveryBaseIssues.value.filter(isPendingAcceptance).length;
  if (filter === "accepted") return deliveryBaseIssues.value.filter((issue) => issue.status === "已验收").length;
  return deliveryBaseIssues.value.length;
}

function openUpcoming(item) {
  if (item.target) emit("open-issue", item.target);
  else activeView.value = "里程碑";
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

function groupIssues(rows, groupBy) {
  const map = new Map();
  rows.forEach((issue) => {
    const group = issueGroup(issue, groupBy);
    if (!map.has(group.key)) map.set(group.key, { ...group, issues: [] });
    map.get(group.key).issues.push(issue);
  });
  return [...map.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, "zh-CN"));
}

function issueGroup(issue, groupBy) {
  if (groupBy === "status") return { key: issue.status || "未设置", label: issue.status || "未设置", rank: statusRank(issue.status) };
  if (groupBy === "owner") return { key: issue.owner || "未分配", label: issue.owner || "未分配", rank: issue.owner && issue.owner !== "未分配" ? 0 : 9 };
  if (groupBy === "priority") return { key: issue.priority || "未设置", label: issue.priority || "未设置", rank: priorityValue(issue.priority) };
  return phaseGroup(issue);
}

function phaseGroup(issue) {
  const milestones = props.project.milestones || [];
  const due = dateValue(issue.dueDate);
  const milestoneIndex = milestones.findIndex((milestone) => due <= dateValue(milestone.dueDate));
  if (milestoneIndex >= 0) return { key: milestones[milestoneIndex].id || milestones[milestoneIndex].name, label: milestones[milestoneIndex].name, rank: milestoneIndex };
  return { key: "unplanned", label: "未归入阶段", rank: 99 };
}

function sortIssues(rows) {
  if (issueSort.value === "dueDate:asc") return [...rows].sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate));
  if (issueSort.value === "dueDate:desc") return [...rows].sort((a, b) => dateValue(b.dueDate) - dateValue(a.dueDate));
  if (issueSort.value === "priority") return [...rows].sort((a, b) => priorityValue(a.priority) - priorityValue(b.priority));
  return rows;
}

function isDeliveryIssue(issue) {
  return ["交付物", "验收项"].includes(issue.type);
}

function isPendingAcceptance(issue) {
  return isDeliveryIssue(issue) && issue.status !== "已验收";
}

function isOverdue(issue) {
  return Boolean(issue.dueDate && !isClosedStatus(issue.status) && new Date(`${issue.dueDate}T23:59:59`).getTime() < Date.now());
}

function isManagementActivity(activity) {
  const text = `${activity.type || ""} ${activity.text || ""} ${activity.issueTitle || ""}`;
  return /status|owner|risk|milestone|delivery|accept|time|工时|状态|负责人|风险|里程碑|交付|验收/.test(text);
}

function daysUntil(dateValue) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const dueDate = startOfDay(new Date(`${dateValue}T00:00:00`));
  const today = startOfDay(new Date());
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
}

function daysLeftText(dateValue) {
  const days = daysUntil(dateValue);
  if (!Number.isFinite(days)) return "未设置剩余天数";
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `剩余 ${days} 天`;
}

function isDateInRange(value, start, end) {
  if (!value) return false;
  const date = startOfDay(new Date(`${value}T00:00:00`));
  return date >= start && date <= end;
}

function startOfWeek(date) {
  const value = startOfDay(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(`${value}T00:00:00`).getTime();
}

function priorityValue(value) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[value] ?? 4;
}

function statusRank(status) {
  const index = props.template.workflow.indexOf(status);
  return index >= 0 ? index : 9;
}

function normalizePageParam(value) {
  const page = parseInt(value || "1", 10);
  return Number.isFinite(page) && page > 1 ? String(page) : "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
</script>
