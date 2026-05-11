<template>
  <section class="phase-view">
    <article v-for="(milestone, index) in milestones" :key="milestone.name" class="phase-card">
      <span class="phase-index">{{ index + 1 }}</span>
      <div>
        <h3>{{ milestone.name }}</h3>
        <p>{{ milestone.window }} · {{ milestone.focus }}</p>
        <small>关联事项 {{ relatedCount(index) }} 个</small>
      </div>
    </article>
  </section>
</template>

<script setup>
const props = defineProps({
  milestones: { type: Array, required: true },
  issues: { type: Array, required: true },
});

function relatedCount(index) {
  if (!props.issues.length) return 0;
  if (index === 0) return props.issues.filter((issue) => ["阶段", "交付物"].includes(issue.type)).length;
  if (index === 1) return props.issues.filter((issue) => ["任务", "变更"].includes(issue.type)).length;
  return props.issues.filter((issue) => ["风险", "验收项", "交付物"].includes(issue.type)).length;
}
</script>

