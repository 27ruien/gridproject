<template>
  <div class="issue-table" :class="`density-${density}`">
    <div class="issue-table-head">
      <span aria-label="事项类型"></span>
      <span>编号</span>
      <span>事项</span>
      <span>状态</span>
      <span>优先级</span>
      <span>负责人</span>
      <span>截止日期</span>
      <span aria-label="操作"></span>
    </div>
    <div
      v-for="issue in issues"
      :key="issue.id"
      class="issue-table-row"
      :class="{ selected: selectedId === issue.id }"
      role="row"
      :aria-selected="selectedId === issue.id"
      tabindex="0"
      @click="openFromRow($event, issue.id)"
      @keydown.enter.prevent="openFromRow($event, issue.id)"
      @keydown.space.prevent="openFromRow($event, issue.id)"
    >
      <span class="issue-type-icon" :title="issue.type">{{ issue.type.slice(0, 1) }}</span>
      <span class="issue-code">{{ issue.code }}</span>
      <span class="issue-title-column">
        <button class="issue-title-cell" type="button" @click="$emit('open', issue.id)">
          <strong>{{ issue.title }}</strong>
        </button>
      </span>
      <span class="issue-status-marker" :class="statusTone(issue.status)"><i></i>{{ issue.status }}</span>
      <PriorityPill :priority="issue.priority" />
      <span class="issue-owner-avatar" :title="`负责人：${issue.owner}`">{{ issue.owner.slice(0, 1) }}</span>
      <span class="issue-due-date" :class="{ overdue: isOverdue(issue) }">
        <Icon name="calendar" />
        {{ formatDate(issue.dueDate) }}
      </span>
      <OverflowMenu class="issue-row-menu" :label="`${issue.code} 更多操作`">
        <template #default="{ close }">
          <p class="issue-menu-label">更改状态</p>
          <button
            v-for="status in statuses"
            :key="status"
            class="issue-menu-option"
            :class="{ active: issue.status === status }"
            type="button"
            @click="changeStatus(issue.id, status, close)"
          >
            <span class="issue-status-marker" :class="statusTone(status)"><i></i>{{ status }}</span>
            <Icon v-if="issue.status === status" name="check" />
          </button>
        </template>
      </OverflowMenu>
    </div>

    <div class="issue-mobile-list">
      <article v-for="issue in issues" :key="`mobile-${issue.id}`" class="issue-mobile-card" :class="{ selected: selectedId === issue.id }">
        <button class="issue-mobile-main" type="button" @click="selectAndOpen(issue.id)">
          <span class="issue-mobile-anchor">
            <span class="issue-type-icon">{{ issue.type.slice(0, 1) }}</span>
            <span class="issue-code">{{ issue.code }}</span>
            <span class="issue-status-marker" :class="statusTone(issue.status)"><i></i>{{ issue.status }}</span>
          </span>
          <strong>{{ issue.title }}</strong>
          <span class="issue-mobile-meta">
            <PriorityPill :priority="issue.priority" />
            <span class="issue-owner-avatar" :title="issue.owner">{{ issue.owner.slice(0, 1) }}</span>
            <span class="issue-due-date"><Icon name="calendar" />{{ formatDate(issue.dueDate) }}</span>
          </span>
        </button>
        <OverflowMenu :label="`${issue.code} 更多操作`">
          <template #default="{ close }">
            <button v-for="status in statuses" :key="status" class="issue-menu-option" :class="{ active: issue.status === status }" type="button" @click="changeStatus(issue.id, status, close)">
              <span class="issue-status-marker" :class="statusTone(status)"><i></i>{{ status }}</span>
              <Icon v-if="issue.status === status" name="check" />
            </button>
          </template>
        </OverflowMenu>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import PriorityPill from "../common/PriorityPill.vue";
import Icon from "../ui/Icon.vue";
import OverflowMenu from "../ui/OverflowMenu.vue";

defineProps({
  issues: { type: Array, required: true },
  statuses: { type: Array, required: true },
  density: { type: String, default: "comfortable" },
});

const emit = defineEmits(["open", "status"]);
const selectedId = ref("");

function openFromRow(event, issueId) {
  if (event.target.closest("button, select, input, textarea, a, [role='menuitem']")) return;
  selectAndOpen(issueId);
}

function selectAndOpen(issueId) {
  selectedId.value = issueId;
  emit("open", issueId);
}

function changeStatus(issueId, status, close) {
  emit("status", issueId, status);
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
  const due = new Date(`${issue.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}
</script>
