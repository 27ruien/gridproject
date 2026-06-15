<template>
  <div class="overflow-menu" @keydown.esc="open = false">
    <button class="icon-btn" type="button" :aria-label="label" :aria-expanded="open" @click="open = !open">
      <Icon name="more" />
    </button>
    <div v-if="open" class="overflow-panel">
      <slot :close="close" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import Icon from "./Icon.vue";

defineProps({
  label: { type: String, default: "更多操作" },
});

const open = ref(false);

function close() {
  open.value = false;
}
</script>

<style scoped>
.overflow-menu {
  position: relative;
}

.overflow-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: var(--z-dropdown);
  min-width: 168px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: var(--shadow-popover);
  padding: var(--space-050);
  display: grid;
  gap: var(--space-025);
}
</style>
