<template>
  <Teleport to="body">
    <aside
      class="detail-panel"
      :class="{ open }"
      role="dialog"
      aria-modal="true"
      :aria-hidden="!open"
      :aria-labelledby="titleId"
      tabindex="-1"
      @keydown.esc="$emit('close')"
    >
      <header class="drawer-head">
        <div>
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h2 :id="titleId">{{ title }}</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭详情" @click="$emit('close')">
          <Icon name="close" />
        </button>
      </header>
      <slot name="tabs" />
      <div class="drawer-body">
        <slot />
      </div>
    </aside>
  </Teleport>
</template>

<script setup>
import { watch } from "vue";
import Icon from "./Icon.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  eyebrow: { type: String, default: "" },
});

defineEmits(["close"]);

const titleId = `detail-${Math.random().toString(36).slice(2)}`;

watch(() => props.open, (open) => {
  document.body.classList.toggle("modal-locked", open);
});
</script>
