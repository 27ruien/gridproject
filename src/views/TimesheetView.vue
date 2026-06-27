<template>
  <section class="view-stack timesheet-view cost-time-workspace">
    <header class="timesheet-page-header">
      <div>
        <h1>工时填报</h1>
        <p>按项目记录和补充工时，统一管理提交、列表与成本。</p>
      </div>
    </header>

    <section class="timesheet-pending-panel" aria-label="待提交工时">
      <div class="timesheet-pending-top">
        <div>
          <h2>待提交工时</h2>
          <p>{{ pendingMonthHelper }}</p>
        </div>
        <div class="timesheet-month-switcher" aria-label="待提交月份">
          <Button variant="ghost" size="small" aria-label="上个月" @click="movePendingMonth(-1)">‹</Button>
          <strong>{{ pendingMonthLabel }}</strong>
          <Button variant="ghost" size="small" aria-label="下个月" :disabled="!canMovePendingNext" @click="movePendingMonth(1)">›</Button>
        </div>
        <Button v-if="hasReportableProjects && pendingDateItems.length" variant="primary" size="small" @click="openEarliestPending">去补工时</Button>
      </div>
      <div v-if="hasReportableProjects && pendingDateItems.length" class="pending-date-list" aria-label="待提交日期">
        <button
          v-for="item in pendingDateItems"
          :key="item.date"
          class="pending-date-tag"
          :class="{ draft: item.hasDraft }"
          type="button"
          @click="openDailySubmit(item.date)"
        >
          <span>{{ item.label }}</span>
          <small v-if="item.hasDraft">草稿</small>
        </button>
      </div>
      <p v-else class="timesheet-complete-state">当前月份没有待提交工作日。</p>
    </section>

    <div class="timesheet-role-tabs segmented-control" role="tablist" aria-label="工时范围">
      <button type="button" role="tab" :aria-selected="roleView === 'submitted'" :class="{ active: roleView === 'submitted' }" @click="roleView = 'submitted'">我的提交</button>
      <button type="button" role="tab" :aria-selected="roleView === 'owned'" :class="{ active: roleView === 'owned' }" @click="roleView = 'owned'">我负责的</button>
    </div>

    <template v-if="roleView === 'submitted'">
      <section class="timesheet-cycle-panel">
        <div class="section-head">
          <div>
            <h3>周期与填报方式</h3>
            <small>默认按周填写；按日提交用于快速补录单个历史工作日。</small>
          </div>
          <div class="segmented-control compact" role="group" aria-label="填报方式">
            <button type="button" class="active" @click="focusWeek">按周填写</button>
            <button type="button" @click="openDailySubmit()">按日提交</button>
          </div>
        </div>
        <div class="timesheet-week-toolbar">
          <div class="week-switcher" aria-label="周切换">
            <Button variant="ghost" size="small" @click="moveWeek(-1)">上一周</Button>
            <strong>{{ weekRangeLabel }}</strong>
            <Button variant="ghost" size="small" :disabled="isCurrentOrFutureWeek" @click="moveWeek(1)">下一周</Button>
            <Button variant="ghost" size="small" @click="setThisWeek">回到本周</Button>
          </div>
          <div v-if="addableProjects.length" class="timesheet-add-project">
            <select v-model="projectToAdd" aria-label="添加项目到本周">
              <option value="">添加项目到本周</option>
              <option v-for="project in addableProjects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select>
            <Button variant="ghost" size="small" :disabled="!projectToAdd" @click="addProjectRow">添加项目</Button>
          </div>
          <p v-else class="quiet-text timesheet-no-projects">暂无可添加项目</p>
        </div>
      </section>

      <div class="timesheet-week-summary" aria-label="本周工时摘要">
        <div class="total"><span>本周总工时</span><strong>{{ weekTotal }}h</strong></div>
        <div class="missing"><span>缺失工作日</span><strong>{{ missingWeekDates.length }} 天</strong></div>
        <div class="draft"><span>草稿</span><strong>{{ draftEntries.length }} 条</strong></div>
        <div class="submitted"><span>已提交</span><strong>{{ submittedEntries.length }} 条</strong></div>
      </div>

      <div v-if="missingWeekDates.length" class="timesheet-alert-strip">
        <span>待补：{{ missingWeekDates.map((date) => date.slice(5)).join("、") }}</span>
      </div>

      <div v-if="weekRows.length" class="timesheet-week-table" role="table" aria-label="周工时填报表">
        <div class="timesheet-week-head" role="row">
          <span>项目</span>
          <span v-for="day in weekDays" :key="day.date">{{ day.label }}<small>{{ day.shortDate }}</small></span>
          <span>合计</span>
        </div>
        <div v-for="row in weekRows" :key="row.project.id" class="timesheet-week-row project-timesheet-row" role="row">
          <span class="timesheet-issue-cell">
            <strong>{{ row.project.name }}</strong>
            <small v-if="row.project.code">项目代码：{{ row.project.code }}</small>
          </span>
          <button
            v-for="day in weekDays"
            :key="`${row.project.id}-${day.date}`"
            class="timesheet-hour-cell timesheet-cell-button"
            :class="{ disabled: !canEditDate(day.date), filled: dayProjectHours(row.project.id, day.date) > 0, submitted: isProjectDateSubmitted(row.project.id, day.date), draft: isProjectDateDraft(row.project.id, day.date) }"
            type="button"
            :disabled="!canEditDate(day.date)"
            @click="openWeekCell(row.project, day.date)"
          >
            <strong>{{ dayProjectHours(row.project.id, day.date) || "0" }}h</strong>
            <small>{{ dayProjectNote(row.project.id, day.date) || cellStateText(row.project.id, day.date) }}</small>
          </button>
          <strong>{{ projectWeekTotal(row.project.id) }}h</strong>
        </div>
        <div class="timesheet-week-total-row">
          <strong>每日合计</strong>
          <strong v-for="day in weekDays" :key="`total-${day.date}`">{{ dayTotal(day.date) }}h</strong>
          <strong>{{ weekTotal }}h</strong>
        </div>
      </div>

      <EmptyState
        v-else
        title="本周暂无项目工时"
        description="不会自动从项目事项生成工时行。请选择项目后开始填写。"
        :action="hasReportableProjects ? '按日提交' : ''"
        @action="openDailySubmit()"
      />

      <section class="timesheet-preview-list">
        <div class="section-head">
          <div>
            <h3>工时列表</h3>
            <small>最近 {{ recentPreviewEntries.length }} 条，仅作预览。</small>
          </div>
          <Button variant="ghost" size="small" @click="emit('open-list')">查看全部</Button>
        </div>
        <div v-if="recentPreviewEntries.length" class="timesheet-review-list compact-list">
          <div class="timesheet-record-row" v-for="entry in recentPreviewEntries" :key="entry.id">
            <span><strong>{{ displayDate(entry) }}</strong><small>{{ entry.reporter || currentUserName }}</small></span>
            <span><strong>{{ projectName(entry.projectId) }}</strong><small>{{ issueName(entry.issueId) || entry.note || "未关联事项" }}</small></span>
            <span>{{ entry.hours }}h</span>
            <StatusLozenge :label="statusDisplay(entry.status)" :tone="statusTone(entry.status)" />
            <span class="user-actions">
              <Button v-if="canEdit(entry)" variant="ghost" size="tiny" @click="openEntryEdit(entry)">编辑</Button>
              <Button v-if="canSubmitEntry(entry)" variant="ghost" size="tiny" @click="emit('submit', entry.id)">提交</Button>
            </span>
          </div>
        </div>
        <p v-else class="quiet-text">暂无工时记录。</p>
      </section>
    </template>

    <section v-else class="owned-timesheet-board">
      <div class="section-head">
        <div>
          <h3>我负责的</h3>
          <small>管理员查看全部；项目创建人或负责人查看自己负责项目，且不能替他人编辑或提交。</small>
        </div>
      </div>
      <div class="owned-timesheet-filters">
        <label><span>项目</span><select v-model="ownedFilters.projectId"><option value="">全部项目</option><option v-for="project in managedProjects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label>
        <label><span>人员</span><select v-model="ownedFilters.userId"><option value="">全部人员</option><option v-for="user in ownedPeopleOptions" :key="user.id" :value="user.id">{{ user.name }}</option></select></label>
        <label><span>开始</span><input v-model="ownedFilters.dateFrom" type="date" /></label>
        <label><span>结束</span><input v-model="ownedFilters.dateTo" type="date" /></label>
      </div>
      <div v-if="ownedRows.length" class="timesheet-review-list">
        <div class="timesheet-record-row" v-for="entry in ownedRows" :key="entry.id">
          <span><strong>{{ displayDate(entry) }}</strong><small>{{ entry.reporter || userName(entry.userId) }}</small></span>
          <span><strong>{{ projectName(entry.projectId) }}</strong><small>{{ issueName(entry.issueId) || "未关联事项" }}</small></span>
          <span>{{ entry.hours }}h</span>
          <StatusLozenge :label="statusDisplay(entry.status)" :tone="statusTone(entry.status)" />
          <span>{{ entry.note || entry.description || "无说明" }}</span>
        </div>
      </div>
      <EmptyState
        v-else
        title="暂无可查看工时"
        description="当前筛选范围内没有项目工时记录。"
      />
    </section>

    <Modal
      :open="cellModalOpen"
      title="填写工作日工时"
      eyebrow="按周填写"
      size="small"
      @close="closeCellModal"
    >
      <div class="form-two">
        <label>
          <span>日期</span>
          <input v-model="cellForm.spentDate" type="date" disabled />
        </label>
        <label>
          <span>项目</span>
          <input :value="projectName(cellForm.projectId)" disabled />
        </label>
        <label>
          <span>工时</span>
          <input v-model.number="cellForm.hours" min="0.1" max="24" step="0.5" type="number" />
        </label>
        <label>
          <span>关联事项（可选）</span>
          <select v-model="cellForm.issueId">
            <option value="">不关联事项</option>
            <option v-for="issue in issuesByProject(cellForm.projectId)" :key="issue.id" :value="issue.id">{{ issue.title }}</option>
          </select>
        </label>
      </div>
      <label>
        <span>说明</span>
        <textarea v-model="cellForm.note" rows="3" placeholder="今天完成了什么、遇到什么阻塞或需要同步什么" />
      </label>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <Button variant="ghost" @click="closeCellModal">取消</Button>
        <Button variant="primary" :disabled="cellSaving" @click="saveCell">{{ cellSaving ? "保存中" : "保存草稿" }}</Button>
      </template>
    </Modal>

    <Modal
      :open="dailyModalOpen"
      title="按日提交"
      eyebrow="工时填报"
      size="small"
      @close="closeDailyModal"
    >
      <div class="form-two">
        <label>
          <span>申报人</span>
          <input :value="currentUserName" disabled />
        </label>
        <label>
          <span>日期</span>
          <input v-model="dailyForm.spentDate" :max="today" type="date" />
        </label>
        <label>
          <span>项目</span>
          <select v-model="dailyForm.projectId" @change="syncDailyIssue">
            <option value="">选择项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <label>
          <span>工时</span>
          <input v-model.number="dailyForm.hours" min="0.1" max="24" step="0.5" type="number" />
        </label>
        <label class="full-field">
          <span>关联事项（可选）</span>
          <select v-model="dailyForm.issueId">
            <option value="">不关联事项</option>
            <option v-for="issue in issuesByProject(dailyForm.projectId)" :key="issue.id" :value="issue.id">{{ issue.title }}</option>
          </select>
        </label>
      </div>
      <label>
        <span>说明</span>
        <textarea v-model="dailyForm.note" rows="3" placeholder="说明是主要记录内容，可写交付、沟通、风险或下一步" />
      </label>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <Button variant="ghost" @click="closeDailyModal">取消</Button>
        <Button variant="primary" :disabled="dailySaving" @click="submitDaily">{{ dailySaving ? "提交中" : "提交" }}</Button>
      </template>
    </Modal>

    <Modal
      :open="resultModalOpen"
      title="工时已提交"
      eyebrow="提交结果"
      size="small"
      @close="resultModalOpen = false"
    >
      <div v-if="lastSubmitted" class="timesheet-result">
        <p><span>项目</span><strong>{{ projectName(lastSubmitted.projectId) }}</strong></p>
        <p><span>日期</span><strong>{{ displayDate(lastSubmitted) }}</strong></p>
        <p><span>工时</span><strong>{{ lastSubmitted.hours }}h</strong></p>
        <p><span>关联事项</span><strong>{{ issueName(lastSubmitted.issueId) || "无" }}</strong></p>
        <p><span>说明</span><strong>{{ lastSubmitted.note || lastSubmitted.description || "无说明" }}</strong></p>
      </div>
      <template #footer>
        <Button variant="ghost" @click="resultModalOpen = false">关闭</Button>
        <Button variant="primary" @click="goToSubmittedWeek">去查看</Button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import EmptyState from "../components/common/EmptyState.vue";
import Button from "../components/ui/Button.vue";
import Modal from "../components/ui/Modal.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";
import { filterTimeEntriesForScope, getManagedProjects, TIMESHEET_SCOPES } from "../services/timesheetAccessService.js";
import { currentMonthValue, getReportableDates, isReportableDate } from "../services/timesheetPolicyService.js";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  people: { type: Array, required: true },
  managerName: { type: String, required: true },
  context: { type: Object, required: true },
  projectMembers: { type: Array, default: () => [] },
  startAction: { type: Object, default: null },
});

const emit = defineEmits(["create", "update", "delete", "submit", "open-list", "start-action-handled"]);

const roleView = ref("submitted");
const weekStart = ref(mondayOf(new Date()));
const pendingMonth = ref(currentMonthValue(new Date()));
const projectToAdd = ref("");
const manualProjectIds = ref(new Set());
const cellModalOpen = ref(false);
const dailyModalOpen = ref(false);
const resultModalOpen = ref(false);
const cellSaving = ref(false);
const dailySaving = ref(false);
const editingEntryId = ref("");
const formError = ref("");
const lastSubmitted = ref(null);
const today = formatDate(new Date());
const cellForm = reactive(defaultTimeForm());
const dailyForm = reactive(defaultTimeForm({ status: "SUBMITTED" }));
const ownedFilters = reactive({ projectId: "", userId: "", dateFrom: "", dateTo: "" });

const currentUserName = computed(() => props.context.user?.name || props.managerName);
const hasReportableProjects = computed(() => props.projects.length > 0);
const weekDays = computed(() => Array.from({ length: 5 }, (_item, index) => {
  const date = addDays(parseDate(weekStart.value), index);
  return {
    date: formatDate(date),
    label: ["周一", "周二", "周三", "周四", "周五"][index],
    shortDate: `${date.getMonth() + 1}/${date.getDate()}`,
  };
}));
const weekRangeLabel = computed(() => `${weekDays.value[0].shortDate} - ${weekDays.value[4].shortDate}`);
const isCurrentOrFutureWeek = computed(() => weekStart.value >= mondayOf(new Date()));
const myEntries = computed(() => props.timeEntries.filter((entry) => isOwnEntry(entry)));
const weekEntries = computed(() => myEntries.value.filter((entry) => weekDays.value.some((day) => day.date === displayDate(entry))));
const draftEntries = computed(() => weekEntries.value.filter((entry) => normalizedStatus(entry.status) === "DRAFT"));
const submittedEntries = computed(() => weekEntries.value.filter((entry) => normalizedStatus(entry.status) === "SUBMITTED"));
const activeWeekProjectIds = computed(() => new Set([
  ...weekEntries.value.map((entry) => entry.projectId).filter(Boolean),
  ...manualProjectIds.value,
]));
const weekRows = computed(() => props.projects
  .filter((project) => activeWeekProjectIds.value.has(project.id))
  .map((project) => ({ project }))
  .sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN")));
const addableProjects = computed(() => props.projects.filter((project) => !activeWeekProjectIds.value.has(project.id)));
const weekTotal = computed(() => trimNumber(weekDays.value.reduce((sum, day) => sum + dayTotal(day.date), 0)));
const missingWeekDates = computed(() => weekDays.value.filter((day) => day.date <= today && isReportableDate(day.date) && dayTotal(day.date) <= 0).map((day) => day.date));
const managedProjects = computed(() => getManagedProjects(props.projects, props.context));
const managedProjectIds = computed(() => new Set(managedProjects.value.map((project) => project.id)));
const ownedEntries = computed(() => {
  if (!managedProjectIds.value.size) return [];
  return filterTimeEntriesForScope(props.timeEntries, {
    projects: props.projects,
    context: props.context,
    scope: props.context.isAdmin ? TIMESHEET_SCOPES.ALL : TIMESHEET_SCOPES.OWNED,
  });
});
const ownedRows = computed(() => ownedEntries.value
  .filter((entry) => !ownedFilters.projectId || entry.projectId === ownedFilters.projectId)
  .filter((entry) => !ownedFilters.userId || entry.userId === ownedFilters.userId)
  .filter((entry) => !ownedFilters.dateFrom || displayDate(entry) >= ownedFilters.dateFrom)
  .filter((entry) => !ownedFilters.dateTo || displayDate(entry) <= ownedFilters.dateTo)
  .sort((a, b) => displayDate(b).localeCompare(displayDate(a)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))));
const ownedPeopleOptions = computed(() => {
  const ids = new Set(ownedEntries.value.map((entry) => entry.userId).filter(Boolean));
  const fromEntries = ownedEntries.value
    .filter((entry) => entry.userId && entry.reporter)
    .map((entry) => ({ id: entry.userId, name: entry.reporter }));
  return fromEntries
    .concat(props.people
    .filter((user) => typeof user === "object" && user?.id)
    .map((user) => ({ id: user.id, name: user.name })))
    .concat(props.context.user ? [{ id: props.context.user.id, name: props.context.user.name }] : [])
    .concat(props.projectMembers.map((member) => member.user).filter(Boolean))
    .filter((user, index, list) => ids.has(user.id) && list.findIndex((item) => item.id === user.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
});
const pendingMonthLabel = computed(() => {
  const [year, month] = pendingMonth.value.split("-");
  return `${year}年${Number(month)}月`;
});
const canMovePendingNext = computed(() => addMonths(pendingMonth.value, 1) <= currentMonthValue(new Date()));
const submittedMonthDates = computed(() => new Set(myEntries.value
  .filter((entry) => normalizedStatus(entry.status) === "SUBMITTED" && displayDate(entry).startsWith(pendingMonth.value))
  .map((entry) => displayDate(entry))));
const draftMonthDates = computed(() => new Set(myEntries.value
  .filter((entry) => normalizedStatus(entry.status) === "DRAFT" && displayDate(entry).startsWith(pendingMonth.value))
  .map((entry) => displayDate(entry))));
const pendingDateItems = computed(() => getReportableDates(pendingMonth.value)
  .filter(() => hasReportableProjects.value)
  .filter((date) => date <= today && !submittedMonthDates.value.has(date))
  .map((date) => ({
    date,
    label: date.slice(5),
    hasDraft: draftMonthDates.value.has(date),
  })));
const pendingMonthHelper = computed(() => {
  if (!hasReportableProjects.value) return "暂无可填报项目";
  if (pendingDateItems.value.length) return `本月待补 ${pendingDateItems.value.length} 个工作日`;
  return "工作日已提交完成";
});
const recentPreviewEntries = computed(() => [...myEntries.value]
  .sort((a, b) => displayDate(b).localeCompare(displayDate(a)) || String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
  .slice(0, 5));

watch(() => props.projects, () => {
  if (!props.projects.some((project) => project.id === dailyForm.projectId)) dailyForm.projectId = props.projects[0]?.id || "";
}, { immediate: true });

watch(() => props.startAction?.nonce, () => {
  if (!props.startAction?.type) return;
  if (props.startAction.type === "day") openDailySubmit();
  else focusWeek();
  emit("start-action-handled");
}, { immediate: true });

function focusWeek() {
  roleView.value = "submitted";
  setThisWeek();
}

function movePendingMonth(offset) {
  const next = addMonths(pendingMonth.value, offset);
  if (next > currentMonthValue(new Date())) return;
  pendingMonth.value = next;
}

function openEarliestPending() {
  if (!pendingDateItems.value.length) return;
  openDailySubmit(pendingDateItems.value[0].date);
}

function addProjectRow() {
  if (!projectToAdd.value) return;
  const next = new Set(manualProjectIds.value);
  next.add(projectToAdd.value);
  manualProjectIds.value = next;
  projectToAdd.value = "";
}

function openWeekCell(project, date) {
  const entry = projectDateEntry(project.id, date);
  editingEntryId.value = entry?.id || "";
  Object.assign(cellForm, defaultTimeForm({
    projectId: project.id,
    issueId: entry?.issueId || "",
    spentDate: date,
    hours: entry?.hours || "",
    note: entry?.note || entry?.description || "",
    status: "DRAFT",
  }));
  formError.value = "";
  cellModalOpen.value = true;
}

function openEntryEdit(entry) {
  editingEntryId.value = entry.id;
  Object.assign(cellForm, defaultTimeForm({
    projectId: entry.projectId,
    issueId: entry.issueId || "",
    spentDate: displayDate(entry),
    hours: entry.hours,
    note: entry.note || entry.description || "",
    status: "DRAFT",
  }));
  formError.value = "";
  cellModalOpen.value = true;
}

function closeCellModal() {
  cellModalOpen.value = false;
  cellSaving.value = false;
  formError.value = "";
}

function saveCell() {
  const error = validateTimeForm(cellForm);
  if (error) {
    formError.value = error;
    return;
  }
  cellSaving.value = true;
  const payload = payloadFromForm(cellForm, "DRAFT");
  const done = (result) => {
    cellSaving.value = false;
    if (!result?.ok) {
      formError.value = result?.message || "工时保存失败，请检查字段后重试。";
      return;
    }
    closeCellModal();
  };
  if (editingEntryId.value) emit("update", editingEntryId.value, payload, done);
  else emit("create", payload, done);
}

function openDailySubmit(preferredDate = "") {
  Object.assign(dailyForm, defaultTimeForm({
    projectId: props.projects[0]?.id || "",
    spentDate: typeof preferredDate === "string" && preferredDate ? preferredDate : today,
    status: "SUBMITTED",
  }));
  syncDailyIssue();
  formError.value = "";
  dailyModalOpen.value = true;
}

function closeDailyModal() {
  dailyModalOpen.value = false;
  dailySaving.value = false;
  formError.value = "";
}

function submitDaily() {
  const error = validateTimeForm(dailyForm);
  if (error) {
    formError.value = error;
    return;
  }
  dailySaving.value = true;
  const payload = payloadFromForm(dailyForm, "SUBMITTED");
  emit("create", payload, (result) => {
    dailySaving.value = false;
    if (!result?.ok) {
      formError.value = result?.message || "工时提交失败，请检查字段后重试。";
      return;
    }
    lastSubmitted.value = normalizeResultEntry(result.entry || { ...payload, reporter: currentUserName.value, userId: props.context.userId });
    closeDailyModal();
    resultModalOpen.value = true;
  });
}

function goToSubmittedWeek() {
  if (lastSubmitted.value) weekStart.value = mondayOf(parseDate(displayDate(lastSubmitted.value)));
  roleView.value = "submitted";
  resultModalOpen.value = false;
}

function syncDailyIssue() {
  if (!issuesByProject(dailyForm.projectId).some((issue) => issue.id === dailyForm.issueId)) {
    dailyForm.issueId = "";
  }
}

function moveWeek(offset) {
  const next = formatDate(addDays(parseDate(weekStart.value), offset * 7));
  if (next > mondayOf(new Date())) return;
  weekStart.value = next;
}

function setThisWeek() {
  weekStart.value = mondayOf(new Date());
}

function dayTotal(date) {
  return trimNumber(weekEntries.value.filter((entry) => displayDate(entry) === date).reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
}

function projectWeekTotal(projectId) {
  return trimNumber(weekDays.value.reduce((sum, day) => sum + dayProjectHours(projectId, day.date), 0));
}

function dayProjectHours(projectId, date) {
  return trimNumber(weekEntries.value
    .filter((entry) => entry.projectId === projectId && displayDate(entry) === date)
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
}

function dayProjectNote(projectId, date) {
  return weekEntries.value.find((entry) => entry.projectId === projectId && displayDate(entry) === date)?.note
    || weekEntries.value.find((entry) => entry.projectId === projectId && displayDate(entry) === date)?.description
    || "";
}

function projectDateEntry(projectId, date) {
  return weekEntries.value.find((entry) => entry.projectId === projectId && displayDate(entry) === date) || null;
}

function projectDateEntries(projectId, date) {
  return weekEntries.value.filter((entry) => entry.projectId === projectId && displayDate(entry) === date);
}

function isProjectDateSubmitted(projectId, date) {
  return projectDateEntries(projectId, date).some((entry) => normalizedStatus(entry.status) === "SUBMITTED");
}

function isProjectDateDraft(projectId, date) {
  return projectDateEntries(projectId, date).some((entry) => normalizedStatus(entry.status) === "DRAFT");
}

function cellStateText(projectId, date) {
  if (!canEditDate(date)) return "不可填写";
  if (isProjectDateSubmitted(projectId, date)) return "已提交";
  if (isProjectDateDraft(projectId, date)) return "草稿";
  return "填写说明";
}

function canEditDate(date) {
  return roleView.value === "submitted" && date <= today && isReportableDate(date);
}

function canEdit(entry) {
  return isOwnEntry(entry) && normalizedStatus(entry.status) === "DRAFT";
}

function canDelete(entry) {
  return canEdit(entry);
}

function canSubmitEntry(entry) {
  return isOwnEntry(entry) && normalizedStatus(entry.status) === "DRAFT";
}

function isOwnEntry(entry) {
  return entry.userId === props.context.userId || entry.reporter === currentUserName.value;
}

function issuesByProject(projectId) {
  return props.issues.filter((issue) => issue.projectId === projectId);
}

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function issueName(issueId) {
  if (!issueId) return "";
  return props.issues.find((issue) => issue.id === issueId)?.title || "未关联事项";
}

function userName(userId) {
  return ownedPeopleOptions.value.find((user) => user.id === userId)?.name || "未知成员";
}

function displayDate(entry) {
  return entry?.spentDate || entry?.workDate || "";
}

function validateTimeForm(form) {
  if (!form.projectId) return "请选择项目。";
  if (!form.spentDate) return "请选择日期。";
  if (form.spentDate > today) return "不能填写未来日期。";
  if (!isReportableDate(form.spentDate)) return "只能填写工作日。";
  const hours = Number(form.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return "请填写 0 到 24 之间的有效工时。";
  const existing = projectDateEntry(form.projectId, form.spentDate);
  const currentHours = existing && editingEntryId.value === existing.id ? 0 : Number(existing?.hours || 0);
  if (currentHours + hours > 24) return "同一天累计工时不能超过 24 小时。";
  return "";
}

function payloadFromForm(form, status) {
  return {
    reporter: currentUserName.value,
    userId: props.context.userId,
    spentDate: form.spentDate,
    workDate: form.spentDate,
    projectId: form.projectId,
    issueId: form.issueId || "",
    hours: Number(form.hours),
    note: form.note || "",
    status,
  };
}

function defaultTimeForm(overrides = {}) {
  return {
    reporter: "",
    spentDate: today || formatDate(new Date()),
    projectId: "",
    issueId: "",
    hours: "",
    note: "",
    status: "DRAFT",
    ...overrides,
  };
}

function normalizeResultEntry(entry) {
  return {
    ...entry,
    spentDate: entry.spentDate || entry.workDate,
    note: entry.note || entry.description || "",
  };
}

function normalizedStatus(status) {
  return ({ 草稿: "DRAFT", DRAFT: "DRAFT" })[status] || "SUBMITTED";
}

function statusDisplay(status) {
  return normalizedStatus(status) === "DRAFT" ? "草稿" : "已提交";
}

function statusTone(status) {
  return normalizedStatus(status) === "DRAFT" ? "warn" : "success";
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

function addMonths(monthValue, amount) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
</script>
