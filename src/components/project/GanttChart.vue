<template>
  <section class="gantt">
    <div class="gantt-head">
      <div>
        <h2>甘特图</h2>
        <p>任务信息保持可见，时间轴可独立横向浏览。</p>
      </div>
      <span class="pill neutral">{{ issues.length }} 个任务</span>
    </div>

    <div v-if="issues.length" class="gantt-workspace" :style="timelineStyle">
      <div class="gantt-task-column">
        <div class="gantt-task-header">事项</div>
        <button
          v-for="issue in sortedIssues"
          :key="issue.id"
          class="gantt-task-row"
          type="button"
          @click="$emit('open', issue.id)"
        >
          <strong>{{ issue.title }}</strong>
          <small>{{ issue.code }} · {{ issue.owner }}</small>
        </button>
      </div>

      <div class="gantt-timeline-scroll" tabindex="0" aria-label="甘特图时间轴，可横向滚动">
        <div class="gantt-timeline">
          <div class="gantt-ticks">
            <span v-for="day in days" :key="day.key" :class="{ today: day.isToday }">
              <b>{{ day.day }}</b><small>{{ day.weekday }}</small>
            </span>
          </div>
          <div v-if="todayColumn" class="gantt-today-line" :style="todayLineStyle" aria-label="今天"></div>
          <div v-for="issue in sortedIssues" :key="`lane-${issue.id}`" class="gantt-lane">
            <button
              class="gantt-bar"
              :class="[barTone(issue), { milestone: isMilestone(issue) }]"
              :style="barGrid(issue)"
              type="button"
              :title="`${issue.title}：${issue.startDate || '未设开始'} 至 ${issue.dueDate || '未设结束'}`"
              @click="$emit('open', issue.id)"
            >
              <span>{{ issue.status }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="issues.length" class="gantt-mobile-list">
      <button v-for="issue in sortedIssues" :key="`mobile-${issue.id}`" class="gantt-mobile-card" type="button" @click="$emit('open', issue.id)">
        <strong class="truncate">{{ issue.title }}</strong>
        <small>{{ issue.code }} · {{ issue.owner }}</small>
        <span class="mobile-card-meta">
          <span>{{ issue.startDate || "未设开始" }} - {{ issue.dueDate || "未设结束" }}</span>
          <span class="pill neutral">{{ issue.status }}</span>
        </span>
      </button>
    </div>

    <EmptyState
      v-else
      title="暂无可展示任务"
      description="补充任务的开始日期和结束日期后，甘特图会展示排期跨度。"
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

const sortedIssues = computed(() => [...props.issues].sort((a, b) => dateValue(a.startDate || a.dueDate) - dateValue(b.startDate || b.dueDate)));
const range = computed(() => {
  const values = props.issues.flatMap((issue) => [issue.startDate, issue.dueDate]).filter(Boolean).map(parseDate).filter(Boolean);
  if (!values.length) {
    const today = startOfDay(new Date());
    return { start: addDays(today, -1), end: addDays(today, 14) };
  }
  const minimum = new Date(Math.min(...values.map((date) => date.getTime())));
  const maximum = new Date(Math.max(...values.map((date) => date.getTime())));
  return { start: addDays(minimum, -1), end: addDays(maximum, 1) };
});
const days = computed(() => {
  const count = Math.max(1, daysBetween(range.value.start, range.value.end) + 1);
  const todayKey = formatDate(new Date());
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(range.value.start, index);
    return {
      key: formatDate(date),
      day: String(date.getDate()).padStart(2, "0"),
      weekday: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()],
      isToday: formatDate(date) === todayKey,
    };
  });
});
const todayColumn = computed(() => days.value.findIndex((day) => day.isToday) + 1 || 0);
const timelineStyle = computed(() => ({
  "--gantt-day-count": days.value.length,
  "--gantt-timeline-width": `${Math.max(720, days.value.length * 36)}px`,
}));
const todayLineStyle = computed(() => ({ left: `${((todayColumn.value - 0.5) / days.value.length) * 100}%` }));

function barGrid(issue) {
  const start = parseDate(issue.startDate || issue.dueDate) || range.value.start;
  const end = parseDate(issue.dueDate || issue.startDate) || start;
  const column = Math.max(1, Math.min(days.value.length, daysBetween(range.value.start, start) + 1));
  const span = Math.max(1, Math.min(days.value.length - column + 1, daysBetween(start, end) + 1));
  return { gridColumn: `${column} / span ${span}` };
}

function barTone(issue) {
  if (isOverdue(issue)) return "danger";
  if (["已验收", "已完成"].includes(issue.status)) return "success";
  if (issue.status === "进行中") return "info";
  return "neutral";
}

function isMilestone(issue) {
  return Boolean(issue.startDate && issue.startDate === issue.dueDate);
}

function isOverdue(issue) {
  const due = parseDate(issue.dueDate);
  return Boolean(due && due < startOfDay(new Date()) && !["已验收", "已完成"].includes(issue.status));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value) {
  return parseDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function daysBetween(start, end) {
  return Math.round((startOfDay(end) - startOfDay(start)) / 86400000);
}

function formatDate(value) {
  const date = startOfDay(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
</script>
