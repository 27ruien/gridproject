<template>
  <section class="view-stack">
    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">成本管理</p>
          <h2>项目人天投入</h2>
          <p>本模块中的成本指项目人力投入，不包含人员薪资、单价或任何货币金额。</p>
        </div>
        <Button variant="primary" size="small" :disabled="!eligibleProjects.length" @click="openCreate">新建成本管理记录</Button>
      </div>

      <div class="cost-overview-band" aria-label="成本摘要">
        <div><span>总预算</span><strong>{{ costOverview.plannedPersonDays }} 人天</strong></div>
        <div><span>已发生成本</span><strong>{{ costOverview.actualPersonDays }} 人天</strong></div>
        <div><span>预计成本</span><strong>{{ costOverview.forecastPersonDays }} 人天</strong></div>
        <div><span>剩余预算</span><strong :class="{ danger: costOverview.remainingPersonDays < 0 }">{{ costOverview.remainingPersonDays }} 人天</strong></div>
        <div><span>超预算风险</span><strong :class="{ danger: costOverview.riskCount }">{{ costOverview.riskCount }} 个</strong></div>
      </div>

      <div class="cost-toolbar">
        <label>
          <span>搜索</span>
          <input v-model="search" type="search" placeholder="项目名称或项目代码" />
        </label>
        <label>
          <span>项目</span>
          <select v-model="projectFilter">
            <option value="">全部项目</option>
            <option v-for="row in recordRows" :key="row.project.id" :value="row.project.id">{{ row.project.name }}</option>
          </select>
        </label>
        <label>
          <span>团队</span>
          <select v-model="teamFilter">
            <option value="">全部团队</option>
            <option v-for="team in teamOptions" :key="team" :value="team">{{ team }}</option>
          </select>
        </label>
        <label>
          <span>人员</span>
          <select v-model="ownerFilter">
            <option value="">全部 Owner</option>
            <option v-for="owner in ownerOptions" :key="owner" :value="owner">{{ owner }}</option>
          </select>
        </label>
        <label>
          <span>成本类型</span>
          <select v-model="costTypeFilter">
            <option value="person-days">人天投入</option>
          </select>
        </label>
        <label>
          <span>风险</span>
          <select v-model="riskFilter">
            <option value="">全部</option>
            <option value="overrun">仅超预算</option>
            <option value="normal">预算内</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select v-model="sort">
            <option value="updatedAt:desc">最近更新</option>
            <option value="burnRate:desc">人天消耗率最高</option>
            <option value="actualHours:desc">实际总工时最高</option>
            <option value="remaining:asc">剩余人天最少</option>
            <option value="project:asc">项目名称 A-Z</option>
          </select>
        </label>
      </div>

      <div class="cost-table">
        <div class="cost-table-head">
          <span>项目</span><span>Owner</span><span>预算</span><span>实际</span><span>预计</span><span>偏差</span><span>风险</span><span>参与人员</span><span>操作</span>
        </div>
        <div
          v-for="row in pagedRows"
          :key="row.id"
          class="cost-table-row"
          :class="{ 'is-overrun': row.summary.remainingPersonDays < 0 }"
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
          <span>{{ row.summary.plannedPersonDays }} 人天</span>
          <span>{{ row.summary.actualPersonDays }} 人天</span>
          <span>{{ forecastPersonDays(row.summary) }} 人天</span>
          <strong :class="{ danger: row.summary.remainingPersonDays < 0 }">{{ row.summary.remainingPersonDays }} 人天</strong>
          <span><StatusLozenge :label="row.summary.remainingPersonDays < 0 ? '超预算' : '正常'" :tone="row.summary.remainingPersonDays < 0 ? 'danger' : 'neutral'" /></span>
          <span>{{ row.summary.participantCount }} 人</span>
          <span class="table-action-text">查看详情</span>
        </div>

        <div class="cost-mobile-list">
          <article v-for="row in pagedRows" :key="`mobile-${row.id}`" class="cost-mobile-card">
            <span class="mobile-card-meta">
              <strong>{{ row.project.name }}</strong>
              <span>{{ row.project.code || row.project.id }}</span>
            </span>
            <div class="cost-card-metrics">
              <span>计划 {{ row.summary.plannedPersonDays }} 人天</span>
              <span>实际 {{ row.summary.actualPersonDays }} 人天</span>
              <strong :class="{ danger: row.summary.remainingPersonDays < 0 }">{{ row.summary.remainingPersonDays }} 人天</strong>
            </div>
            <Button variant="ghost" size="small" @click="openDetail(row.id)">查看详情</Button>
          </article>
        </div>

        <EmptyState
          v-if="!pagedRows.length"
          title="暂无可见成本记录"
          description="先选择你负责的项目并创建成本管理记录。普通项目成员不会看到成本管理入口。"
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
            <span>项目计划总人天</span>
            <strong>{{ selectedSummary.plannedPersonDays }} 人天</strong>
          </article>
          <article>
            <span>标准每日工时</span>
            <strong>{{ selectedSummary.standardHoursPerDay }} 小时</strong>
          </article>
          <article>
            <span>{{ isWeekFiltered ? "本周实际工时" : "实际总工时" }}</span>
            <strong>{{ selectedSummary.actualHours }} 小时</strong>
          </article>
          <article>
            <span>{{ isWeekFiltered ? "本周实际人天" : "实际人天" }}</span>
            <strong>{{ selectedSummary.actualPersonDays }} 人天</strong>
          </article>
          <article v-if="!isWeekFiltered">
            <span>剩余人天</span>
            <strong>{{ selectedSummary.remainingPersonDays }} 人天</strong>
          </article>
          <article v-if="!isWeekFiltered">
            <span>人天消耗率</span>
            <strong>{{ selectedSummary.personDayBurnRate }}%</strong>
          </article>
          <article>
            <span>参与人员数量</span>
            <strong>{{ selectedSummary.participantCount }} 人</strong>
          </article>
        </section>

        <p v-if="isWeekFiltered" class="quiet-text">
          周筛选仅影响实际工时、实际人天、人员投入、Top 5、Raw Data 和 Excel 导出；项目计划总人天保持全周期口径。
        </p>

        <section class="cost-edit-panel">
          <div class="section-head">
            <div>
              <h3>计划人天设置</h3>
              <small>项目总人天是完整项目周期的计划投入，不会随工时自动变化。</small>
            </div>
            <Button variant="primary" size="small" @click="saveSelectedRecord">保存设置</Button>
          </div>
          <div class="form-two">
            <label>
              <span>项目总人天</span>
              <input v-model.number="editForm.plannedPersonDays" min="0.01" step="0.5" type="number" />
            </label>
            <label>
              <span>标准每日工时</span>
              <input v-model.number="editForm.standardHoursPerDay" min="0.5" max="24" step="0.5" type="number" />
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
              <h3>人员工时投入</h3>
              <small>按实际工时从高到低排序。</small>
            </div>
          </div>
          <div class="cost-people-list">
            <div v-for="person in selectedSummary.people" :key="person.userId" class="cost-person-row">
              <span>
                <strong>{{ person.name }}</strong>
                <small>{{ person.email }}</small>
              </span>
              <span>{{ person.hours }} 小时</span>
              <span>{{ person.personDays }} 人天</span>
              <span>{{ person.share }}%</span>
              <span>{{ person.entryCount }} 条</span>
            </div>
            <p v-if="!selectedSummary.people.length" class="quiet-text">当前筛选下暂无可计入统计的工时。</p>
          </div>
        </section>

        <section class="cost-section">
          <div class="section-head">
            <div>
              <h3>Top 5 人员投入</h3>
              <small>按实际工时从高到低展示。</small>
            </div>
          </div>
          <div class="top-cost-list">
            <div v-for="(person, index) in topPeople" :key="person.userId" class="top-cost-row">
              <strong>{{ index + 1 }}</strong>
              <span>{{ person.name }}</span>
              <span>{{ person.hours }} 小时 / {{ person.personDays }} 人天</span>
              <span>{{ person.share }}%</span>
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
              <span>日期</span><span>人员</span><span>事项</span><span>实际工时</span><span>标准每日工时</span><span>折算人天</span><span>状态</span>
            </div>
            <div v-for="entry in pagedRawData" :key="entry.id" class="cost-raw-row">
              <span>{{ entry.workDate }}</span>
              <span>{{ entry.personName }}</span>
              <span>
                <strong>{{ entry.issueCode }}</strong>
                <small>{{ entry.issueTitle }}</small>
              </span>
              <span>{{ entry.hours }} 小时</span>
              <span>{{ entry.standardHoursPerDay }} 小时</span>
              <strong>{{ entry.personDays }} 人天</strong>
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
          <span>项目总人天</span>
          <input v-model.number="createForm.plannedPersonDays" min="0.01" step="0.5" type="number" />
        </label>
        <label>
          <span>标准每日工时</span>
          <input v-model.number="createForm.standardHoursPerDay" min="0.5" max="24" step="0.5" type="number" />
        </label>
      </div>
      <label>
        <span>备注</span>
        <textarea v-model="createForm.notes" rows="3" placeholder="例如项目完整周期计划投入 120 人天" />
      </label>

      <template #footer>
        <Button variant="ghost" @click="createOpen = false">取消</Button>
        <Button variant="primary" :disabled="!createForm.projectId || createForm.plannedPersonDays <= 0" @click="submitCreate">创建</Button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { calculateProjectCost, normalizeWeekFilter } from "../domain/cost.js";
import { CostAccessPolicy } from "../server/policies/costAccessPolicy.js";
import Button from "../components/ui/Button.vue";
import DetailPanel from "../components/ui/DetailPanel.vue";
import EmptyState from "../components/common/EmptyState.vue";
import Modal from "../components/ui/Modal.vue";
import StatusLozenge from "../components/ui/StatusLozenge.vue";

const props = defineProps({
  projects: { type: Array, required: true },
  issues: { type: Array, required: true },
  users: { type: Array, required: true },
  timeEntries: { type: Array, required: true },
  costRecords: { type: Array, required: true },
  context: { type: Object, required: true },
});

const emit = defineEmits(["create", "update", "delete", "export"]);

const search = ref("");
const projectFilter = ref("");
const ownerFilter = ref("");
const teamFilter = ref("");
const riskFilter = ref("");
const costTypeFilter = ref("person-days");
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
  plannedPersonDays: 0,
  standardHoursPerDay: 8,
  notes: "",
});

const projectMap = computed(() => new Map(props.projects.map((project) => [project.id, project])));
const recordRows = computed(() => props.costRecords
  .filter((record) => record.status === "ACTIVE" && !record.deletedAt)
  .filter((record) => CostAccessPolicy.canViewCost(props.context, projectMap.value.get(record.projectId)))
  .map((record) => {
    const project = projectMap.value.get(record.projectId);
    const summary = record.summary || calculateProjectCost({
      project,
      record,
      timeEntries: props.timeEntries,
      issues: props.issues,
      users: props.users,
    });
    return { ...record, project, summary };
  }));
const ownerOptions = computed(() => [...new Set(recordRows.value.map((row) => row.summary.ownerName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")));
const teamOptions = computed(() => [...new Set(recordRows.value.flatMap((row) => row.project.executionTeams || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")));
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const rows = recordRows.value
    .filter((row) => !keyword || `${row.project.name}${row.project.code || row.project.id}`.toLowerCase().includes(keyword))
    .filter((row) => !projectFilter.value || row.project.id === projectFilter.value)
    .filter((row) => !ownerFilter.value || row.summary.ownerName === ownerFilter.value)
    .filter((row) => !teamFilter.value || (row.project.executionTeams || []).includes(teamFilter.value))
    .filter((row) => !riskFilter.value || (riskFilter.value === "overrun" ? Number(row.summary.remainingPersonDays) < 0 : Number(row.summary.remainingPersonDays) >= 0));
  return sortRows(rows);
});
const costOverview = computed(() => {
  const rows = filteredRows.value;
  const planned = rows.reduce((sum, row) => sum + Number(row.summary.plannedPersonDays || 0), 0);
  const actual = rows.reduce((sum, row) => sum + Number(row.summary.actualPersonDays || 0), 0);
  const forecast = rows.reduce((sum, row) => sum + forecastPersonDays(row.summary), 0);
  return {
    plannedPersonDays: formatDays(planned),
    actualPersonDays: formatDays(actual),
    forecastPersonDays: formatDays(forecast),
    remainingPersonDays: formatDays(planned - actual),
    riskCount: rows.filter((row) => Number(row.summary.remainingPersonDays) < 0).length,
  };
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const selectedRow = computed(() => recordRows.value.find((row) => row.id === selectedRecordId.value) || null);
const selectedSummary = computed(() => {
  if (!selectedRow.value) return null;
  if (!weekStart.value && selectedRow.value.summary) return selectedRow.value.summary;
  return calculateProjectCost({
    project: selectedRow.value.project,
    record: selectedRow.value,
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
const isWeekFiltered = computed(() => Boolean(normalizeWeekFilter(weekStart.value)));
const weekRangeLabel = computed(() => {
  const range = normalizeWeekFilter(weekStart.value);
  return range ? `${range.start} 至 ${range.end}` : "未筛选，展示全周期可计入工时";
});

watch([search, projectFilter, ownerFilter, teamFilter, riskFilter, costTypeFilter, sort], () => { page.value = 1; });
watch(selectedRow, (row) => {
  rawPage.value = 1;
  if (!row) return;
  editForm.plannedPersonDays = Number(row.plannedPersonDays || 0);
  editForm.standardHoursPerDay = Number(row.standardHoursPerDay) || 8;
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
  return [
    copy.getFullYear(),
    String(copy.getMonth() + 1).padStart(2, "0"),
    String(copy.getDate()).padStart(2, "0"),
  ].join("-");
}

function sortRows(rows) {
  if (sort.value === "burnRate:desc") return [...rows].sort((a, b) => Number(b.summary.personDayBurnRate) - Number(a.summary.personDayBurnRate));
  if (sort.value === "actualHours:desc") return [...rows].sort((a, b) => Number(b.summary.actualHours) - Number(a.summary.actualHours));
  if (sort.value === "remaining:asc") return [...rows].sort((a, b) => Number(a.summary.remainingPersonDays) - Number(b.summary.remainingPersonDays));
  if (sort.value === "project:asc") return [...rows].sort((a, b) => a.project.name.localeCompare(b.project.name, "zh-CN"));
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function forecastPersonDays(summary) {
  return formatDays(Math.max(Number(summary.plannedPersonDays || 0), Number(summary.actualPersonDays || 0)));
}

function formatDays(value) {
  return Number(Number(value || 0).toFixed(2));
}

function defaultCreateForm() {
  return {
    projectId: "",
    plannedPersonDays: "",
    standardHoursPerDay: 8,
    notes: "",
  };
}
</script>
