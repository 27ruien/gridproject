<template>
  <section class="view-stack">
    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">成本管理</p>
          <h2>按项目管理固定人天成本与工时支出</h2>
          <p>仅 ADMIN 和项目 Owner 可查看成本金额、人员排行与导出入口。</p>
        </div>
        <Button variant="primary" size="small" :disabled="!eligibleProjects.length" @click="openCreate">新建成本管理记录</Button>
      </div>

      <div class="cost-toolbar">
        <label>
          <span>搜索</span>
          <input v-model="search" type="search" placeholder="项目名称或项目代码" />
        </label>
        <label>
          <span>排序</span>
          <select v-model="sort">
            <option value="updatedAt:desc">最近更新</option>
            <option value="cost:desc">累计成本最高</option>
            <option value="hours:desc">累计工时最高</option>
            <option value="project:asc">项目名称 A-Z</option>
          </select>
        </label>
      </div>

      <div class="cost-table">
        <div class="cost-table-head">
          <span>项目</span><span>Owner</span><span>人天成本</span><span>工时</span><span>人天</span><span>累计成本</span><span>币种</span><span>更新时间</span><span>操作</span>
        </div>
        <div
          v-for="row in pagedRows"
          :key="row.id"
          class="cost-table-row"
          role="button"
          tabindex="0"
          @click="openDetail(row.id)"
          @keydown.enter.prevent="openDetail(row.id)"
          @keydown.space.prevent="openDetail(row.id)"
        >
          <span>
            <strong>{{ row.project.name }}</strong>
            <small>{{ row.project.code || row.project.id }}</small>
          </span>
          <span>{{ row.summary.ownerName }}</span>
          <span>{{ formatCurrency(row.summary.currentAmountPerPersonDay, row.currency) }}</span>
          <span>{{ row.summary.totalHours }}h</span>
          <span>{{ row.summary.totalPersonDays }}</span>
          <strong>{{ formatCurrency(row.summary.totalCost, row.currency) }}</strong>
          <span>{{ row.currency }}</span>
          <span>{{ dateOnly(row.updatedAt) }}</span>
          <span class="table-action-text">查看详情</span>
        </div>

        <div class="cost-mobile-list">
          <article v-for="row in pagedRows" :key="`mobile-${row.id}`" class="cost-mobile-card">
            <span class="mobile-card-meta">
              <strong>{{ row.project.name }}</strong>
              <span>{{ row.project.code || row.project.id }}</span>
            </span>
            <div class="cost-card-metrics">
              <span>工时 {{ row.summary.totalHours }}h</span>
              <span>人天 {{ row.summary.totalPersonDays }}</span>
              <strong>{{ formatCurrency(row.summary.totalCost, row.currency) }}</strong>
            </div>
            <Button variant="ghost" size="small" @click="openDetail(row.id)">查看详情</Button>
          </article>
        </div>

        <EmptyState
          v-if="!pagedRows.length"
          title="暂无可见成本记录"
          description="先选择你负责的项目并创建成本管理记录。普通项目成员不会看到成本金额。"
          action="新建成本管理记录"
          @action="openCreate"
        />
      </div>

      <div v-if="filteredRows.length" class="pagination-bar">
        <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ filteredRows.length }} 条</span>
        <div>
          <Button variant="ghost" size="small" :disabled="page <= 1" @click="page -= 1">上一页</Button>
          <Button variant="ghost" size="small" :disabled="page >= totalPages" @click="page += 1">下一页</Button>
        </div>
      </div>
    </div>

    <DetailPanel
      :open="Boolean(selectedRow)"
      :title="selectedRow?.project.name || '成本详情'"
      eyebrow="成本详情"
      panel-class="cost-detail-panel"
      trap-focus
      @close="selectedRecordId = ''"
    >
      <template #actions>
        <Button variant="ghost" size="small" @click="emitExport">导出 Excel</Button>
      </template>

      <div v-if="selectedSummary" class="cost-detail-stack">
        <section class="cost-summary-grid">
          <article>
            <span>项目代码</span>
            <strong>{{ selectedSummary.projectCode }}</strong>
          </article>
          <article>
            <span>Owner</span>
            <strong>{{ selectedSummary.ownerName }}</strong>
          </article>
          <article>
            <span>当前人天成本</span>
            <strong>{{ formatCurrency(selectedSummary.currentAmountPerPersonDay, selectedSummary.currency) }}</strong>
          </article>
          <article>
            <span>标准工时/人天</span>
            <strong>{{ selectedSummary.standardHoursPerDay }}h</strong>
          </article>
          <article>
            <span>累计工时</span>
            <strong>{{ selectedSummary.totalHours }}h</strong>
          </article>
          <article>
            <span>累计人天</span>
            <strong>{{ selectedSummary.totalPersonDays }}</strong>
          </article>
          <article>
            <span>累计成本</span>
            <strong>{{ formatCurrency(selectedSummary.totalCost, selectedSummary.currency) }}</strong>
          </article>
        </section>

        <section class="cost-week-filter">
          <div>
            <strong>周筛选</strong>
            <small>{{ weekRangeLabel }}</small>
          </div>
          <div class="section-actions">
            <Button variant="ghost" size="tiny" @click="moveWeek(-1)">上一周</Button>
            <Button variant="ghost" size="tiny" @click="setThisWeek">本周</Button>
            <input v-model="weekStart" type="date" aria-label="选择指定周" />
            <Button variant="ghost" size="tiny" @click="moveWeek(1)">下一周</Button>
            <Button variant="ghost" size="tiny" @click="weekStart = ''">清除</Button>
          </div>
        </section>

        <section class="cost-edit-panel">
          <div class="section-head">
            <div>
              <h3>费率与设置</h3>
              <small>修改人天成本会关闭旧费率并新增历史费率。</small>
            </div>
            <Button variant="primary" size="small" @click="saveSelectedRecord">保存设置</Button>
          </div>
          <div class="form-two">
            <label>
              <span>固定人天成本</span>
              <input v-model.number="editForm.amountPerPersonDay" min="0" step="100" type="number" />
            </label>
            <label>
              <span>币种</span>
              <select v-model="editForm.currency">
                <option value="CNY">CNY</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label>
              <span>标准工时/人天</span>
              <input v-model.number="editForm.standardHoursPerDay" min="1" max="24" step="0.5" type="number" />
            </label>
            <label>
              <span>费率生效日期</span>
              <input v-model="editForm.effectiveFrom" type="date" />
            </label>
          </div>
          <label>
            <span>备注</span>
            <textarea v-model="editForm.notes" rows="2" />
          </label>
        </section>

        <section class="cost-section">
          <div class="section-head">
            <div>
              <h3>项目人员支出</h3>
              <small>按人员成本从高到低排序。</small>
            </div>
          </div>
          <div class="cost-people-list">
            <div v-for="person in selectedSummary.people" :key="person.userId" class="cost-person-row">
              <span>
                <strong>{{ person.name }}</strong>
                <small>{{ person.email }}</small>
              </span>
              <span>{{ person.hours }}h</span>
              <span>{{ person.personDays }} 人天</span>
              <strong>{{ formatCurrency(person.cost, selectedSummary.currency) }}</strong>
              <span>{{ person.share }}%</span>
            </div>
            <p v-if="!selectedSummary.people.length" class="quiet-text">当前筛选下暂无可计入成本的工时。</p>
          </div>
        </section>

        <section class="cost-section">
          <div class="section-head">
            <div>
              <h3>Top 5 人员成本</h3>
              <small>人员不足 5 人时展示实际人数。</small>
            </div>
          </div>
          <div class="top-cost-list">
            <div v-for="(person, index) in topPeople" :key="person.userId" class="top-cost-row">
              <strong>{{ index + 1 }}</strong>
              <span>{{ person.name }}</span>
              <span>{{ person.hours }}h / {{ person.personDays }} 人天</span>
              <span>{{ formatCurrency(person.cost, selectedSummary.currency) }}</span>
              <i :style="{ width: `${Math.max(6, Number(person.share))}%` }"></i>
            </div>
          </div>
        </section>

        <section class="cost-section">
          <div class="section-head">
            <div>
              <h3>工时 Raw Data 预览</h3>
              <small>导出 Excel 使用同一项目、周筛选和状态范围。</small>
            </div>
          </div>
          <div class="cost-raw-table">
            <div class="cost-raw-head">
              <span>日期</span><span>人员</span><span>事项</span><span>工时</span><span>人天成本</span><span>计算成本</span><span>状态</span>
            </div>
            <div v-for="entry in pagedRawData" :key="entry.id" class="cost-raw-row">
              <span>{{ entry.workDate }}</span>
              <span>{{ entry.personName }}</span>
              <span>
                <strong>{{ entry.issueCode }}</strong>
                <small>{{ entry.issueTitle }}</small>
              </span>
              <span>{{ entry.hours }}h</span>
              <span>{{ formatCurrency(entry.amountPerPersonDay, entry.currency) }}</span>
              <strong>{{ formatCurrency(entry.cost, entry.currency) }}</strong>
              <span>{{ entry.status }}</span>
            </div>
          </div>
          <div v-if="selectedSummary.rawData.length" class="pagination-bar">
            <span>第 {{ rawPage }} / {{ rawTotalPages }} 页 · 共 {{ selectedSummary.rawData.length }} 条</span>
            <div>
              <Button variant="ghost" size="small" :disabled="rawPage <= 1" @click="rawPage -= 1">上一页</Button>
              <Button variant="ghost" size="small" :disabled="rawPage >= rawTotalPages" @click="rawPage += 1">下一页</Button>
            </div>
          </div>
        </section>
      </div>
    </DetailPanel>

    <Modal
      :open="createOpen"
      title="新建成本管理记录"
      eyebrow="成本管理"
      size="large"
      @close="createOpen = false"
    >
      <div class="form-two">
        <label>
          <span>关联项目</span>
          <select v-model="createForm.projectId">
            <option v-for="project in eligibleProjects" :key="project.id" :value="project.id">{{ project.code || project.id }} · {{ project.name }}</option>
          </select>
        </label>
        <label>
          <span>固定人天成本</span>
          <input v-model.number="createForm.amountPerPersonDay" min="0" step="100" type="number" />
        </label>
        <label>
          <span>币种</span>
          <select v-model="createForm.currency">
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          <span>标准工时/人天</span>
          <input v-model.number="createForm.standardHoursPerDay" min="1" max="24" step="0.5" type="number" />
        </label>
        <label>
          <span>费率生效日期</span>
          <input v-model="createForm.effectiveFrom" type="date" />
        </label>
      </div>
      <label>
        <span>备注</span>
        <textarea v-model="createForm.notes" rows="3" placeholder="例如外包、内部核算或客户项目预算口径" />
      </label>

      <template #footer>
        <Button variant="ghost" @click="createOpen = false">取消</Button>
        <Button variant="primary" :disabled="!createForm.projectId || createForm.amountPerPersonDay < 0" @click="submitCreate">创建</Button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { calculateProjectCost, getCurrentRate, normalizeWeekFilter } from "../domain/cost.js";
import { CostAccessPolicy } from "../server/policies/costAccessPolicy.js";
import Button from "../components/ui/Button.vue";
import DetailPanel from "../components/ui/DetailPanel.vue";
import EmptyState from "../components/common/EmptyState.vue";
import Modal from "../components/ui/Modal.vue";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  users: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  costRecords: { type: Array, required: true },
  costRates: { type: Array, required: true },
  context: { type: Object, required: true },
});

const emit = defineEmits(["create", "update", "delete", "export"]);

const search = ref("");
const sort = ref("updatedAt:desc");
const page = ref(1);
const pageSize = 8;
const rawPage = ref(1);
const rawPageSize = 6;
const selectedRecordId = ref("");
const createOpen = ref(false);
const weekStart = ref("");
const createForm = reactive(defaultCreateForm());
const editForm = reactive({
  amountPerPersonDay: 0,
  currency: "CNY",
  standardHoursPerDay: 8,
  effectiveFrom: "",
  notes: "",
});

const projectMap = computed(() => new Map(props.projects.map((project) => [project.id, project])));
const recordRows = computed(() => props.costRecords
  .filter((record) => record.status === "ACTIVE" && !record.deletedAt)
  .filter((record) => CostAccessPolicy.canViewCost(props.context, projectMap.value.get(record.projectId)))
  .map((record) => {
    const project = projectMap.value.get(record.projectId);
    const rates = props.costRates.filter((rate) => rate.projectCostRecordId === record.id);
    const summary = calculateProjectCost({
      project,
      record,
      rates,
      timeEntries: props.timeEntries,
      issues: props.issues,
      users: props.users,
    });
    return { ...record, project, rates, currentRate: getCurrentRate(rates), summary };
  }));
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const rows = recordRows.value.filter((row) => !keyword || `${row.project.name}${row.project.code || row.project.id}`.toLowerCase().includes(keyword));
  return sortRows(rows);
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const selectedRow = computed(() => recordRows.value.find((row) => row.id === selectedRecordId.value) || null);
const selectedSummary = computed(() => {
  if (!selectedRow.value) return null;
  return calculateProjectCost({
    project: selectedRow.value.project,
    record: selectedRow.value,
    rates: selectedRow.value.rates,
    timeEntries: props.timeEntries,
    issues: props.issues,
    users: props.users,
    filter: { weekStart: weekStart.value },
  });
});
const topPeople = computed(() => selectedSummary.value?.people.slice(0, 5) || []);
const rawTotalPages = computed(() => Math.max(1, Math.ceil((selectedSummary.value?.rawData.length || 0) / rawPageSize)));
const pagedRawData = computed(() => (selectedSummary.value?.rawData || []).slice((rawPage.value - 1) * rawPageSize, rawPage.value * rawPageSize));
const eligibleProjects = computed(() => props.projects.filter((project) => (
  CostAccessPolicy.canManageCost(props.context, project) &&
  !props.costRecords.some((record) => record.projectId === project.id && record.status === "ACTIVE" && !record.deletedAt)
)));
const weekRangeLabel = computed(() => {
  const range = normalizeWeekFilter(weekStart.value);
  return range ? `${range.start} 至 ${range.end}` : "未筛选，展示全部可计入成本工时";
});

watch([search, sort], () => { page.value = 1; });
watch(selectedRow, (row) => {
  rawPage.value = 1;
  if (!row) return;
  editForm.amountPerPersonDay = Number(row.currentRate?.amountPerPersonDay || 0);
  editForm.currency = row.currency || "CNY";
  editForm.standardHoursPerDay = Number(row.standardHoursPerDay) || 8;
  editForm.effectiveFrom = new Date().toISOString().slice(0, 10);
  editForm.notes = row.notes || "";
});
watch(selectedSummary, () => { rawPage.value = 1; });

function openCreate() {
  Object.assign(createForm, defaultCreateForm());
  createForm.projectId = eligibleProjects.value[0]?.id || "";
  createOpen.value = true;
}

function submitCreate() {
  emit("create", { ...createForm });
  createOpen.value = false;
}

function openDetail(recordId) {
  selectedRecordId.value = recordId;
}

function saveSelectedRecord() {
  if (!selectedRow.value) return;
  emit("update", selectedRow.value.id, { ...editForm });
}

function emitExport() {
  if (!selectedRow.value) return;
  emit("export", selectedRow.value.id, { weekStart: weekStart.value });
}

function setThisWeek() {
  weekStart.value = mondayOf(new Date());
}

function moveWeek(offset) {
  const base = weekStart.value ? new Date(`${weekStart.value}T00:00:00`) : new Date();
  base.setDate(base.getDate() + offset * 7);
  weekStart.value = mondayOf(base);
}

function mondayOf(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy.toISOString().slice(0, 10);
}

function sortRows(rows) {
  if (sort.value === "cost:desc") return [...rows].sort((a, b) => Number(b.summary.totalCost) - Number(a.summary.totalCost));
  if (sort.value === "hours:desc") return [...rows].sort((a, b) => Number(b.summary.totalHours) - Number(a.summary.totalHours));
  if (sort.value === "project:asc") return [...rows].sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN"));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function formatCurrency(value, currency = "CNY") {
  const number = Number(value || 0);
  return `${currency} ${number.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function defaultCreateForm() {
  return {
    projectId: "",
    amountPerPersonDay: 1200,
    currency: "CNY",
    standardHoursPerDay: 8,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}
</script>
