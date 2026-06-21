<template>
  <article
    class="issue-card"
    :class="{ dragging }"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <div class="issue-card-topline">
      <span class="issue-type-icon" :class="`type-${issueTypeMeta(issue.type).tone}`" :title="issue.type"><Icon :name="issueTypeMeta(issue.type).icon" /></span>
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
            <span class="issue-status-marker" :class="issueStatusTone(status)"><i></i>{{ status }}</span>
            <Icon v-if="issue.status === status" name="check" />
          </button>
        </template>
      </OverflowMenu>
    </div>
    <button class="issue-card-main" type="button" @click="$emit('open', issue.id)">
      <strong>{{ issue.title }}</strong>
    </button>
    <div v-if="issue.labels?.length" class="issue-card-labels">
      <span v-for="label in issue.labels.slice(0, 2)" :key="label">{{ label }}</span>
    </div>
    <footer class="issue-card-footer">
      <PriorityPill :priority="issue.priority" />
      <span class="issue-due-date" :class="{ overdue: isIssueOverdue(issue) }"><Icon name="calendar" />{{ formatIssueDate(issue.dueDate) }}</span>
      <span class="owner-avatar-stack" :title="ownerTitle">
        <span v-for="owner in issueOwners(issue).slice(0, 3)" :key="owner" class="issue-owner-avatar">{{ owner.slice(0, 1) }}</span>
        <span v-if="!issueOwners(issue).length" class="issue-owner-avatar unassigned">—</span>
      </span>
    </footer>
  </article>
</template>

<script setup>
import { computed } from "vue";
import PriorityPill from "../common/PriorityPill.vue";
import Icon from "../ui/Icon.vue";
import OverflowMenu from "../ui/OverflowMenu.vue";
import { formatIssueDate, isIssueOverdue, issueOwners, issueStatusTone, issueTypeMeta } from "./issuePresentation.js";

const props = defineProps({
  issue: { type: Object, required: true },
  statuses: { type: Array, required: true },
  dragging: { type: Boolean, default: false },
});

const emit = defineEmits(["open", "status", "dragstart", "dragend"]);
const ownerTitle = computed(() => {
  const owners = issueOwners(props.issue);
  return owners.length ? `负责人：${owners.join("、")}` : "未分配负责人";
});

function changeStatus(status, close) {
  emit("status", props.issue.id, status);
  close();
}

</script>
