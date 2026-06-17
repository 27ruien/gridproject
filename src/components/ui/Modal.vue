<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="closeFromBackdrop">
      <section ref="panel" class="modal" :class="size" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <header class="drawer-head">
          <slot name="header">
            <div>
              <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
              <h2 :id="titleId">{{ title }}</h2>
            </div>
          </slot>
          <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="$emit('close')">
            <Icon name="close" />
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from "vue";
import { useOverlay } from "../../composables/useOverlay.js";
import Icon from "./Icon.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  eyebrow: { type: String, default: "" },
  size: { type: String, default: "" },
});

const emit = defineEmits(["close"]);

const panel = ref(null);
const titleId = `modal-${Math.random().toString(36).slice(2)}`;
const isOpen = computed(() => props.open);

const { isTop } = useOverlay(isOpen, panel, () => emit("close"));

function closeFromBackdrop() {
  if (isTop.value) emit("close");
}
</script>
