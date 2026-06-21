<template>
  <div class="dashboard-project-list">
    <button
      v-for="project in projects"
      :key="project.id"
      class="dashboard-project-row"
      type="button"
      @click="$emit('open', project.id)"
    >
      <span class="dashboard-project-main">
        <strong class="truncate">{{ project.name }}</strong>
        <small class="truncate">上线 {{ project.releaseDate || "未设置" }} · {{ project.owner }}</small>
      </span>
      <StatusLozenge :label="project.status" />
      <span class="dashboard-progress">
        <strong>{{ project.summary.progress }}%</strong>
        <ProgressBar :value="project.summary.progress" />
      </span>
      <span class="dashboard-risk" :class="{ danger: project.summary.riskCount || project.summary.overdueCount }">
        {{ project.summary.riskCount }} / {{ project.summary.overdueCount }}
      </span>
    </button>
    <div v-if="!projects.length" class="dashboard-project-empty">
      暂无项目。创建项目后会在这里显示关键进度和风险信号。
    </div>
  </div>
</template>

<script setup>
import ProgressBar from "../common/ProgressBar.vue";
import StatusLozenge from "../ui/StatusLozenge.vue";

defineProps({
  projects: { type: Array, required: true },
});

defineEmits(["open"]);
</script>
