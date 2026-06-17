<template>
  <article class="issue-card">
    <button class="issue-card-main" type="button" @click="$emit('open', issue.id)">
      <span class="card-meta">
        <span>{{ issue.code }}</span>
        <PriorityPill :priority="issue.priority" />
      </span>
      <strong>{{ issue.title }}</strong>
      <span class="card-meta">
        <span>执行：{{ issue.owner }}</span>
        <span>截止：{{ issue.dueDate || "未设截止" }}</span>
      </span>
    </button>
    <div class="card-actions">
      <select :value="issue.status" @change="$emit('status', issue.id, $event.target.value)">
        <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
      </select>
    </div>
  </article>
</template>

<script setup>
import PriorityPill from "../common/PriorityPill.vue";

defineProps({
  issue: { type: Object, required: true },
  statuses: { type: Array, required: true },
});

defineEmits(["open", "status"]);
</script>
