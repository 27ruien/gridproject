<template>
  <Teleport to="body">
    <aside
      v-if="open"
      ref="panel"
      class="detail-panel open"
      :class="panelClass"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <header class="drawer-head">
        <div>
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h2 :id="titleId">{{ title }}</h2>
        </div>
        <div class="drawer-head-actions">
          <slot name="actions" />
          <button class="icon-btn" type="button" aria-label="关闭详情" @click="$emit('close')">
            <Icon name="close" />
          </button>
        </div>
      </header>
      <slot name="tabs" />
      <div class="drawer-body">
        <slot />
      </div>
    </aside>
  </Teleport>
</template>

<script setup>
import { computed, ref } from "vue";
import { useOverlay } from "../../composables/useOverlay.js";
import Icon from "./Icon.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  eyebrow: { type: String, default: "" },
  panelClass: { type: String, default: "" },
  trapFocus: { type: Boolean, default: true },
});

const emit = defineEmits(["close"]);

const panel = ref(null);
const titleId = `detail-${Math.random().toString(36).slice(2)}`;
const isOpen = computed(() => props.open);

useOverlay(isOpen, panel, () => emit("close"), {
  lockScroll: true,
  trapFocus: props.trapFocus,
});
</script>
