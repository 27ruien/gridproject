<template>
  <section class="view-stack">
    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">工时填报</p>
          <h2>按月申报、按任务拆分、按职责查看</h2>
          <p>一个申报日期可关联多个任务；我负责的看项目成员提交，我提交的看个人申报进度。</p>
        </div>
        <Button variant="primary" size="small" @click="openCreate">新建申报</Button>
      </div>

      <div class="timesheet-toolbar">
        <div class="segmented-control">
          <button type="button" :class="{ active: roleView === 'owned' }" @click="roleView = 'owned'">我负责的</button>
          <button type="button" :class="{ active: roleView === 'submitted' }" @click="roleView = 'submitted'">我提交的</button>
        </div>
        <label class="month-filter">
          <span>月份</span>
          <input v-model="selectedMonth" type="month" />
        </label>
      </div>

      <div class="timesheet-stats">
        <article>
          <span>{{ roleView === "submitted" ? "本月应申报" : "项目可见记录" }}</span>
          <strong>{{ roleView === "submitted" ? `${monthlyTarget}h` : `${filteredEntries.length}` }}</strong>
        </article>
        <article>
          <span>{{ roleView === "submitted" ? "当前已申报" : "本月项目工时" }}</span>
          <strong>{{ roleView === "submitted" ? submittedHours : totalHours }}h</strong>
        </article>
        <article>
          <span>{{ roleView === "submitted" ? "待补日期" : "涉及项目" }}</span>
          <strong>{{ roleView === "submitted" ? `${missingSubmitDates.length}天` : projectCount }}</strong>
        </article>
      </div>

      <div class="timesheet-filters" :class="{ expanded: filtersExpanded }">
        <label>
          <span>全字段搜索</span>
          <input v-model="filters.keyword" placeholder="日期、项目、任务、填报人、说明、状态" />
        </label>
        <label>
          <span>项目</span>
          <select v-model="filters.projectId">
            <option value="">全部项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <label class="filter-advanced">
          <span>任务</span>
          <select v-model="filters.issueId">
            <option value="">全部任务</option>
            <option v-for="issue in issues" :key="issue.id" :value="issue.id">{{ issue.title }}</option>
          </select>
        </label>
        <label class="filter-advanced">
          <span>填报人</span>
          <PersonPicker v-model="filters.reporter" :people="people" title="筛选填报人" placeholder="全部" />
        </label>
        <label class="filter-advanced">
          <span>开始日期</span>
          <input v-model="filters.dateFrom" type="date" />
        </label>
        <label class="filter-advanced">
          <span>结束日期</span>
          <input v-model="filters.dateTo" type="date" />
        </label>
        <label class="filter-advanced">
          <span>最小工时</span>
          <input v-model.number="filters.minHours" min="0" step="0.5" type="number" placeholder="不限" />
        </label>
        <label class="filter-advanced">
          <span>最大工时</span>
          <input v-model.number="filters.maxHours" min="0" step="0.5" type="number" placeholder="不限" />
        </label>
        <Button variant="ghost" size="small" @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? "收起筛选" : `更多筛选${activeFilterCount ? ` ${activeFilterCount}` : ""}` }}
        </Button>
        <Button variant="ghost" size="small" @click="resetFilters">重置</Button>
      </div>

      <div v-if="roleView === 'submitted'" class="missing-dates-panel">
        <div>
          <strong>本月待补日期</strong>
          <small>按工作日 8h 计算，后续可接入企业排班日历。</small>
        </div>
        <div class="date-chip-list">
          <button v-for="date in missingSubmitDates.slice(0, 12)" :key="date" type="button" @click="openCreate(date)">
            {{ date.slice(5) }}
          </button>
          <span v-if="missingSubmitDates.length > 12">+{{ missingSubmitDates.length - 12 }}</span>
          <span v-if="!missingSubmitDates.length">本月工作日均已提交</span>
        </div>
      </div>

      <div class="timesheet-table">
        <div class="timesheet-head">
          <span>日期</span><span>填报人</span><span>项目</span><span>任务</span><span>工时</span><span>状态</span><span>说明</span><span>操作</span>
        </div>
        <div v-for="entry in filteredEntries" :key="entry.id" class="timesheet-row">
          <span>{{ entry.spentDate }}</span>
          <span>{{ entry.reporter }}</span>
          <span>{{ projectName(entry.projectId) }}</span>
          <span>{{ issueName(entry.issueId) }}</span>
          <strong>{{ entry.hours }}h</strong>
          <span>{{ entry.status }}</span>
          <span>{{ entry.note || "未填写" }}</span>
          <Button variant="ghost" size="tiny" @click="openEdit(entry)">编辑</Button>
        </div>
        <div class="timesheet-mobile-list">
          <article v-for="entry in filteredEntries" :key="`mobile-${entry.id}`" class="timesheet-mobile-card">
            <span class="mobile-card-meta">
              <strong>{{ entry.spentDate }}</strong>
              <span>{{ entry.hours }}h</span>
            </span>
            <strong class="truncate">{{ issueName(entry.issueId) }}</strong>
            <small class="line-clamp-2">{{ projectName(entry.projectId) }} · {{ entry.reporter }} · {{ entry.note || "未填写说明" }}</small>
            <span class="mobile-card-meta">
              <span>{{ entry.status }}</span>
              <Button variant="ghost" size="tiny" @click="openEdit(entry)">编辑</Button>
            </span>
          </article>
        </div>
        <EmptyState
          v-if="!filteredEntries.length"
          title="暂无匹配工时"
          description="调整月份、筛选条件，或新建一条关联项目和任务的申报。"
          action="新建申报"
          @action="openCreate"
        />
      </div>
    </div>

    <Modal
      :open="modalOpen"
      :title="editingId ? '调整单条任务工时' : '一个日期可同时申报多个任务'"
      :eyebrow="editingId ? '编辑工时' : '新建工时申报'"
      size="large"
      @close="modalOpen = false"
    >
          <div class="form-two">
            <label>
              <span>申报人</span>
              <PersonPicker v-model="form.reporter" :people="people" title="选择申报人" />
            </label>
            <label>
              <span>申报日期</span>
              <input v-model="form.spentDate" type="date" />
            </label>
          </div>

          <div v-if="!editingId" class="missing-dates-panel compact">
            <div>
              <strong>建议优先补交这些日期</strong>
              <small>打开弹窗时已自动定位到第一个未提交工作日。</small>
            </div>
            <div class="date-chip-list">
              <button v-for="date in formMissingDates.slice(0, 10)" :key="date" type="button" @click="form.spentDate = date">
                {{ date.slice(5) }}
              </button>
              <span v-if="!formMissingDates.length">暂无待补日期</span>
            </div>
          </div>

          <div class="timesheet-lines">
            <div class="section-head">
              <div>
                <h3>任务明细</h3>
                <small>每一行会保存为独立工时记录，便于后续审批、统计和按任务追踪。</small>
              </div>
              <Button v-if="!editingId" variant="ghost" size="small" @click="addLine">添加任务</Button>
            </div>
            <div v-for="(line, index) in form.lines" :key="line.localId" class="timesheet-line">
              <label>
                <span>项目</span>
                <select v-model="line.projectId" @change="syncLineIssue(line)">
                  <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
                </select>
              </label>
              <label>
                <span>任务</span>
                <select v-model="line.issueId">
                  <option v-for="issue in issuesByProject(line.projectId)" :key="issue.id" :value="issue.id">{{ issue.title }}</option>
                </select>
              </label>
              <label>
                <span>工时</span>
                <input v-model.number="line.hours" min="0.5" step="0.5" type="number" />
              </label>
              <label>
                <span>说明</span>
                <input v-model="line.note" placeholder="本次投入内容" />
              </label>
              <Button
                v-if="!editingId && form.lines.length > 1"
                variant="ghost"
                size="tiny"
                @click="removeLine(index)"
              >
                移除
              </Button>
            </div>
          </div>

      <template #footer>
        <Button variant="ghost" @click="modalOpen = false">取消</Button>
        <Button variant="primary" :disabled="!canSubmit" @click="submit">保存</Button>
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
import {
  calculateMonthlyTarget,
  createEntrySearchText,
  currentMonthValue,
  getMissingSubmitDates,
  isInMonth,
} from "../services/timesheetPolicyService.js";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  people: { type: Array, required: true },
  managerName: { type: String, required: true },
});

const emit = defineEmits(["create", "update"]);

const roleView = ref("owned");
const selectedMonth = ref(currentMonthValue());
const modalOpen = ref(false);
const editingId = ref("");
const lineSeed = ref(1);
const filtersExpanded = ref(false);
const filters = reactive({
  keyword: "",
  projectId: "",
  issueId: "",
  reporter: "",
  dateFrom: "",
  dateTo: "",
  minHours: "",
  maxHours: "",
});
const form = reactive({
  reporter: "",
  spentDate: "",
  lines: [],
});

const managedProjectIds = computed(() => props.projects.filter((project) => project.owner === props.managerName).map((project) => project.id));
const scopedEntries = computed(() => props.timeEntries.filter((entry) => {
  if (roleView.value === "owned") return managedProjectIds.value.includes(entry.projectId);
  return entry.reporter === props.managerName;
}));
const monthEntries = computed(() => scopedEntries.value.filter((entry) => isInMonth(entry.spentDate, selectedMonth.value)));
const filteredEntries = computed(() => monthEntries.value.filter(matchesFilters).sort((a, b) => b.spentDate.localeCompare(a.spentDate)));
const totalHours = computed(() => filteredEntries.value.reduce((sum, entry) => sum + entry.hours, 0));
const projectCount = computed(() => new Set(filteredEntries.value.map((entry) => entry.projectId)).size);
const monthlyTarget = computed(() => calculateMonthlyTarget(selectedMonth.value));
const submittedMonthEntries = computed(() => props.timeEntries.filter((entry) => entry.reporter === props.managerName && isInMonth(entry.spentDate, selectedMonth.value)));
const submittedHours = computed(() => submittedMonthEntries.value.reduce((sum, entry) => sum + entry.hours, 0));
const missingSubmitDates = computed(() => getMissingSubmitDates(props.timeEntries, props.managerName, selectedMonth.value));
const formMissingDates = computed(() => getMissingSubmitDates(props.timeEntries, form.reporter, selectedMonth.value));
const activeFilterCount = computed(() => ["issueId", "reporter", "dateFrom", "dateTo", "minHours", "maxHours"].filter((key) => filters[key] !== "").length);
const canSubmit = computed(() => Boolean(
  form.reporter &&
  form.spentDate &&
  form.lines.length &&
  form.lines.every((line) => line.projectId && line.issueId && Number(line.hours) > 0),
));

watch(() => form.reporter, () => {
  if (!editingId.value && formMissingDates.value.length && !formMissingDates.value.includes(form.spentDate)) {
    form.spentDate = formMissingDates.value[0];
  }
});

function matchesFilters(entry) {
  const keyword = filters.keyword.trim().toLowerCase();
  if (filters.projectId && entry.projectId !== filters.projectId) return false;
  if (filters.issueId && entry.issueId !== filters.issueId) return false;
  if (filters.reporter && entry.reporter !== filters.reporter) return false;
  if (filters.dateFrom && entry.spentDate < filters.dateFrom) return false;
  if (filters.dateTo && entry.spentDate > filters.dateTo) return false;
  if (filters.minHours !== "" && entry.hours < Number(filters.minHours)) return false;
  if (filters.maxHours !== "" && entry.hours > Number(filters.maxHours)) return false;
  if (!keyword) return true;

  return createEntrySearchText(entry, projectName(entry.projectId), issueName(entry.issueId)).toLowerCase().includes(keyword);
}

function openCreate(preferredDate = "") {
  editingId.value = "";
  form.reporter = props.managerName;
  form.spentDate = preferredDate || missingSubmitDates.value[0] || `${selectedMonth.value}-01`;
  form.lines = [createLine()];
  modalOpen.value = true;
}

function openEdit(entry) {
  editingId.value = entry.id;
  form.reporter = entry.reporter;
  form.spentDate = entry.spentDate;
  form.lines = [createLine({
    projectId: entry.projectId,
    issueId: entry.issueId,
    hours: entry.hours,
    note: entry.note,
  })];
  modalOpen.value = true;
}

function submit() {
  if (!canSubmit.value) return;
  if (editingId.value) {
    const line = form.lines[0];
    emit("update", editingId.value, {
      reporter: form.reporter,
      spentDate: form.spentDate,
      projectId: line.projectId,
      issueId: line.issueId,
      hours: line.hours,
      note: line.note,
    });
  } else {
    emit("create", form.lines.map((line) => ({
      reporter: form.reporter,
      spentDate: form.spentDate,
      projectId: line.projectId,
      issueId: line.issueId,
      hours: line.hours,
      note: line.note,
    })));
  }
  modalOpen.value = false;
}

function createLine(overrides = {}) {
  const projectId = overrides.projectId || props.projects[0]?.id || "";
  const issueId = overrides.issueId || props.issues.find((issue) => issue.projectId === projectId)?.id || "";
  return {
    localId: `line-${lineSeed.value++}`,
    projectId,
    issueId,
    hours: overrides.hours ?? 1,
    note: overrides.note || "",
  };
}

function addLine() {
  form.lines.push(createLine());
}

function removeLine(index) {
  form.lines.splice(index, 1);
}

function syncLineIssue(line) {
  if (!issuesByProject(line.projectId).some((issue) => issue.id === line.issueId)) {
    line.issueId = issuesByProject(line.projectId)[0]?.id || "";
  }
}

function issuesByProject(projectId) {
  return props.issues.filter((issue) => issue.projectId === projectId);
}

function resetFilters() {
  filters.keyword = "";
  filters.projectId = "";
  filters.issueId = "";
  filters.reporter = "";
  filters.dateFrom = "";
  filters.dateTo = "";
  filters.minHours = "";
  filters.maxHours = "";
}

function projectName(projectId) {
  return props.projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function issueName(issueId) {
  return props.issues.find((issue) => issue.id === issueId)?.title || "未知任务";
}
</script>
