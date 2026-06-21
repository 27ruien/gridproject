<template>
  <div class="issue-table" :class="`density-${density}`">
    <div class="issue-table-head">
      <span class="issue-type-column" aria-label="事项类型"></span>
      <span class="issue-code-column">编号</span>
      <span class="issue-title-column">事项</span>
      <span class="issue-status-column">状态</span>
      <span class="issue-priority-column">优先级</span>
      <span class="issue-owner-column">负责人</span>
      <span class="issue-date-column">截止日期</span>
      <span class="issue-actions-column" aria-label="操作"></span>
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
      <span class="issue-type-column issue-type-icon" :class="`type-${issueTypeMeta(issue.type).tone}`" :title="issue.type">
        <Icon :name="issueTypeMeta(issue.type).icon" />
      </span>
      <span class="issue-code-column issue-code">{{ issue.code }}</span>
      <span class="issue-title-column">
        <button class="issue-title-cell" type="button" @click="selectAndOpen(issue.id)">
          <strong>{{ issue.title }}</strong>
        </button>
      </span>
      <span class="issue-status-column issue-status-marker" :class="issueStatusTone(issue.status)"><i></i>{{ issue.status }}</span>
      <span class="issue-priority-column"><PriorityPill :priority="issue.priority" /></span>
      <span class="issue-owner-column owner-avatar-stack" :title="ownerTitle(issue)">
        <span v-for="owner in issueOwners(issue).slice(0, 3)" :key="owner" class="issue-owner-avatar">{{ owner.slice(0, 1) }}</span>
        <span v-if="!issueOwners(issue).length" class="issue-owner-avatar unassigned">—</span>
      </span>
      <span class="issue-date-column issue-due-date" :class="{ overdue: isIssueOverdue(issue) }">
        <Icon name="calendar" />
        {{ formatIssueDate(issue.dueDate) }}
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
            <span class="issue-status-marker" :class="issueStatusTone(status)"><i></i>{{ status }}</span>
            <Icon v-if="issue.status === status" name="check" />
          </button>
        </template>
      </OverflowMenu>
    </div>

    <div class="issue-mobile-list">
      <article v-for="issue in issues" :key="`mobile-${issue.id}`" class="issue-mobile-card" :class="{ selected: selectedId === issue.id }">
        <button class="issue-mobile-main" type="button" @click="selectAndOpen(issue.id)">
          <span class="issue-mobile-anchor">
            <span class="issue-type-icon" :class="`type-${issueTypeMeta(issue.type).tone}`" :title="issue.type"><Icon :name="issueTypeMeta(issue.type).icon" /></span>
            <span class="issue-code">{{ issue.code }}</span>
            <span class="issue-status-marker" :class="issueStatusTone(issue.status)"><i></i>{{ issue.status }}</span>
          </span>
          <strong>{{ issue.title }}</strong>
          <span class="issue-mobile-meta">
            <PriorityPill :priority="issue.priority" />
            <span class="owner-avatar-stack" :title="ownerTitle(issue)">
              <span v-for="owner in issueOwners(issue).slice(0, 3)" :key="owner" class="issue-owner-avatar">{{ owner.slice(0, 1) }}</span>
              <span v-if="!issueOwners(issue).length" class="issue-owner-avatar unassigned">—</span>
            </span>
            <span class="issue-due-date" :class="{ overdue: isIssueOverdue(issue) }"><Icon name="calendar" />{{ formatIssueDate(issue.dueDate) }}</span>
          </span>
        </button>
        <OverflowMenu :label="`${issue.code} 更多操作`">
          <template #default="{ close }">
            <button v-for="status in statuses" :key="status" class="issue-menu-option" :class="{ active: issue.status === status }" type="button" @click="changeStatus(issue.id, status, close)">
              <span class="issue-status-marker" :class="issueStatusTone(status)"><i></i>{{ status }}</span>
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
import { formatIssueDate, isIssueOverdue, issueOwners, issueStatusTone, issueTypeMeta } from "./issuePresentation.js";

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

function ownerTitle(issue) {
  const owners = issueOwners(issue);
  return owners.length ? `负责人：${owners.join("、")}` : "未分配负责人";
}
</script>
