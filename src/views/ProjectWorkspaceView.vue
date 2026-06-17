<template>
  <section class="view-stack">
    <header class="project-hero compact-hero">
      <div class="project-heading">
        <p class="eyebrow">项目 / {{ template.name }}</p>
        <div class="project-title-row">
          <h1>{{ project.name }}</h1>
          <StatusLozenge :label="project.status" />
        </div>
        <p>{{ project.description }}</p>
        <div class="project-meta-row">
          <span>负责人：{{ project.owner }}</span>
          <span>周期：{{ project.startDate }} - {{ project.dueDate }}</span>
          <span>关键日期：测试 {{ project.testDate }} · 验收 {{ project.acceptanceDate }} · 上线 {{ project.releaseDate }}</span>
        </div>
      </div>

      <div class="project-kpi-strip">
        <article>
          <span>健康度</span>
          <strong>{{ summary.health }}</strong>
        </article>
        <article>
          <span>进度</span>
          <strong>{{ summary.progress }}%</strong>
          <div class="progress-line"><i :style="{ width: `${summary.progress}%` }"></i></div>
        </article>
        <article>
          <span>待办</span>
          <strong>{{ summary.openCount }}</strong>
        </article>
        <article>
          <span>风险</span>
          <strong>{{ summary.scheduleRiskCount }}</strong>
        </article>
      </div>

      <div class="project-hero-actions">
        <label class="project-status-select">
          <span>项目状态</span>
          <select :value="project.status" @change="$emit('update-project', project.id, { status: $event.target.value })">
            <option v-for="status in projectStatuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </label>
        <Button variant="ghost" size="small" @click="$emit('edit-project', project.id)">编辑项目</Button>
        <OverflowMenu>
          <template #default="{ close }">
            <Button variant="danger" size="small" @click="close(); $emit('delete-project', project.id)">删除项目</Button>
          </template>
        </OverflowMenu>
      </div>
    </header>

    <div class="project-toolbar">
      <Tabs v-model="activeView" :items="template.views" id-base="project-workspace-tabs" />
      <div class="project-toolbar-actions">
        <Button variant="ghost" size="small" @click="$emit('import-schedule')">导入排期</Button>
        <Button variant="primary" size="small" @click="$emit('create-issue')">新建事项</Button>
      </div>
    </div>

    <IssueFilters v-model="filters" :people="people" @reset="resetFilters" />

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

    <section v-else-if="activeView === '看板' || activeView === '阶段计划'" :id="tabPanelId(activeView)" class="panel flush-panel" role="tabpanel" :aria-labelledby="tabId(activeView)">
      <AgileBoard
        :issues="filteredVisibleIssues"
        :statuses="template.workflow"
        @open="$emit('open-issue', $event)"
        @status="(...args) => $emit('status', ...args)"
        @advance="$emit('advance', $event)"
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

    <section v-else :id="tabPanelId(activeView)" class="panel" role="tabpanel" :aria-labelledby="tabId(activeView)">
      <div class="panel-head">
        <div>
          <h2>{{ activeView }}</h2>
          <p>{{ template.positioning }}</p>
        </div>
      </div>
      <IssueTable
        v-if="filteredVisibleIssues.length"
        :issues="filteredVisibleIssues"
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
    </section>
  </section>
</template>

<script setup>
import { computed, reactive } from "vue";
import { filterIssues } from "../domain/issue.js";
import { getProjectActivities, getProjectAlerts } from "../domain/projectInsight.js";
import { PROJECT_STATUS_OPTIONS } from "../domain/project.js";
import Button from "../components/ui/Button.vue";
import Tabs from "../components/ui/Tabs.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import OverflowMenu from "../components/ui/OverflowMenu.vue";
import AgileBoard from "../components/project/AgileBoard.vue";
import WaterfallPhaseView from "../components/project/WaterfallPhaseView.vue";
import GanttChart from "../components/project/GanttChart.vue";
import IssueTable from "../components/issue/IssueTable.vue";
import IssueFilters from "../components/issue/IssueFilters.vue";
import EmptyState from "../components/common/EmptyState.vue";

const props = defineProps({
  project: { type: Object, required: true },
  template: { type: Object, required: true },
  issues: { type: Array, required: true },
  summary: { type: Object, required: true },
  visibleIssues: { type: Array, required: true },
  people: { type: Array, required: true },
});

const activeView = defineModel("activeView", { type: String, required: true });

const emit = defineEmits(["create-issue", "import-schedule", "open-issue", "status", "advance", "update-project", "edit-project", "delete-project"]);
const projectStatuses = PROJECT_STATUS_OPTIONS;

let filters = reactive({
  keyword: "",
  dateFrom: "",
  dateTo: "",
  owner: "",
  creator: "",
});

const filteredIssues = computed(() => filterIssues(props.issues, filters));
const filteredVisibleIssues = computed(() => filterIssues(props.visibleIssues, filters));
const projectAlerts = computed(() => getProjectAlerts(filteredIssues.value));
const recentActivities = computed(() => getProjectActivities(props.issues));

function resetFilters() {
  filters.keyword = "";
  filters.dateFrom = "";
  filters.dateTo = "";
  filters.owner = "";
  filters.creator = "";
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
</script>
