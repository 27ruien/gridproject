<template>
  <DataTable :columns="columns" :rows="projects" empty-text="暂无项目。创建项目后会在这里显示关键进度和风险信号。" @row-click="$emit('open', $event.id)">
    <template #row="{ row }">
      <span class="project-table-main">
        <strong class="truncate">{{ row.name }}</strong>
        <small class="truncate">{{ row.description }}</small>
      </span>
      <StatusLozenge :label="row.status" />
      <span class="truncate">{{ row.owner }}</span>
      <span class="table-progress">
        <strong>{{ row.summary.progress }}%</strong>
        <ProgressBar :value="row.summary.progress" />
      </span>
      <span class="truncate">{{ row.template.badge }}</span>
      <span class="truncate">{{ row.dueDate }}</span>
      <span>{{ row.summary.riskCount }} / {{ row.summary.overdueCount }}</span>
    </template>
  </DataTable>
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
  { key: "name", label: "项目名称", width: "minmax(240px, 2fr)" },
  { key: "status", label: "状态", width: "110px" },
  { key: "owner", label: "负责人", width: "90px" },
  { key: "progress", label: "进度", width: "140px" },
  { key: "template", label: "模板", width: "80px" },
  { key: "dueDate", label: "截止日期", width: "112px" },
  { key: "risk", label: "风险/逾期", width: "96px" },
];
</script>
