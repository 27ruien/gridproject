<template>
  <section class="gantt">
    <div class="gantt-head">
      <div>
        <h2>甘特图</h2>
        <p>任务身份固定在左侧，时间轴仅在内部横向浏览。</p>
      </div>
      <span class="pill neutral">{{ filteredRows.length }} / {{ schedulableIssues.length }} 个任务</span>
    </div>

    <div class="gantt-toolbar" aria-label="甘特图工具栏">
      <div class="segmented-control" role="group" aria-label="时间尺度">
        <button
          v-for="option in scaleOptions"
          :key="option.value"
          type="button"
          :class="{ active: timeScale === option.value }"
          @click="timeScale = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <Button variant="ghost" size="small" @click="jumpToday">跳转今天</Button>
      <label class="gantt-search">
        <span>搜索</span>
        <input v-model="search" type="search" placeholder="任务、编号、负责人" />
      </label>
      <label class="gantt-filter">
        <span>状态</span>
        <select v-model="statusFilter">
          <option value="">全部状态</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <label class="gantt-check-filter">
        <input v-model="overdueOnly" type="checkbox" />
        <span>仅看逾期</span>
      </label>
      <Button variant="ghost" size="small" @click="setAllCollapsed(true)">折叠阶段</Button>
      <Button variant="ghost" size="small" @click="setAllCollapsed(false)">展开阶段</Button>
    </div>

    <div v-if="loading" class="gantt-state-row">正在加载排期...</div>
    <div v-else-if="error" class="gantt-state-row danger">{{ error }}</div>

    <div v-else-if="filteredRows.length" class="gantt-workspace" :style="timelineStyle">
      <div class="gantt-task-column">
        <div class="gantt-task-header gantt-task-grid">
          <span>阶段 / 任务</span>
          <span>负责人</span>
          <span>状态</span>
          <span>日期</span>
        </div>
        <template v-for="group in visibleGroups" :key="group.key">
          <button class="gantt-phase-row" type="button" @click="toggleGroup(group.key)">
            <span>{{ collapsedGroups.has(group.key) ? "展开" : "收起" }}</span>
            <strong>{{ group.label }}</strong>
            <small>{{ group.rows.length }} 项</small>
          </button>
          <button
            v-for="issue in group.rows"
            v-show="!collapsedGroups.has(group.key)"
            :key="issue.id"
            class="gantt-task-row gantt-task-grid"
            type="button"
            :title="issue.title"
            @click="$emit('open', issue.id)"
          >
            <span class="gantt-title">
              <strong>{{ issue.title }}</strong>
              <small>{{ issue.code }} · {{ issue.type }}</small>
            </span>
            <span>{{ issue.owner || "未分配" }}</span>
            <StatusLozenge :label="issue.status" />
            <span>{{ dateRange(issue) }}</span>
          </button>
        </template>
      </div>

      <div ref="timelineScroll" class="gantt-timeline-scroll" tabindex="0" aria-label="甘特图时间轴，可横向滚动">
        <div class="gantt-timeline">
          <div class="gantt-ticks">
            <span
              v-for="tick in ticks"
              :key="tick.key"
              :class="{ today: tick.isToday, weekend: tick.isWeekend }"
            >
              <b>{{ tick.primary }}</b><small>{{ tick.secondary }}</small>
            </span>
          </div>
          <div v-if="todayColumn" class="gantt-today-line" :style="todayLineStyle" aria-label="今天"></div>
          <template v-for="group in visibleGroups" :key="`timeline-${group.key}`">
            <div class="gantt-phase-lane">
              <span>{{ group.label }}</span>
            </div>
            <div
              v-for="issue in group.rows"
              v-show="!collapsedGroups.has(group.key)"
              :key="`lane-${issue.id}`"
              class="gantt-lane"
              :class="{ overdue: isOverdue(issue), weekend: hasWeekend(issue) }"
            >
              <button
                class="gantt-bar"
                :class="[barTone(issue), { milestone: isMilestone(issue) }]"
                :style="barGrid(issue)"
                type="button"
                :title="`${issue.title}: ${issue.startDate || '未设开始'} 至 ${issue.dueDate || '未设结束'}`"
                @click="$emit('open', issue.id)"
              >
                <span>{{ isMilestone(issue) ? "◆" : issue.status }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && filteredRows.length" class="gantt-mobile-list">
      <p class="gantt-mobile-note">移动端以排期列表查看；桌面甘特图请在更宽屏幕中打开。</p>
      <section v-for="group in visibleGroups" :key="`mobile-${group.key}`" class="gantt-mobile-group">
        <header>
          <strong>{{ group.label }}</strong>
          <span>{{ group.rows.length }} 项</span>
        </header>
        <button v-for="issue in group.rows" :key="`mobile-${issue.id}`" class="gantt-mobile-card" type="button" @click="$emit('open', issue.id)">
          <span class="mobile-card-meta">
            <strong class="truncate">{{ issue.title }}</strong>
            <StatusLozenge :label="issue.status" />
          </span>
          <small>{{ issue.code }} · {{ issue.owner || "未分配" }} · {{ dateRange(issue) }}</small>
          <span class="mobile-card-meta">
            <span :class="{ danger: isOverdue(issue) }">{{ isOverdue(issue) ? "已逾期" : "排期正常" }}</span>
            <span v-if="isMilestone(issue)" class="pill neutral">里程碑</span>
          </span>
        </button>
      </section>
    </div>

    <EmptyState
      v-if="!loading && !error && !filteredRows.length"
      title="暂无可展示任务"
      description="补充任务的开始日期和结束日期后，甘特图会展示排期跨度。"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import Button from "../ui/Button.vue";
import StatusLozenge from "../ui/StatusLozenge.vue";
import EmptyState from "../common/EmptyState.vue";

const props = defineProps({
  issues: { type: Array, required: true },
  project: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

defineEmits(["open"]);

const scaleOptions = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];
const timeScale = ref("day");
const search = ref("");
const statusFilter = ref("");
const overdueOnly = ref(false);
const collapsedGroups = ref(new Set());
const timelineScroll = ref(null);

const schedulableIssues = computed(() => props.issues.filter((issue) => issue.startDate || issue.dueDate));
const statusOptions = computed(() => [...new Set(schedulableIssues.value.map((issue) => issue.status).filter(Boolean))]);
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return schedulableIssues.value
    .filter((issue) => !keyword || `${issue.code} ${issue.title} ${issue.owner} ${issue.type} ${issue.status}`.toLowerCase().includes(keyword))
    .filter((issue) => !statusFilter.value || issue.status === statusFilter.value)
    .filter((issue) => !overdueOnly.value || isOverdue(issue))
    .sort((a, b) => dateValue(a.startDate || a.dueDate) - dateValue(b.startDate || b.dueDate));
});
const visibleGroups = computed(() => {
  const groups = new Map();
  filteredRows.value.forEach((issue) => {
    const group = groupForIssue(issue);
    if (!groups.has(group.key)) groups.set(group.key, { ...group, rows: [] });
    groups.get(group.key).rows.push(issue);
  });
  return [...groups.values()].sort((a, b) => groupDate(a) - groupDate(b));
});
const range = computed(() => {
  const values = filteredRows.value.flatMap((issue) => [issue.startDate, issue.dueDate]).filter(Boolean).map(parseDate).filter(Boolean);
  if (!values.length) {
    const today = startOfDay(new Date());
    return { start: addDays(today, -1), end: addDays(today, 14) };
  }
  const minimum = new Date(Math.min(...values.map((date) => date.getTime())));
  const maximum = new Date(Math.max(...values.map((date) => date.getTime())));
  return { start: addDays(minimum, -1), end: addDays(maximum, 1) };
});
const ticks = computed(() => buildTicks(range.value.start, range.value.end, timeScale.value));
const todayColumn = computed(() => {
  const index = tickIndexForDate(new Date());
  return index >= 0 ? index + 1 : 0;
});
const todayLineStyle = computed(() => ({ left: `${((todayColumn.value - 0.5) / ticks.value.length) * 100}%` }));
const timelineStyle = computed(() => ({
  "--gantt-tick-count": ticks.value.length,
  "--gantt-timeline-width": `${Math.max(760, ticks.value.length * tickWidth(timeScale.value))}px`,
}));

watch([timeScale, filteredRows], () => {
  collapsedGroups.value = new Set([...collapsedGroups.value].filter((key) => visibleGroups.value.some((group) => group.key === key)));
});

function toggleGroup(key) {
  const next = new Set(collapsedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedGroups.value = next;
}

function setAllCollapsed(collapsed) {
  collapsedGroups.value = collapsed ? new Set(visibleGroups.value.map((group) => group.key)) : new Set();
}

function jumpToday() {
  nextTick(() => {
    const index = Math.max(0, todayColumn.value - 1);
    const scroller = timelineScroll.value;
    if (!scroller || !ticks.value.length) return;
    const target = (index / ticks.value.length) * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  });
}

function groupForIssue(issue) {
  if (issue.scheduleModel) return { key: `schedule-${issue.scheduleModel}`, label: issue.scheduleModel };
  const milestone = nearestMilestone(issue);
  if (milestone) return { key: `milestone-${milestone.id || milestone.name}`, label: milestone.name };
  if (issue.type === "风险") return { key: "risk", label: "风险" };
  if (["已完成", "已验收", "已关闭"].includes(issue.status)) return { key: "done", label: "完成与验收" };
  if (issue.status === "进行中") return { key: "progress", label: "进行中" };
  return { key: "planned", label: "待启动" };
}

function nearestMilestone(issue) {
  const milestones = props.project?.milestones || [];
  const issueDate = parseDate(issue.dueDate || issue.startDate);
  if (!issueDate || !milestones.length) return null;
  return milestones
    .filter((milestone) => milestone.dueDate)
    .map((milestone) => ({ milestone, distance: Math.abs(dateValue(milestone.dueDate) - issueDate.getTime()) }))
    .sort((a, b) => a.distance - b.distance)[0]?.milestone || null;
}

function groupDate(group) {
  return Math.min(...group.rows.map((issue) => dateValue(issue.startDate || issue.dueDate)));
}

function barGrid(issue) {
  const start = parseDate(issue.startDate || issue.dueDate) || range.value.start;
  const end = parseDate(issue.dueDate || issue.startDate) || start;
  const startColumn = Math.max(1, tickIndexForDate(start) + 1);
  const endColumn = Math.max(startColumn, tickIndexForDate(end) + 1);
  return { gridColumn: `${startColumn} / ${endColumn + 1}` };
}

function tickIndexForDate(value) {
  const target = startOfDay(value);
  const index = ticks.value.findIndex((tick) => target >= tick.start && target <= tick.end);
  return index < 0 ? -1 : index;
}

function buildTicks(start, end, scale) {
  if (scale === "month") return buildMonthTicks(start, end);
  if (scale === "week") return buildWeekTicks(start, end);
  const count = Math.max(1, daysBetween(start, end) + 1);
  const todayKey = formatDate(new Date());
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index);
    const key = formatDate(date);
    return {
      key,
      start: startOfDay(date),
      end: startOfDay(date),
      primary: String(date.getDate()).padStart(2, "0"),
      secondary: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()],
      isWeekend: [0, 6].includes(date.getDay()),
      isToday: key === todayKey,
    };
  });
}

function buildWeekTicks(start, end) {
  const cursor = startOfWeek(start);
  const result = [];
  const today = startOfDay(new Date());
  while (cursor <= end) {
    const tickStart = startOfDay(cursor);
    const tickEnd = addDays(tickStart, 6);
    result.push({
      key: `week-${formatDate(tickStart)}`,
      start: tickStart,
      end: tickEnd,
      primary: `${tickStart.getMonth() + 1}/${tickStart.getDate()}`,
      secondary: "周",
      isWeekend: false,
      isToday: today >= tickStart && today <= tickEnd,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
}

function buildMonthTicks(start, end) {
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const result = [];
  const today = startOfDay(new Date());
  while (cursor <= end) {
    const tickStart = startOfDay(cursor);
    const tickEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    result.push({
      key: `month-${formatDate(tickStart)}`,
      start: tickStart,
      end: startOfDay(tickEnd),
      primary: `${tickStart.getMonth() + 1}月`,
      secondary: String(tickStart.getFullYear()),
      isWeekend: false,
      isToday: today >= tickStart && today <= tickEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function barTone(issue) {
  if (isOverdue(issue)) return "danger";
  if (["已验收", "已完成", "已关闭"].includes(issue.status)) return "success";
  if (issue.status === "进行中") return "info";
  return "neutral";
}

function isMilestone(issue) {
  return Boolean(issue.startDate && issue.startDate === issue.dueDate);
}

function isOverdue(issue) {
  const due = parseDate(issue.dueDate);
  return Boolean(due && due < startOfDay(new Date()) && !["已验收", "已完成", "已关闭"].includes(issue.status));
}

function hasWeekend(issue) {
  const start = parseDate(issue.startDate || issue.dueDate);
  const end = parseDate(issue.dueDate || issue.startDate);
  if (!start || !end) return false;
  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    if ([0, 6].includes(cursor.getDay())) return true;
  }
  return false;
}

function dateRange(issue) {
  return `${issue.startDate || "未设开始"} - ${issue.dueDate || "未设结束"}`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value) {
  return parseDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
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

function tickWidth(scale) {
  if (scale === "month") return 132;
  if (scale === "week") return 78;
  return 38;
}

function formatDate(value) {
  const date = startOfDay(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
</script>
