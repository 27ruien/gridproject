<template>
  <button class="template-card" :class="{ selected }" type="button" @click="$emit('select', template.id)">
    <header>
      <div>
        <span class="pill" :class="template.accent">{{ template.badge }}</span>
        <h3>{{ template.name }}</h3>
      </div>
      <span class="template-views">{{ template.views.length }} 个视图</span>
    </header>
    <p>{{ template.summary }}</p>
    <ul>
      <li v-for="point in templateHighlights" :key="point">{{ point }}</li>
    </ul>
  </button>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  template: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

defineEmits(["select"]);

const templateHighlights = computed(() => [
  `默认视图：${props.template.views.slice(0, 3).join("、")}`,
  `事项类型：${props.template.issueTypes.slice(0, 4).join("、")}`,
  props.template.emptyState.description,
]);
</script>

