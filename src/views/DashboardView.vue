<template>
  <section class="view-stack">
    <div class="metrics">
      <Metric label="我负责的项目" :value="ownedProjectCount" :hint="`全部 ${projects.length} 个项目`" />
      <Metric label="待处理事项" :value="totals.openCount" :hint="`已完结 ${totals.doneCount} / 共 ${totals.totalCount}`" />
      <Metric label="即将到期" :value="dueSoonIssues.length" hint="未来 7 天需要处理" />
      <Metric label="风险/逾期" :value="riskOrOverdueIssues.length" :hint="`逾期 ${totals.overdueCount}，风险 ${totals.riskCount}`" />
    </div>

    <div class="workbench-modules">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>我的项目</h2>
            <p>优先展示状态、负责人、进度、截止日期和风险信号。</p>
          </div>
          <button class="btn ghost small" type="button" @click="$emit('show-projects')">查看全部</button>
        </div>
        <ProjectTable :projects="projectRows" @open="$emit('open-project', $event)" />
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>待办事项</h2>
            <p>从我的任务、即将到期和风险逾期三个角度安排今天的动作。</p>
          </div>
        </div>
        <div class="segmented-control todo-tabs">
          <button
            v-for="tab in todoTabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTodoTab === tab.key }"
            @click="activeTodoTab = tab.key"
          >
            {{ tab.label }} {{ tab.count }}
          </button>
        </div>
        <div class="work-list">
          <button v-for="issue in currentTodoIssues.slice(0, 10)" :key="issue.id" class="work-row" type="button" @click="$emit('open-issue', issue.id)">
            <span>
              <strong>{{ issue.title }}</strong>
              <small>{{ issue.code }} · {{ projectName(issue.projectId) }} · {{ issue.next }}</small>
            </span>
            <span class="work-tags">
              <PriorityPill :priority="issue.priority" />
              <span>{{ issue.owner }}</span>
              <span>{{ issue.dueDate || "未设截止" }}</span>
            </span>
          </button>
          <p v-if="!currentTodoIssues.length" class="quiet-text">{{ emptyTodoText }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import PriorityPill from "../components/common/PriorityPill.vue";
import Metric from "../components/ui/Metric.vue";
import ProjectTable from "../components/project/ProjectTable.vue";

const props = defineProps({
  projects: { type: Array, required: true },
  projectRows: { type: Array, required: true },
  openIssues: { type: Array, required: true },
  riskyIssues: { type: Array, required: true },
  managerName: { type: String, required: true },
});

defineEmits(["open-project", "open-issue"]);

const activeTodoTab = ref("mine");

const totals = computed(() => {
  const metrics = props.projectRows.reduce((result, row) => ({
    actualHours: result.actualHours + row.summary.actualHours,
    estimatedHours: result.estimatedHours + row.summary.estimatedHours,
    remainingHours: result.remainingHours + row.summary.remainingHours,
    openCount: result.openCount + row.summary.openCount,
    doneCount: result.doneCount + row.summary.doneCount,
    totalCount: result.totalCount + row.summary.totalCount,
    overdueCount: result.overdueCount + row.summary.overdueCount,
    riskCount: result.riskCount + row.summary.riskCount,
  }), {
    actualHours: 0,
    estimatedHours: 0,
    remainingHours: 0,
    openCount: 0,
    doneCount: 0,
    totalCount: 0,
    overdueCount: 0,
    riskCount: 0,
  });

  return {
    ...metrics,
    progress: metrics.totalCount ? Math.round((metrics.doneCount / metrics.totalCount) * 100) : 0,
  };
});

const myTodoIssues = computed(() => sortIssues(props.openIssues.filter((issue) => issue.owner === props.managerName)));
const dueSoonIssues = computed(() => sortIssues(props.openIssues.filter(isDueSoon)));
const riskOrOverdueIssues = computed(() => sortIssues(props.openIssues.filter((issue) => issue.priority === "P0" || issue.type === "风险" || isOverdue(issue))));
const ownedProjectCount = computed(() => props.projects.filter((project) => project.owner === props.managerName).length);

const todoTabs = computed(() => [
  { key: "mine", label: "我的", count: myTodoIssues.value.length },
  { key: "due", label: "即将到期", count: dueSoonIssues.value.length },
  { key: "risk", label: "风险逾期", count: riskOrOverdueIssues.value.length },
]);

const currentTodoIssues = computed(() => {
  if (activeTodoTab.value === "due") return dueSoonIssues.value;
  if (activeTodoTab.value === "risk") return riskOrOverdueIssues.value;
  return myTodoIssues.value;
});

const emptyTodoText = computed(() => {
  if (activeTodoTab.value === "due") return "未来 7 天暂无即将到期事项。";
  if (activeTodoTab.value === "risk") return "暂无 P0、风险或逾期事项。";
  return "暂无分配给我的未完成事项。";
});

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function sortIssues(issues) {
  return [...issues].sort((a, b) => priorityWeight(a) - priorityWeight(b) || dateWeight(a.dueDate) - dateWeight(b.dueDate));
}

function priorityWeight(issue) {
  const weights = { P0: 0, P1: 1, P2: 2, P3: 3 };
  if (issue.type === "风险") return -1;
  return weights[issue.priority] ?? 4;
}

function dateWeight(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}

function isDueSoon(issue) {
  if (!issue.dueDate) return false;
  const days = daysUntil(issue.dueDate);
  return days >= 0 && days <= 7;
}

function isOverdue(issue) {
  return Boolean(issue.dueDate && daysUntil(issue.dueDate) < 0);
}

function daysUntil(dateValue) {
  if (!dateValue) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dateValue);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
}
</script>
