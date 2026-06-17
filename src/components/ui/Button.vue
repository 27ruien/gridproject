<template>
  <button class="ui-button" :class="[variant, size]" :type="type" :disabled="disabled">
    <Icon v-if="icon" :name="icon" />
    <slot />
  </button>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
  icon: { type: String, default: "" },
  variant: { type: String, default: "default" },
  size: { type: String, default: "" },
  type: { type: String, default: "button" },
  disabled: { type: Boolean, default: false },
});
</script>
