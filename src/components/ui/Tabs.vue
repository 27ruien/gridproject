<template>
  <div class="project-tabs" role="tablist" @keydown="handleKeydown">
    <button
      v-for="item in items"
      :key="item"
      :ref="(element) => setTabRef(item, element)"
      class="project-tab"
      role="tab"
      type="button"
      :id="tabId(item)"
      :aria-controls="panelId(item)"
      :aria-selected="modelValue === item"
      :tabindex="modelValue === item ? 0 : -1"
      :class="{ active: modelValue === item }"
      @click="select(item)"
    >
      {{ item }}
    </button>
  </div>
</template>

<script setup>
import { nextTick } from "vue";

const props = defineProps({
  items: { type: Array, required: true },
  modelValue: { type: String, required: true },
  idBase: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);
const tabRefs = new Map();
const idPrefix = props.idBase || `tabs-${Math.random().toString(36).slice(2)}`;

function setTabRef(item, element) {
  if (element) tabRefs.set(item, element);
  else tabRefs.delete(item);
}

function tabId(item) {
  return `${idPrefix}-tab-${slug(item)}`;
}

function panelId(item) {
  return `${idPrefix}-panel-${slug(item)}`;
}

function select(item, focus = false) {
  emit("update:modelValue", item);
  if (focus) nextTick(() => tabRefs.get(item)?.focus());
}

function handleKeydown(event) {
  const currentIndex = props.items.indexOf(props.modelValue);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % props.items.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + props.items.length) % props.items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = props.items.length - 1;
  else return;
  event.preventDefault();
  select(props.items[nextIndex], true);
}

function slug(value) {
  return encodeURIComponent(String(value)).replace(/%/g, "");
}
</script>
