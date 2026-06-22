<template>
  <section class="view-stack timesheet-view">
    <div class="panel timesheet-workspace">
      <div class="panel-head">
        <div>
          <p class="eyebrow">工时填报</p>
          <h2>按周录入，按项目和事项归集</h2>
          <p>桌面端以周视图快速填报；移动端按日期纵向录入，不压缩七列表格。</p>
        </div>
        <div class="section-actions">
          <Button variant="ghost" size="small" @click="openCreate()">添加一条</Button>
          <Button variant="primary" size="small" :disabled="!dirtyCells.size" @click="saveWeek">保存本周</Button>
        </div>
      </div>

      <div class="timesheet-week-toolbar">
        <div class="segmented-control" role="tablist" aria-label="工时范围">
          <button type="button" role="tab" :aria-selected="roleView === 'submitted'" :class="{ active: roleView === 'submitted' }" @click="roleView = 'submitted'">我提交的</button>
          <button type="button" role="tab" :aria-selected="roleView === 'owned'" :class="{ active: roleView === 'owned' }" @click="roleView = 'owned'">我负责的</button>
        </div>
        <div class="week-switcher" aria-label="周切换">
          <Button variant="ghost" size="small" @click="moveWeek(-1)">上一周</Button>
          <strong>{{ weekRangeLabel }}</strong>
          <Button variant="ghost" size="small" @click="moveWeek(1)">下一周</Button>
          <Button variant="ghost" size="small" @click="setThisWeek">回到本周</Button>
        </div>
        <div class="timesheet-save-state">
          <span>{{ submitStateLabel }}</span>
          <strong>{{ dirtyCells.size ? `未保存 ${dirtyCells.size} 项` : saveState }}</strong>
        </div>
      </div>

      <div class="timesheet-week-summary" aria-label="本周工时摘要">
        <div><span>本周总工时</span><strong>{{ weekTotal }}h</strong></div>
        <div><span>缺失工作日</span><strong>{{ missingWeekDates.length }} 天</strong></div>
        <div><span>异常提示</span><strong :class="{ danger: abnormalDays.length }">{{ abnormalDays.length }} 项</strong></div>
        <div><span>审批状态</span><strong class="timesheet-status-summary">{{ statusSummary }}</strong></div>
      </div>

      <div v-if="missingWeekDates.length || abnormalDays.length" class="timesheet-alert-strip">
        <span v-if="missingWeekDates.length">待补：{{ missingWeekDates.map((date) => date.slice(5)).join("、") }}</span>
        <span v-if="abnormalDays.length" class="danger">单日超过 10h：{{ abnormalDays.map((item) => `${item.date.slice(5)} ${item.hours}h`).join("、") }}</span>
      </div>

      <div v-if="weekRows.length" class="timesheet-week-table" role="table" aria-label="周工时填报表">
        <div class="timesheet-week-head" role="row">
          <span>项目 / 事项</span>
          <span v-for="day in weekDays" :key="day.date">{{ day.label }}<small>{{ day.shortDate }}</small></span>
          <span>合计</span>
        </div>
        <template v-for="group in groupedRows" :key="group.project.id">
          <div class="timesheet-project-row">
            <strong>{{ group.project.name }}</strong>
            <small>{{ group.rows.length }} 个事项</small>
          </div>
          <div v-for="row in group.rows" :key="row.key" class="timesheet-week-row" role="row">
            <span class="timesheet-issue-cell">
              <strong>{{ row.issue.title }}</strong>
              <small>{{ row.issue.code }} · {{ row.issue.owner || "未分配" }}</small>
            </span>
            <label v-for="day in weekDays" :key="`${row.key}-${day.date}`" class="timesheet-hour-cell">
              <span class="sr-only">{{ row.issue.title }} {{ day.date }} 工时</span>
              <input
                :value="draftHours[cellKey(row, day.date)] ?? ''"
                :disabled="!canEditCell(row, day.date)"
                inputmode="decimal"
                min="0"
                max="24"
                step="0.5"
                type="number"
                @input="setDraftHour(row, day.date, $event.target.value)"
              />
            </label>
            <strong>{{ rowTotal(row) }}h</strong>
          </div>
        </template>
        <div class="timesheet-week-total-row">
          <strong>每日合计</strong>
          <strong v-for="day in weekDays" :key="`total-${day.date}`">{{ dayTotal(day.date) }}h</strong>
          <strong>{{ weekTotal }}h</strong>
        </div>
      </div>

      <div class="timesheet-mobile-list">
        <section v-for="day in weekDays" :key="`mobile-${day.date}`" class="timesheet-day-group">
          <header>
            <div><strong>{{ day.fullLabel }}</strong><small>{{ dayTotal(day.date) }}h</small></div>
            <Button variant="ghost" size="tiny" @click="openCreate(day.date)">添加一条</Button>
          </header>
          <div class="timesheet-day-lines">
            <label v-for="row in mobileRowsForDay(day.date)" :key="`${day.date}-${row.key}`" class="timesheet-day-line">
              <span>
                <strong>{{ row.issue.title }}</strong>
                <small>{{ row.project.name }} · {{ row.issue.owner || "未分配" }}</small>
              </span>
              <input
                :value="draftHours[cellKey(row, day.date)] ?? ''"
                :disabled="!canEditCell(row, day.date)"
                inputmode="decimal"
                min="0"
                max="24"
                step="0.5"
                type="number"
                @input="setDraftHour(row, day.date, $event.target.value)"
              />
            </label>
          </div>
        </section>
      </div>

      <div v-if="weekEntries.length" class="timesheet-review-list">
        <div class="section-head">
          <div>
            <h3>本周记录</h3>
            <small>保留现有单条提交、审批、驳回和删除规则。</small>
          </div>
        </div>
        <div class="timesheet-record-row" v-for="entry in weekEntries" :key="entry.id">
          <span><strong>{{ displayDate(entry) }}</strong><small>{{ entry.reporter }}</small></span>
          <span><strong>{{ projectName(entry.projectId) }}</strong><small>{{ issueName(entry.issueId) }}</small></span>
          <span>{{ entry.hours }}h</span>
          <StatusLozenge :label="statusDisplay(entry.status)" />
          <span class="user-actions">
            <Button v-if="canEdit(entry)" variant="ghost" size="tiny" @click="openEdit(entry)">编辑</Button>
            <Button v-if="canDelete(entry)" variant="ghost" size="tiny" @click="emit('delete', entry.id)">删除</Button>
            <Button v-if="canSubmitEntry(entry)" variant="ghost" size="tiny" @click="emit('submit', entry.id)">提交</Button>
            <Button v-if="canApprove(entry)" variant="ghost" size="tiny" @click="emit('approve', entry.id)">审批</Button>
            <Button v-if="canApprove(entry)" variant="ghost" size="tiny" @click="emit('reject', entry.id)">驳回</Button>
          </span>
        </div>
      </div>

      <EmptyState
        v-if="!weekRows.length"
        title="暂无可填报事项"
        description="当前范围内没有可关联的项目事项，或你还没有可访问的项目。"
        action="添加一条"
        @action="openCreate"
      />
    </div>

    <Modal
      :open="modalOpen"
      :title="editingId ? '编辑单条工时' : '添加一条工时'"
      eyebrow="工时填报"
      size="large"
      @close="modalOpen = false"
    >
      <div class="form-two">
        <label>
          <span>申报人</span>
          <PersonPicker v-model="form.reporter" :people="people" title="选择申报人" />
        </label>
        <label>
          <span>日期</span>
          <input v-model="form.spentDate" type="date" />
        </label>
        <label>
          <span>项目</span>
          <select v-model="form.projectId" @change="syncFormIssue">
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <label>
          <span>事项</span>
          <select v-model="form.issueId">
            <option v-for="issue in issuesByProject(form.projectId)" :key="issue.id" :value="issue.id">{{ issue.title }}</option>
          </select>
        </label>
        <label>
          <span>工时</span>
          <input v-model.number="form.hours" min="0.5" max="24" step="0.5" type="number" />
        </label>
        <label>
          <span>说明</span>
          <input v-model="form.note" placeholder="本次投入内容" />
        </label>
      </div>

      <template #footer>
        <Button variant="ghost" @click="modalOpen = false">取消</Button>
        <Button variant="primary" :disabled="!canSubmitModal" @click="submitModal">保存</Button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import PersonPicker from "../components/common/PersonPicker.vue";
import EmptyState from "../components/common/EmptyState.vue";
import Button from "../components/ui/Button.vue";
import Modal from "../components/ui/Modal.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import { isReportableDate } from "../services/timesheetPolicyService.js";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  people: { type: Array, required: true },
  managerName: { type: String, required: true },
  context: { type: Object, required: true },
});

const emit = defineEmits(["create", "update", "delete", "submit", "approve", "reject"]);

const TIME_ENTRY_STATUS_ORDER = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
const TIME_ENTRY_STATUS_LABELS = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};
const TIME_ENTRY_STATUS_ALIASES = {
  草稿: "DRAFT",
  已提交: "SUBMITTED",
  已审批: "APPROVED",
  已通过: "APPROVED",
  已驳回: "REJECTED",
};

const roleView = ref("submitted");
const weekStart = ref(mondayOf(new Date()));
const modalOpen = ref(false);
const editingId = ref("");
const saveState = ref("已保存");
const draftHours = reactive({});
const dirtyCells = ref(new Set());
const form = reactive({
  reporter: "",
  spentDate: "",
  projectId: "",
  issueId: "",
  hours: 1,
  note: "",
});

const weekDays = computed(() => Array.from({ length: 7 }, (_item, index) => {
  const date = addDays(parseDate(weekStart.value), index);
  return {
    date: formatDate(date),
    label: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
    shortDate: `${date.getMonth() + 1}/${date.getDate()}`,
    fullLabel: `${date.getMonth() + 1}月${date.getDate()}日 ${["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index]}`,
  };
}));
const weekRangeLabel = computed(() => `${weekDays.value[0].shortDate} - ${weekDays.value[6].shortDate}`);
const managedProjectIds = computed(() => props.projects.filter((project) => project.owner === props.managerName || project.ownerId === props.context.userId).map((project) => project.id));
const scopedProjectIds = computed(() => new Set(roleView.value === "owned" ? managedProjectIds.value : props.projects.map((project) => project.id)));
const scopedEntries = computed(() => props.timeEntries.filter((entry) => {
  if (roleView.value === "owned") return managedProjectIds.value.includes(entry.projectId);
  return entry.reporter === props.managerName || entry.userId === props.context.userId;
}));
const weekEntries = computed(() => scopedEntries.value.filter((entry) => weekDays.value.some((day) => day.date === displayDate(entry))));
const weekRows = computed(() => props.issues
  .filter((issue) => scopedProjectIds.value.has(issue.projectId))
  .filter((issue) => !["已完成", "已关闭", "已验收"].includes(issue.status) || weekEntries.value.some((entry) => entry.issueId === issue.id))
  .map((issue) => ({
    key: `${issue.projectId}:${issue.id}`,
    project: props.projects.find((project) => project.id === issue.projectId) || { id: issue.projectId, name: "未知项目" },
    issue,
  }))
  .sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN") || a.issue.code.localeCompare(b.issue.code, "zh-CN")));
const groupedRows = computed(() => {
  const groups = new Map();
  weekRows.value.forEach((row) => {
    if (!groups.has(row.project.id)) groups.set(row.project.id, { project: row.project, rows: [] });
    groups.get(row.project.id).rows.push(row);
  });
  return [...groups.values()];
});
const weekTotal = computed(() => trimNumber(weekDays.value.reduce((sum, day) => sum + dayTotal(day.date), 0)));
const missingWeekDates = computed(() => weekDays.value.filter((day) => isReportableDate(day.date) && dayTotal(day.date) <= 0).map((day) => day.date));
const abnormalDays = computed(() => weekDays.value
  .map((day) => ({ date: day.date, hours: dayTotal(day.date) }))
  .filter((item) => item.hours > 10));
const submitStateLabel = computed(() => roleView.value === "submitted" ? "我的提交" : "项目记录");
const statusSummary = computed(() => {
  const counts = weekEntries.value.reduce((map, entry) => {
    const status = normalizedStatus(entry.status);
    map.set(status, (map.get(status) || 0) + 1);
    return map;
  }, new Map());
  return counts.size
    ? TIME_ENTRY_STATUS_ORDER
      .filter((status) => counts.has(status))
      .map((status) => `${statusDisplay(status)} ${counts.get(status)}`)
      .join(" · ")
    : "暂无记录";
});
const canSubmitModal = computed(() => Boolean(form.reporter && form.spentDate && form.projectId && form.issueId && Number(form.hours) > 0));

watch([weekDays, weekRows, () => props.timeEntries], syncDraftHours, { immediate: true, deep: true });

function syncDraftHours() {
  weekRows.value.forEach((row) => {
    weekDays.value.forEach((day) => {
      const key = cellKey(row, day.date);
      if (dirtyCells.value.has(key)) return;
      const entry = cellEntry(row, day.date);
      draftHours[key] = entry?.hours || "";
    });
  });
}

function setDraftHour(row, date, value) {
  const key = cellKey(row, date);
  draftHours[key] = value === "" ? "" : Number(value);
  const next = new Set(dirtyCells.value);
  next.add(key);
  dirtyCells.value = next;
  saveState.value = "有未保存修改";
}

function saveWeek() {
  const createPayloads = [];
  dirtyCells.value.forEach((key) => {
    const meta = parseCellKey(key);
    const row = weekRows.value.find((item) => item.project.id === meta.projectId && item.issue.id === meta.issueId);
    if (!row) return;
    const hours = Number(draftHours[key]);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const entry = cellEntry(row, meta.date);
    const payload = {
      reporter: props.managerName,
      spentDate: meta.date,
      workDate: meta.date,
      projectId: meta.projectId,
      issueId: meta.issueId,
      hours,
      note: entry?.note || "",
    };
    if (entry?.id) emit("update", entry.id, payload);
    else createPayloads.push(payload);
  });
  if (createPayloads.length) emit("create", createPayloads);
  dirtyCells.value = new Set();
  saveState.value = "保存请求已发送";
}

function openCreate(preferredDate = "") {
  editingId.value = "";
  form.reporter = props.managerName;
  form.spentDate = preferredDate || weekDays.value.find((day) => isReportableDate(day.date))?.date || weekDays.value[0].date;
  form.projectId = props.projects[0]?.id || "";
  form.issueId = issuesByProject(form.projectId)[0]?.id || "";
  form.hours = 1;
  form.note = "";
  modalOpen.value = true;
}

function openEdit(entry) {
  editingId.value = entry.id;
  form.reporter = entry.reporter;
  form.spentDate = displayDate(entry);
  form.projectId = entry.projectId;
  form.issueId = entry.issueId;
  form.hours = entry.hours;
  form.note = entry.note || entry.description || "";
  modalOpen.value = true;
}

function submitModal() {
  if (!canSubmitModal.value) return;
  const payload = { ...form, workDate: form.spentDate };
  if (editingId.value) emit("update", editingId.value, payload);
  else emit("create", payload);
  modalOpen.value = false;
}

function syncFormIssue() {
  if (!issuesByProject(form.projectId).some((issue) => issue.id === form.issueId)) {
    form.issueId = issuesByProject(form.projectId)[0]?.id || "";
  }
}

function moveWeek(offset) {
  weekStart.value = formatDate(addDays(parseDate(weekStart.value), offset * 7));
  dirtyCells.value = new Set();
}

function setThisWeek() {
  weekStart.value = mondayOf(new Date());
  dirtyCells.value = new Set();
}

function mobileRowsForDay(date) {
  const rowsWithEntries = weekRows.value.filter((row) => cellEntry(row, date) || Number(draftHours[cellKey(row, date)]) > 0);
  return rowsWithEntries.length ? rowsWithEntries : weekRows.value.slice(0, 4);
}

function dayTotal(date) {
  return trimNumber(weekRows.value.reduce((sum, row) => sum + Number(draftHours[cellKey(row, date)] || 0), 0));
}

function rowTotal(row) {
  return trimNumber(weekDays.value.reduce((sum, day) => sum + Number(draftHours[cellKey(row, day.date)] || 0), 0));
}

function cellEntry(row, date) {
  return props.timeEntries.find((entry) => (
    entry.projectId === row.project.id &&
    entry.issueId === row.issue.id &&
    displayDate(entry) === date &&
    (entry.reporter === props.managerName || entry.userId === props.context.userId)
  ));
}

function canEditCell(row, date) {
  const entry = cellEntry(row, date);
  if (!entry) return roleView.value === "submitted" || props.context.isAdmin;
  return canEdit(entry);
}

function cellKey(row, date) {
  return `${row.project.id}::${row.issue.id}::${date}`;
}

function parseCellKey(key) {
  const [projectId, issueId, date] = key.split("::");
  return { projectId, issueId, date };
}

function issuesByProject(projectId) {
  return props.issues.filter((issue) => issue.projectId === projectId);
}

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function issueName(issueId) {
  return props.issues.find((issue) => issue.id === issueId)?.title || "未知任务";
}

function displayDate(entry) {
  return entry.spentDate || entry.workDate || "";
}

function canEdit(entry) {
  if (props.context.isAdmin) return true;
  return entry.userId === props.context.userId && ["DRAFT", "REJECTED"].includes(normalizedStatus(entry.status));
}

function canDelete(entry) {
  return canEdit(entry);
}

function canSubmitEntry(entry) {
  return entry.userId === props.context.userId && ["DRAFT", "REJECTED"].includes(normalizedStatus(entry.status));
}

function canApprove(entry) {
  const project = props.projects.find((item) => item.id === entry.projectId);
  return normalizedStatus(entry.status) === "SUBMITTED" && (props.context.isAdmin || project?.ownerId === props.context.userId);
}

function normalizedStatus(status) {
  if (TIME_ENTRY_STATUS_ALIASES[status]) return TIME_ENTRY_STATUS_ALIASES[status];
  if (TIME_ENTRY_STATUS_LABELS[status]) return status;
  return status || "SUBMITTED";
}

function statusDisplay(status) {
  return TIME_ENTRY_STATUS_LABELS[normalizedStatus(status)] || status || TIME_ENTRY_STATUS_LABELS.SUBMITTED;
}

function mondayOf(value) {
  const date = parseDate(formatDate(value));
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return formatDate(date);
}

function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00`);
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function formatDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function trimNumber(value) {
  return Number(Number(value || 0).toFixed(1));
}
</script>
