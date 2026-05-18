<template>
  <section class="view-stack">
    <div class="metrics">
      <article>
        <span>总投入工时</span>
        <strong>{{ totals.actualHours }}h</strong>
        <small>预估 {{ totals.estimatedHours }}h，剩余 {{ totals.remainingHours }}h</small>
      </article>
      <article>
        <span>整体进度</span>
        <strong>{{ totals.progress }}%</strong>
        <small>按已完结事项占比计算</small>
      </article>
      <article>
        <span>待办事项</span>
        <strong>{{ totals.openCount }}</strong>
        <small>逾期 {{ totals.overdueCount }}，风险 {{ totals.riskCount }}</small>
      </article>
      <article>
        <span>已完结事项</span>
        <strong>{{ totals.doneCount }}</strong>
        <small>共 {{ totals.totalCount }} 个事项</small>
      </article>
    </div>

    <div class="workbench-modules">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>项目视图</h2>
            <p>阶段、进度、截止风险和剩余工时放在同一张卡片里。</p>
          </div>
        </div>
        <div class="pm-project-cards">
          <button v-for="row in projectRows" :key="row.id" class="pm-project-card" type="button" @click="$emit('open-project', row.id)">
            <header>
              <span class="project-tag-row">
                <span class="stage-chip">{{ row.status }}</span>
                <span class="template-chip">{{ row.template.badge }}</span>
              </span>
              <strong>{{ row.name }}</strong>
              <small>{{ row.owner }} · 截止 {{ row.dueDate }}</small>
            </header>

            <div class="card-progress compact-progress">
              <span>{{ row.summary.progress }}%</span>
              <ProgressBar :value="row.summary.progress" />
            </div>

            <div class="project-signal-row">
              <span><b>{{ row.summary.health }}</b><small>健康度</small></span>
              <span><b>{{ row.summary.remainingHours }}h</b><small>剩余工时</small></span>
              <span><b>{{ dueLabel(row.dueDate) }}</b><small>截止</small></span>
            </div>

            <div class="card-kpis">
              <span><b>{{ row.summary.actualHours }}h</b><small>投入</small></span>
              <span><b>{{ row.summary.openCount }}</b><small>待办</small></span>
              <span><b>{{ row.summary.doneCount }}</b><small>完结</small></span>
              <span><b>{{ row.summary.riskCount }}/{{ row.summary.overdueCount }}</b><small>风险/逾期</small></span>
            </div>
          </button>
        </div>
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
          <button v-for="issue in currentTodoIssues.slice(0, 8)" :key="issue.id" class="work-row" type="button" @click="$emit('open-issue', issue.id)">
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
import ProgressBar from "../components/common/ProgressBar.vue";

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

function dueLabel(dueDate) {
  const days = daysUntil(dueDate);
  if (days < 0) return `逾期${Math.abs(days)}天`;
  if (days === 0) return "今天";
  return `${days}天`;
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
