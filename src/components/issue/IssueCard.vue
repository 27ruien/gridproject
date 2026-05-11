<template>
  <button class="issue-card" type="button" @click="$emit('open', issue.id)">
    <span class="card-meta">
      <span>{{ issue.code }}</span>
      <PriorityPill :priority="issue.priority" />
    </span>
    <strong>{{ issue.title }}</strong>
    <p>{{ issue.next }}</p>
    <span class="card-meta">
      <span>{{ issue.type }}</span>
      <span>执行：{{ issue.owner }}</span>
      <span>创建：{{ issue.creator }}</span>
      <span>{{ issue.startDate || "未设开始" }} - {{ issue.dueDate || "未设截止" }}</span>
      <span>{{ issue.actualHours }}/{{ issue.estimatedHours }}h</span>
    </span>
    <span class="card-actions" @click.stop>
      <select :value="issue.status" @change="$emit('status', issue.id, $event.target.value)">
        <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
      </select>
      <button class="btn ghost tiny" type="button" @click="$emit('advance', issue.id)">推进</button>
    </span>
  </button>
</template>

<script setup>
import PriorityPill from "../common/PriorityPill.vue";

defineProps({
  issue: { type: Object, required: true },
  statuses: { type: Array, required: true },
});

defineEmits(["open", "status", "advance"]);
</script>
