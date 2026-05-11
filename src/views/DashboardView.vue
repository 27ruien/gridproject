<template>
  <section class="view-stack">
    <div class="workbench-head">
      <div>
        <p class="eyebrow">项目经理工作台</p>
        <h1>项目投入、进度、待办和风险</h1>
        <p>聚焦本周要推进的项目、任务和风险，不展示与项目经理无关的组织噪音。</p>
      </div>
      <div class="console-badges">
        <span><strong>{{ totals.riskCount }}</strong> 风险</span>
        <span><strong>{{ totals.overdueCount }}</strong> 逾期</span>
        <span><strong>{{ totals.remainingHours }}h</strong> 剩余</span>
      </div>
    </div>

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

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>单项目经营视图</h2>
          <p>用卡片快速判断每个项目的投入、进度、待办和风险。</p>
        </div>
      </div>
      <div class="pm-project-cards">
        <button v-for="row in projectRows" :key="row.id" class="pm-project-card" type="button" @click="$emit('open-project', row.id)">
          <header>
            <span class="pill" :class="row.template.accent">{{ row.template.badge }}</span>
            <strong>{{ row.name }}</strong>
            <small>{{ row.owner }} · {{ row.startDate }} - {{ row.dueDate }}</small>
          </header>
          <div class="card-progress">
            <span>{{ row.summary.progress }}%</span>
            <ProgressBar :value="row.summary.progress" />
          </div>
          <div class="card-kpis">
            <span><b>{{ row.summary.actualHours }}h</b><small>投入</small></span>
            <span><b>{{ row.summary.openCount }}</b><small>待办</small></span>
            <span><b>{{ row.summary.doneCount }}</b><small>完结</small></span>
            <span><b>{{ row.summary.riskCount }}/{{ row.summary.overdueCount }}</b><small>风险/逾期</small></span>
          </div>
          <div class="follow-list">
            <button
              v-for="issue in row.summary.nextIssues"
              :key="issue.id"
              class="follow-chip"
              type="button"
              @click.stop="$emit('open-issue', issue.id)"
            >
              <strong>{{ issue.title }}</strong>
              <small>{{ issue.owner }} · {{ issue.dueDate || "未设截止" }}</small>
            </button>
            <small v-if="!row.summary.nextIssues.length">暂无待跟进任务</small>
          </div>
        </button>
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>需要今天处理</h2>
            <p>P0、风险和逾期事项优先进入这里。</p>
          </div>
        </div>
        <div class="work-list">
          <button v-for="issue in attentionIssues.slice(0, 6)" :key="issue.id" class="work-row" type="button" @click="$emit('open-issue', issue.id)">
            <span>
              <strong>{{ issue.title }}</strong>
              <small>{{ issue.code }} · {{ projectName(issue.projectId) }} · {{ issue.next }}</small>
            </span>
            <span class="work-tags">
              <PriorityPill :priority="issue.priority" />
              <span>{{ issue.actualHours }}/{{ issue.estimatedHours }}h</span>
              <span>{{ issue.dueDate }}</span>
            </span>
          </button>
          <p v-if="!attentionIssues.length" class="quiet-text">暂无需要项目经理介入的事项。</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>项目组合信号</h2>
            <p>用来决定今天先看哪个项目。</p>
          </div>
        </div>
        <div class="signal-list">
          <article v-for="row in riskSortedProjects.slice(0, 4)" :key="row.id">
            <strong>{{ row.name }}</strong>
            <span>健康度 {{ row.summary.health }} · 风险 {{ row.summary.riskCount }} · 待办 {{ row.summary.openCount }}</span>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
import PriorityPill from "../components/common/PriorityPill.vue";
import ProgressBar from "../components/common/ProgressBar.vue";

const props = defineProps({
  projects: { type: Array, required: true },
  projectRows: { type: Array, required: true },
  openIssues: { type: Array, required: true },
  riskyIssues: { type: Array, required: true },
});

defineEmits(["open-project", "open-issue"]);

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

const attentionIssues = computed(() => props.openIssues.filter((issue) => {
  const overdue = issue.dueDate && new Date(issue.dueDate) < new Date();
  return issue.priority === "P0" || issue.type === "风险" || overdue;
}));

const riskSortedProjects = computed(() => [...props.projectRows].sort((a, b) => {
  if (b.summary.riskCount !== a.summary.riskCount) return b.summary.riskCount - a.summary.riskCount;
  return a.summary.health - b.summary.health;
}));

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}
</script>
