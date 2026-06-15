<template>
  <div class="project-tabs" role="tablist">
    <button
      v-for="item in items"
      :key="item"
      class="project-tab"
      role="tab"
      type="button"
      :aria-selected="modelValue === item"
      :class="{ active: modelValue === item }"
      @click="$emit('update:modelValue', item)"
    >
      {{ item }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  modelValue: { type: String, required: true },
});

defineEmits(["update:modelValue"]);
</script>
