<template>
  <div class="data-table">
    <div class="data-table-head" :style="gridStyle">
      <span v-for="column in columns" :key="column.key">{{ column.label }}</span>
    </div>
    <button
      v-for="row in rows"
      :key="row[rowKey]"
      class="data-table-row"
      type="button"
      :style="gridStyle"
      @click="$emit('row-click', row)"
    >
      <slot name="row" :row="row" />
    </button>
    <div v-if="!rows.length" class="data-table-empty">
      <slot name="empty">{{ emptyText }}</slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: "id" },
  emptyText: { type: String, default: "暂无数据。" },
});

defineEmits(["row-click"]);

const gridStyle = computed(() => ({
  gridTemplateColumns: props.columns.map((column) => column.width || "minmax(0, 1fr)").join(" "),
}));
</script>
