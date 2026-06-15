<template>
  <span class="status-lozenge" :class="tone">{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: "neutral" },
});

const tone = computed(() => {
  if (props.tone !== "neutral") return props.tone;
  if (["已完成", "已验收", "上线阶段"].includes(props.label)) return "success";
  if (["进行中", "开发阶段", "测试阶段"].includes(props.label)) return "info";
  if (["已暂停", "风险"].includes(props.label)) return "warn";
  return "neutral";
});
</script>
