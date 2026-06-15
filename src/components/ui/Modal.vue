<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <section ref="panel" class="modal" :class="size" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <header class="drawer-head">
          <div>
            <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
            <h2 :id="titleId">{{ title }}</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="$emit('close')">
            <Icon name="close" />
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import Icon from "./Icon.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  eyebrow: { type: String, default: "" },
  size: { type: String, default: "" },
});

defineEmits(["close"]);

const panel = ref(null);
const titleId = `modal-${Math.random().toString(36).slice(2)}`;

watch(() => props.open, async (open) => {
  document.body.classList.toggle("modal-locked", open);
  if (!open) return;
  await nextTick();
  panel.value?.focus();
});
</script>
