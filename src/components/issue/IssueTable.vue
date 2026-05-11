<template>
  <div class="issue-table">
    <div class="issue-table-head">
      <span>类型</span>
      <span>事项</span>
      <span>执行人</span>
      <span>创建人</span>
      <span>优先级</span>
      <span>开始日期</span>
      <span>截止日期</span>
      <span>工时</span>
      <span>状态</span>
    </div>
    <button v-for="issue in issues" :key="issue.id" class="issue-table-row" type="button" @click="$emit('open', issue.id)">
      <span>{{ issue.type }}</span>
      <span>
        <strong>{{ issue.title }}</strong>
        <small>{{ issue.code }} · {{ issue.next }}</small>
      </span>
      <span>{{ issue.owner }}</span>
      <span>{{ issue.creator }}</span>
      <PriorityPill :priority="issue.priority" />
      <span>{{ issue.startDate || "未设定" }}</span>
      <span>{{ issue.dueDate || "未设定" }}</span>
      <span>{{ issue.actualHours }}/{{ issue.estimatedHours }}h</span>
      <span class="status-inline" @click.stop>
        <select :value="issue.status" @change="$emit('status', issue.id, $event.target.value)">
          <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </span>
    </button>
  </div>
</template>

<script setup>
import PriorityPill from "../common/PriorityPill.vue";

defineProps({
  issues: { type: Array, required: true },
  statuses: { type: Array, required: true },
});

defineEmits(["open", "status"]);
</script>
