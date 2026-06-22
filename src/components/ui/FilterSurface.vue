<template>
  <span class="filter-surface">
    <button
      ref="trigger"
      class="filter-surface-trigger"
      type="button"
      :aria-label="ariaLabel || title"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="openSurface"
    >
      <Icon name="filter" />
      <span>{{ label }}</span>
      <small v-if="activeCount" aria-label="已启用筛选数量">{{ activeCount }}</small>
    </button>

    <Teleport to="body">
      <div v-if="open" class="filter-surface-layer">
        <button class="filter-surface-scrim" type="button" :aria-label="`关闭${title}`" @click="closeFromScrim"></button>
        <section
          :id="panelId"
          ref="panel"
          class="filter-surface-panel"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @click.stop
        >
          <header class="filter-surface-head">
            <div>
              <strong :id="titleId">{{ title }}</strong>
              <small v-if="description">{{ description }}</small>
            </div>
            <button class="icon-btn" type="button" :aria-label="`关闭${title}`" @click="closeSurface">
              <Icon name="close" />
            </button>
          </header>

          <div class="filter-surface-body">
            <slot />
          </div>

          <footer class="filter-surface-footer">
            <Button variant="ghost" size="small" @click="$emit('reset')">{{ resetText }}</Button>
            <Button variant="primary" size="small" @click="applyAndClose">{{ applyText }}</Button>
          </footer>
        </section>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { useOverlay } from "../../composables/useOverlay.js";
import Button from "./Button.vue";
import Icon from "./Icon.vue";

const props = defineProps({
  label: { type: String, default: "筛选" },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  ariaLabel: { type: String, default: "" },
  activeCount: { type: Number, default: 0 },
  applyText: { type: String, default: "应用" },
  resetText: { type: String, default: "重置" },
});

const emit = defineEmits(["apply", "reset", "close"]);

const open = ref(false);
const trigger = ref(null);
const panel = ref(null);
const panelStyle = ref({});
const panelId = `filter-surface-${Math.random().toString(36).slice(2)}`;
const titleId = `${panelId}-title`;
const isOpen = computed(() => open.value);

const { isTop } = useOverlay(isOpen, panel, closeSurface, {
  lockScroll: true,
  trapFocus: true,
});

function openSurface() {
  open.value = true;
  nextTick(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
  });
}

function closeSurface() {
  if (!open.value) return;
  open.value = false;
  removePositionListeners();
  emit("close");
}

function closeFromScrim() {
  if (isTop.value) closeSurface();
}

function applyAndClose() {
  emit("apply");
  closeSurface();
}

function updatePosition() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const margin = 12;
  const width = Math.min(380, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
  panelStyle.value = {
    "--filter-surface-left": `${left}px`,
    "--filter-surface-top": `${rect.bottom + 8}px`,
    "--filter-surface-width": `${width}px`,
  };
}

function removePositionListeners() {
  window.removeEventListener("resize", updatePosition);
  window.removeEventListener("scroll", updatePosition, true);
}

onBeforeUnmount(removePositionListeners);
</script>
