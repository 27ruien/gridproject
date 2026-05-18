<template>
  <section class="phase-view">
    <article v-for="(milestone, index) in milestones" :key="milestone.id || milestone.name" class="phase-card">
      <span class="phase-index">{{ index + 1 }}</span>
      <div>
        <div class="phase-title-row">
          <h3>{{ milestone.name }}</h3>
          <span class="phase-status" :class="milestoneTone(milestone.status)">{{ milestone.status }}</span>
        </div>
        <p>{{ milestone.window }} · 截止 {{ milestone.dueDate || "未设置" }}</p>
        <small>{{ milestone.focus }} · 关联事项 {{ relatedCount(index) }} 个</small>
        <div v-if="editable" class="phase-status-actions">
          <button
            v-for="status in milestoneStatuses"
            :key="status"
            type="button"
            :class="{ active: milestone.status === status }"
            @click="$emit('status', index, status)"
          >
            {{ status }}
          </button>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { MILESTONE_STATUS_OPTIONS, milestoneTone } from "../../domain/milestone.js";

const props = defineProps({
  milestones: { type: Array, required: true },
  issues: { type: Array, required: true },
  editable: { type: Boolean, default: false },
});

defineEmits(["status"]);
const milestoneStatuses = MILESTONE_STATUS_OPTIONS;

function relatedCount(index) {
  if (!props.issues.length) return 0;
  if (index === 0) return props.issues.filter((issue) => ["阶段", "交付物"].includes(issue.type)).length;
  if (index === 1) return props.issues.filter((issue) => ["任务", "变更"].includes(issue.type)).length;
  return props.issues.filter((issue) => ["风险", "验收项", "交付物"].includes(issue.type)).length;
}
</script>
