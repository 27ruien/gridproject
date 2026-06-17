<template>
  <div>
    <div class="board">
      <section v-for="status in statuses" :key="status" class="board-column">
        <header>
          <h3>{{ status }}</h3>
          <span class="pill neutral">{{ grouped[status]?.length || 0 }}</span>
        </header>
        <div class="cards">
          <IssueCard
            v-for="issue in grouped[status]"
            :key="issue.id"
            :issue="issue"
            :statuses="statuses"
            @open="$emit('open', $event)"
            @status="(...args) => $emit('status', ...args)"
            @advance="$emit('advance', $event)"
          />
          <EmptyState
            v-if="!grouped[status]?.length"
            title="暂无事项"
            description="这个状态列还没有待处理事项。"
          />
        </div>
      </section>
    </div>
    <div class="board-mobile-list">
      <section v-for="status in statuses" :key="`mobile-${status}`" class="board-mobile-group">
        <header>
          <h3>{{ status }}</h3>
          <span class="pill neutral">{{ grouped[status]?.length || 0 }}</span>
        </header>
        <IssueCard
          v-for="issue in grouped[status]"
          :key="`mobile-card-${issue.id}`"
          :issue="issue"
          :statuses="statuses"
          @open="$emit('open', $event)"
          @status="(...args) => $emit('status', ...args)"
          @advance="$emit('advance', $event)"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import IssueCard from "../issue/IssueCard.vue";
import EmptyState from "../common/EmptyState.vue";

const props = defineProps({
  issues: { type: Array, required: true },
  statuses: { type: Array, required: true },
});

defineEmits(["open", "status", "advance"]);

const grouped = computed(() => props.statuses.reduce((result, status) => {
  result[status] = props.issues.filter((issue) => issue.status === status);
  return result;
}, {}));
</script>
