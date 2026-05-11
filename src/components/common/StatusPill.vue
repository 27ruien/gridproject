<template>
  <span class="pill" :class="tone">{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";
import { STATUS_TONE } from "../../domain/workflow";

const props = defineProps({
  label: { type: String, required: true },
});

const tone = computed(() => STATUS_TONE[props.label] || "neutral");
</script>

