<template>
  <article
    class="issue-card"
    :class="{ dragging }"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <div class="issue-card-topline">
      <span class="issue-type-icon" :title="issue.type">{{ issue.type.slice(0, 1) }}</span>
      <span class="issue-code">{{ issue.code }}</span>
      <OverflowMenu :label="`${issue.code} 更多操作`">
        <template #default="{ close }">
          <p class="issue-menu-label">更改状态</p>
          <button
            v-for="status in statuses"
            :key="status"
            class="issue-menu-option"
            :class="{ active: issue.status === status }"
            type="button"
            @click="changeStatus(status, close)"
          >
            <span class="issue-status-marker" :class="statusTone(status)"><i></i>{{ status }}</span>
            <Icon v-if="issue.status === status" name="check" />
          </button>
        </template>
      </OverflowMenu>
    </div>
    <button class="issue-card-main" type="button" @click="$emit('open', issue.id)">
      <strong>{{ issue.title }}</strong>
    </button>
    <footer class="issue-card-footer">
      <PriorityPill :priority="issue.priority" />
      <span class="issue-due-date" :class="{ overdue: isOverdue(issue) }"><Icon name="calendar" />{{ formatDate(issue.dueDate) }}</span>
      <span class="issue-owner-avatar" :title="`负责人：${issue.owner}`">{{ issue.owner.slice(0, 1) }}</span>
    </footer>
  </article>
</template>

<script setup>
import PriorityPill from "../common/PriorityPill.vue";
import Icon from "../ui/Icon.vue";
import OverflowMenu from "../ui/OverflowMenu.vue";

const props = defineProps({
  issue: { type: Object, required: true },
  statuses: { type: Array, required: true },
  dragging: { type: Boolean, default: false },
});

const emit = defineEmits(["open", "status", "dragstart", "dragend"]);

function changeStatus(status, close) {
  emit("status", props.issue.id, status);
  close();
}

function statusTone(status) {
  if (/完成|验收/.test(status)) return "done";
  if (/进行|开发|测试/.test(status)) return "in-progress";
  if (/风险|阻塞/.test(status)) return "danger";
  return "neutral";
}

function formatDate(value) {
  if (!value) return "未设置";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isOverdue(issue) {
  if (!issue.dueDate || /完成|验收/.test(issue.status)) return false;
  return new Date(`${issue.dueDate}T23:59:59`).getTime() < Date.now();
}
</script>
