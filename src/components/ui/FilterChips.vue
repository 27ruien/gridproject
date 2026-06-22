<template>
  <div v-if="chips.length" class="filter-chip-row" aria-label="已启用筛选">
    <button
      v-for="chip in chips"
      :key="chip.key"
      class="filter-chip-token"
      type="button"
      :aria-label="`清除${chip.label}`"
      @click="$emit('remove', chip.key)"
    >
      <span>{{ chip.label }}</span>
      <Icon name="close" />
    </button>
    <button class="filter-chip-clear" type="button" @click="$emit('clear-all')">{{ clearAllLabel }}</button>
  </div>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
  chips: { type: Array, default: () => [] },
  clearAllLabel: { type: String, default: "清除全部" },
});

defineEmits(["remove", "clear-all"]);
</script>
