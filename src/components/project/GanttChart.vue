<template>
  <section class="gantt">
    <div class="gantt-head">
      <div>
        <h2>甘特图</h2>
        <p>按任务起止日期查看排期、负责人和当前状态。</p>
      </div>
      <span class="pill neutral">{{ issues.length }} 个任务</span>
    </div>

    <div v-if="issues.length" class="gantt-grid" :style="{ '--tick-count': ticks.length }">
      <div class="gantt-axis">
        <span class="gantt-task-heading">事项</span>
        <div class="gantt-ticks">
          <span v-for="tick in ticks" :key="tick">{{ tick.slice(5) }}</span>
        </div>
      </div>
      <button v-for="issue in sortedIssues" :key="issue.id" class="gantt-row" type="button" @click="$emit('open', issue.id)">
        <span class="gantt-title">
          <strong>{{ issue.title }}</strong>
          <small>{{ issue.code }} · {{ issue.owner }} · {{ issue.startDate || "未设开始" }} - {{ issue.dueDate || "未设截止" }}</small>
        </span>
        <span class="gantt-lane">
          <span
            class="gantt-bar"
            :class="barTone(issue)"
            :style="{ left: `${barPosition(issue).left}%`, width: `${barPosition(issue).width}%` }"
          >
            {{ issue.status }}
          </span>
        </span>
      </button>
    </div>
    <div v-if="issues.length" class="gantt-mobile-list">
      <button v-for="issue in sortedIssues" :key="`mobile-${issue.id}`" class="gantt-mobile-card" type="button" @click="$emit('open', issue.id)">
        <strong class="truncate">{{ issue.title }}</strong>
        <small>{{ issue.code }} · {{ issue.owner }}</small>
        <span class="mobile-card-meta">
          <span>{{ issue.startDate || "未设开始" }} - {{ issue.dueDate || "未设截止" }}</span>
          <span class="pill neutral">{{ issue.status }}</span>
        </span>
      </button>
    </div>

    <EmptyState
      v-else
      title="暂无可展示任务"
      description="补充任务的开始日期和截止日期后，甘特图会展示排期跨度。"
    />
  </section>
</template>

<script setup>
import { computed } from "vue";
import EmptyState from "../common/EmptyState.vue";

const props = defineProps({
  issues: { type: Array, required: true },
});

defineEmits(["open"]);

const sortedIssues = computed(() => [...props.issues].sort((a, b) => normalizeDate(a.startDate || a.dueDate) - normalizeDate(b.startDate || b.dueDate)));

const range = computed(() => {
  const dates = props.issues.flatMap((issue) => [issue.startDate, issue.dueDate]).filter(Boolean).map((value) => normalizeDate(value));
  if (!dates.length) {
    const now = new Date();
    return { start: now, end: addDays(now, 14) };
  }
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  return { start: addDays(min, -1), end: addDays(max, 1) };
});

const totalDays = computed(() => Math.max(1, daysBetween(range.value.start, range.value.end)));
const ticks = computed(() => {
  const count = Math.min(6, totalDays.value + 1);
  return Array.from({ length: count }, (_, index) => {
    const offset = Math.round((totalDays.value / Math.max(1, count - 1)) * index);
    return formatDate(addDays(range.value.start, offset));
  });
});

function barPosition(issue) {
  const start = normalizeDate(issue.startDate || issue.dueDate || formatDate(range.value.start));
  const end = normalizeDate(issue.dueDate || issue.startDate || formatDate(addDays(start, 1)));
  const left = Math.max(0, Math.min(96, (daysBetween(range.value.start, start) / totalDays.value) * 100));
  const width = Math.max(4, Math.min(100 - left, (Math.max(1, daysBetween(start, end) + 1) / totalDays.value) * 100));
  return { left, width };
}

function barTone(issue) {
  if (issue.priority === "P0") return "danger";
  if (issue.status === "已验收" || issue.status === "已完成") return "success";
  if (issue.status === "进行中") return "info";
  return "neutral";
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(start, end) {
  return Math.round((normalizeDate(end) - normalizeDate(start)) / 86400000);
}

function formatDate(date) {
  return normalizeDate(date).toISOString().slice(0, 10);
}
</script>
