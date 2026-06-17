<template>
  <section class="view-stack">
    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">回收站</p>
          <h2>30 天内可恢复的项目和任务</h2>
          <p>删除不会立即清空数据；超过 30 天的记录会被视为不可恢复。</p>
        </div>
      </div>

      <div class="trash-list">
        <article v-for="item in trash" :key="item.id" class="trash-row">
          <div>
            <span class="pill neutral">{{ item.type === "project" ? "项目" : "任务" }}</span>
            <strong>{{ item.entity.name || item.entity.title }}</strong>
            <small>删除于 {{ formatDateTime(item.deletedAt) }} · 剩余 {{ remainingDays(item) }} 天可恢复</small>
          </div>
          <Button variant="primary" size="small" :disabled="remainingDays(item) <= 0" @click="$emit('restore', item.id)">
            恢复
          </Button>
        </article>
        <EmptyState
          v-if="!trash.length"
          icon-name="trash"
          title="回收站为空"
          description="删除的项目或任务会在这里保留 30 天。"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import EmptyState from "../components/common/EmptyState.vue";
import Button from "../components/ui/Button.vue";
import { TRASH_RETENTION_DAYS, daysSinceDeleted } from "../domain/trash.js";

defineProps({
  trash: { type: Array, required: true },
});

defineEmits(["restore"]);

function remainingDays(item) {
  return Math.max(0, TRASH_RETENTION_DAYS - daysSinceDeleted(item));
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
</script>
