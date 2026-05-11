<template>
  <div class="summary-grid">
    <article>
      <span>项目进度</span>
      <strong>{{ summary.progress }}%</strong>
      <ProgressBar :value="summary.progress" />
    </article>
    <article>
      <span>项目健康度</span>
      <strong>{{ summary.health }}</strong>
      <small>低于 70 需要项目负责人介入</small>
    </article>
    <article>
      <span>待办事项</span>
      <strong>{{ summary.openCount }}</strong>
      <small>已完结 {{ summary.doneCount }}，逾期 {{ summary.overdueCount }}</small>
    </article>
    <article>
      <span>投入工时</span>
      <strong>{{ summary.actualHours }}h</strong>
      <small>预估 {{ summary.estimatedHours }}h，剩余 {{ summary.remainingHours }}h</small>
    </article>
  </div>
</template>

<script setup>
import ProgressBar from "../common/ProgressBar.vue";

defineProps({
  summary: { type: Object, required: true },
});
</script>
