<template>
  <button class="icon-btn" type="button" :aria-label="label">
    <Icon :name="icon" />
  </button>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
});
</script>
