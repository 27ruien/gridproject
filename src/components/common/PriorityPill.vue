<template>
  <span class="pill" :class="tone">{{ priority }}</span>
</template>

<script setup>
import { computed } from "vue";
import { PRIORITY_TONE } from "../../domain/issue";

const props = defineProps({
  priority: { type: String, required: true },
});

const tone = computed(() => PRIORITY_TONE[props.priority] || "neutral");
</script>

