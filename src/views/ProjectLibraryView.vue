<template>
  <section class="view-stack project-library-view">
    <PageHeader title="项目库" description="按负责人、执行团队、当前阶段和上线风险管理项目。">
      <template #actions>
        <Button variant="ghost" size="small" @click="$emit('trash')">回收站</Button>
      </template>
    </PageHeader>
    <ProjectLibraryToolbar
      v-model:search="search"
      v-model:sort="sort"
      :filters="filters"
      :options="filterOptions"
      @update:filters="filters = $event"
      @clear-filters="clearFilters"
      @remove-filter="removeFilter"
      @create="$emit('create')"
    />
    <ProjectCardGrid
      :projects="filteredRows"
      :date-format="dateFormat"
      :empty-title="hasQuery ? '没有符合条件的项目' : '还没有项目'"
      :empty-text="hasQuery ? '调整搜索或筛选条件后再试。' : '使用上方创建项目入口开始组织工作。'"
      @open="$emit('open', $event)"
      @edit="$emit('edit', $event)"
    />
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import { PROJECT_STATUS_OPTIONS } from "../domain/project.js";
import Button from "../components/ui/Button.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import ProjectCardGrid from "../components/project/ProjectCardGrid.vue";
import ProjectLibraryToolbar from "../components/project/ProjectLibraryToolbar.vue";

const props = defineProps({
  projectRows: { type: Array, required: true },
  dateFormat: { type: String, default: "yyyy-mm-dd" },
});
defineEmits(["create", "trash", "open", "edit"]);

const search = ref("");
const sort = ref("updated");
const filters = ref(emptyFilters());
const executionTeamOptions = ["商务", "设计", "开发", "特效"];

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const active = filters.value;
  return props.projectRows.filter((entry) => {
    const searchable = `${entry.name} ${entry.description} ${entry.owner} ${(entry.executionTeams || []).join(" ")}`.toLowerCase();
    const phase = currentPhase(entry);
    if (keyword && !searchable.includes(keyword)) return false;
    if (active.team && !(entry.executionTeams || []).includes(active.team)) return false;
    if (active.status && entry.status !== active.status) return false;
    if (active.owner && entry.owner !== active.owner) return false;
    if (active.phase && phase !== active.phase) return false;
    if (active.releaseFrom && (!entry.releaseDate || entry.releaseDate < active.releaseFrom)) return false;
    if (active.releaseTo && (!entry.releaseDate || entry.releaseDate > active.releaseTo)) return false;
    if (active.risk === "risk" && !entry.summary.riskCount) return false;
    if (active.risk === "overdue" && !entry.summary.overdueCount) return false;
    if (active.risk === "clear" && (entry.summary.riskCount || entry.summary.overdueCount)) return false;
    return true;
  }).sort(sortFunction(sort.value));
});

const hasQuery = computed(() => Boolean(search.value.trim() || Object.values(filters.value).some(Boolean)));
const filterOptions = computed(() => ({
  statuses: PROJECT_STATUS_OPTIONS,
  teams: executionTeamOptions,
  owners: [...new Set(props.projectRows.map((entry) => entry.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")),
  phases: [...new Set(props.projectRows.map(currentPhase).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")),
}));

function emptyFilters() {
  return { status: "", team: "", owner: "", phase: "", releaseFrom: "", releaseTo: "", risk: "" };
}

function clearFilters() {
  filters.value = emptyFilters();
}

function removeFilter(key) {
  filters.value = { ...filters.value, [key]: "" };
}

function currentPhase(entry) {
  return entry.milestones?.find((milestone) => milestone.status !== "已完成")?.name || entry.status || "未设置";
}

function sortFunction(value) {
  if (value === "name") return (a, b) => a.name.localeCompare(b.name, "zh-CN");
  if (value === "release") return (a, b) => String(a.releaseDate || "9999").localeCompare(String(b.releaseDate || "9999"));
  if (value === "risk") return (a, b) => (b.summary.overdueCount - a.summary.overdueCount) || (b.summary.riskCount - a.summary.riskCount) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  return (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt));
}
</script>
