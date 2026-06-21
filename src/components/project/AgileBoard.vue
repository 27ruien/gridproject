<template>
  <div>
    <div class="board">
      <section
        v-for="status in statuses"
        :key="status"
        class="board-column"
        :class="{ 'drop-target': dropTarget === status, 'drag-active': draggedIssueId }"
        @dragover.prevent="dropTarget = status"
        @drop.prevent="dropIssue(status)"
      >
        <header>
          <div class="board-column-title">
            <span class="board-status-dot" :class="statusTone(status)"></span>
            <h3>{{ status }}</h3>
            <span>{{ grouped[status]?.length || 0 }}</span>
          </div>
          <button class="board-add-button" type="button" :aria-label="`在${status}中新建事项`" @click="$emit('create')">
            <Icon name="plus" />
          </button>
        </header>
        <div class="cards">
          <IssueCard
            v-for="issue in grouped[status]"
            :key="issue.id"
            :issue="issue"
            :statuses="statuses"
            :dragging="draggedIssueId === issue.id"
            @open="$emit('open', $event)"
            @status="(...args) => $emit('status', ...args)"
            @dragstart="startDrag(issue, $event)"
            @dragend="endDrag"
          />
          <p v-if="!grouped[status]?.length" class="board-empty-note">暂无事项</p>
        </div>
      </section>
    </div>
    <div class="board-mobile-list">
      <section v-for="status in statuses" :key="`mobile-${status}`" class="board-mobile-group">
        <header>
          <div class="board-column-title">
            <span class="board-status-dot" :class="statusTone(status)"></span>
            <h3>{{ status }}</h3>
            <span>{{ grouped[status]?.length || 0 }}</span>
          </div>
          <button class="board-add-button" type="button" :aria-label="`在${status}中新建事项`" @click="$emit('create')"><Icon name="plus" /></button>
        </header>
        <IssueCard
          v-for="issue in grouped[status]"
          :key="`mobile-card-${issue.id}`"
          :issue="issue"
          :statuses="statuses"
          @open="$emit('open', $event)"
          @status="(...args) => $emit('status', ...args)"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import IssueCard from "../issue/IssueCard.vue";
import Icon from "../ui/Icon.vue";

const props = defineProps({
  issues: { type: Array, required: true },
  statuses: { type: Array, required: true },
});

const emit = defineEmits(["open", "status", "create"]);
const draggedIssueId = ref("");
const draggedIssueStatus = ref("");
const dropTarget = ref("");

const grouped = computed(() => props.statuses.reduce((result, status) => {
  result[status] = props.issues.filter((issue) => issue.status === status);
  return result;
}, {}));

function startDrag(issue, event) {
  draggedIssueId.value = issue.id;
  draggedIssueStatus.value = issue.status;
  dropTarget.value = issue.status;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", issue.id);
}

function endDrag() {
  draggedIssueId.value = "";
  draggedIssueStatus.value = "";
  dropTarget.value = "";
}

function dropIssue(status) {
  if (draggedIssueId.value && status !== draggedIssueStatus.value) {
    emit("status", draggedIssueId.value, status);
  }
  endDrag();
}

function statusTone(status) {
  if (/完成|验收/.test(status)) return "done";
  if (/进行|开发|测试/.test(status)) return "in-progress";
  if (/风险|阻塞/.test(status)) return "danger";
  return "neutral";
}
</script>
