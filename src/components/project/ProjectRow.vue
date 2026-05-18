<template>
  <button class="project-row" type="button" @click="$emit('open', project.id)">
    <span class="type-mark" :class="template.accent">{{ template.badge.slice(0, 1) }}</span>
    <span class="row-main">
      <strong class="row-title">{{ project.name }}</strong>
      <span class="row-meta">
        <span>{{ template.badge }}</span>
        <span>{{ project.status }}</span>
        <span>负责人：{{ project.owner }}</span>
        <span>{{ project.startDate }} - {{ project.dueDate }}</span>
        <span>投入：{{ summary.actualHours }} / {{ summary.estimatedHours }}h</span>
      </span>
      <ProgressBar :value="summary.progress" />
    </span>
    <span class="row-side">
      <span class="health-score">{{ summary.health }}</span>
      <span class="row-meta">待办 {{ summary.openCount }} / 完结 {{ summary.doneCount }} / 风险 {{ summary.riskCount }}</span>
    </span>
  </button>
</template>

<script setup>
import ProgressBar from "../common/ProgressBar.vue";

defineProps({
  project: { type: Object, required: true },
  template: { type: Object, required: true },
  summary: { type: Object, required: true },
});

defineEmits(["open"]);
</script>
