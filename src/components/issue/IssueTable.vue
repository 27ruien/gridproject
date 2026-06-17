<template>
  <div class="issue-table" :class="`density-${density}`">
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
    <div
      v-for="issue in issues"
      :key="issue.id"
      class="issue-table-row"
      role="row"
      tabindex="0"
      @keydown.enter.prevent="openFromRow($event, issue.id)"
      @keydown.space.prevent="openFromRow($event, issue.id)"
    >
      <span>{{ issue.type }}</span>
      <span>
        <button class="issue-title-cell" type="button" @click="$emit('open', issue.id)">
          <strong>{{ issue.title }}</strong>
          <small>{{ issue.code }} · {{ issue.next }}</small>
        </button>
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
    </div>

    <div class="issue-mobile-list">
      <article v-for="issue in issues" :key="`mobile-${issue.id}`" class="issue-mobile-card">
        <button class="issue-title-cell" type="button" @click="$emit('open', issue.id)">
          <span class="card-meta">
            <span>{{ issue.code }}</span>
            <PriorityPill :priority="issue.priority" />
          </span>
          <strong>{{ issue.title }}</strong>
          <small>{{ issue.type }} · {{ issue.owner }} · {{ issue.dueDate || "未设截止" }}</small>
        </button>
        <select :value="issue.status" @change="$emit('status', issue.id, $event.target.value)">
          <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </article>
    </div>
  </div>
</template>

<script setup>
import PriorityPill from "../common/PriorityPill.vue";

defineProps({
  issues: { type: Array, required: true },
  statuses: { type: Array, required: true },
  density: { type: String, default: "comfortable" },
});

const emit = defineEmits(["open", "status"]);

function openFromRow(event, issueId) {
  if (event.target !== event.currentTarget) return;
  emit("open", issueId);
}
</script>
