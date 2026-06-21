<template>
  <div class="project-table-wrap">
    <DataTable :columns="columns" :rows="projects" empty-text="没有符合当前条件的项目。" @row-click="$emit('open', $event.id)">
      <template #row="{ row }">
        <span class="project-table-main">
          <strong class="truncate" :title="row.name">{{ row.name }}</strong>
          <small class="truncate" :title="row.description">{{ row.description }}</small>
        </span>
        <StatusLozenge :label="row.status" />
        <span class="truncate">{{ row.owner }}</span>
        <span class="team-chip-list" :title="teamText(row)">
          <small v-for="team in row.executionTeams?.slice(0, 2)" :key="team">{{ team }}</small>
          <small v-if="!row.executionTeams?.length" class="muted-chip">未指定</small>
          <small v-if="row.executionTeams?.length > 2">+{{ row.executionTeams.length - 2 }}</small>
        </span>
        <span class="table-progress">
          <strong>{{ row.summary.progress }}%</strong>
          <ProgressBar :value="row.summary.progress" />
        </span>
        <span class="truncate" :title="currentPhase(row)">{{ currentPhase(row) }}</span>
        <span class="truncate">{{ row.releaseDate || "未设置" }}</span>
        <span class="project-risk-cell" :class="{ danger: row.summary.riskCount || row.summary.overdueCount }">
          {{ row.summary.riskCount }} / {{ row.summary.overdueCount }}
        </span>
      </template>
    </DataTable>
    <div class="project-mobile-list">
      <button v-for="row in projects" :key="`card-${row.id}`" class="project-mobile-card" type="button" @click="$emit('open', row.id)">
        <span class="mobile-card-meta">
          <StatusLozenge :label="row.status" />
          <span :class="{ danger: row.summary.riskCount || row.summary.overdueCount }">风险 {{ row.summary.riskCount }} / 逾期 {{ row.summary.overdueCount }}</span>
        </span>
        <strong class="truncate">{{ row.name }}</strong>
        <small class="line-clamp-2">{{ row.description }}</small>
        <span class="mobile-card-meta">
          <span>{{ row.owner }} · {{ teamText(row) }}</span>
          <span>上线 {{ row.releaseDate || "未设置" }}</span>
        </span>
        <span class="table-progress">
          <strong>{{ row.summary.progress }}%</strong>
          <ProgressBar :value="row.summary.progress" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import DataTable from "../ui/DataTable.vue";
import StatusLozenge from "../ui/StatusLozenge.vue";
import ProgressBar from "../common/ProgressBar.vue";

defineProps({
  projects: { type: Array, required: true },
});

defineEmits(["open"]);

const columns = [
  { key: "name", label: "项目名称", width: "minmax(230px, 2fr)" },
  { key: "status", label: "状态", width: "104px" },
  { key: "owner", label: "负责人", width: "84px" },
  { key: "teams", label: "执行团队", width: "130px" },
  { key: "progress", label: "进度", width: "130px" },
  { key: "phase", label: "当前阶段", width: "110px" },
  { key: "releaseDate", label: "上线日期", width: "104px" },
  { key: "risk", label: "风险/逾期", width: "88px" },
];

function currentPhase(row) {
  return row.milestones?.find((milestone) => milestone.status !== "已完成")?.name || row.status || "未设置";
}

function teamText(row) {
  return row.executionTeams?.length ? row.executionTeams.join("、") : "未指定团队";
}
</script>
