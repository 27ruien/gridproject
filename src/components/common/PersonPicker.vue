<template>
  <div class="person-picker">
    <button
      ref="trigger"
      class="picker-trigger"
      type="button"
      :aria-expanded="open"
      :aria-controls="popoverId"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span>{{ modelValue || placeholder }}</span>
      <small>选择</small>
    </button>

    <Teleport to="body">
      <div
        v-if="desktopOpen"
        :id="popoverId"
        ref="popover"
        class="picker-popover"
        :class="`placement-${placement}`"
        :style="popoverStyle"
        role="dialog"
        :aria-label="title"
        tabindex="-1"
      >
        <div class="picker-panel">
          <input ref="searchInput" v-model="keyword" data-autofocus role="combobox" :aria-label="`${title}搜索`" placeholder="搜索姓名" />
          <div class="picker-list" role="listbox">
            <button v-for="person in filteredPeople" :key="person || '__all'" type="button" role="option" :aria-selected="person === modelValue" :class="{ active: person === modelValue }" @click="select(person)">
              <span class="avatar">{{ person ? person.slice(0, 1) : "全" }}</span>
              <strong>{{ person || "全部" }}</strong>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Modal :open="open && isMobile" :title="title" size="picker-modal" @close="close">
      <div class="picker-panel">
        <input v-model="keyword" data-autofocus role="combobox" :aria-label="`${title}搜索`" placeholder="搜索姓名" />
        <div class="picker-list" role="listbox">
          <button v-for="person in filteredPeople" :key="person || '__all'" type="button" role="option" :aria-selected="person === modelValue" :class="{ active: person === modelValue }" @click="select(person)">
            <span class="avatar">{{ person ? person.slice(0, 1) : "全" }}</span>
            <strong>{{ person || "全部" }}</strong>
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useOverlay } from "../../composables/useOverlay.js";
import Modal from "../ui/Modal.vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  people: { type: Array, required: true },
  title: { type: String, default: "选择人员" },
  placeholder: { type: String, default: "未选择" },
});

const emit = defineEmits(["update:modelValue"]);
const open = ref(false);
const keyword = ref("");
const isMobile = ref(false);
const trigger = ref(null);
const popover = ref(null);
const searchInput = ref(null);
const placement = ref("bottom");
const position = reactive({ top: 0, left: 0, width: 320, maxHeight: 320 });
const popoverId = `person-picker-${Math.random().toString(36).slice(2)}`;
const desktopOpen = computed(() => open.value && !isMobile.value);
const popoverStyle = computed(() => ({
  top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px`, maxHeight: `${position.maxHeight}px`,
}));
const filteredPeople = computed(() => props.people.filter((person) => !keyword.value.trim() || person.includes(keyword.value.trim())));
let mediaQuery = null;

useOverlay(desktopOpen, popover, close, {
  initialFocus: searchInput,
  lockScroll: false,
  trapFocus: false,
  closeOnOutside: false,
});

watch(desktopOpen, async (visible) => {
  if (!visible) return;
  await nextTick();
  updatePosition();
});

onMounted(() => {
  mediaQuery = window.matchMedia("(max-width: 767px)");
  syncMobileMode(mediaQuery);
  mediaQuery.addEventListener("change", syncMobileMode);
  document.addEventListener("pointerdown", handleOutside, true);
  window.addEventListener("resize", updatePosition);
  window.addEventListener("scroll", updatePosition, true);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", syncMobileMode);
  document.removeEventListener("pointerdown", handleOutside, true);
  window.removeEventListener("resize", updatePosition);
  window.removeEventListener("scroll", updatePosition, true);
});

function toggle() {
  open.value = !open.value;
  if (!open.value) keyword.value = "";
}

function select(person) {
  emit("update:modelValue", person);
  close();
}

function close() {
  open.value = false;
  keyword.value = "";
}

function handleOutside(event) {
  if (!desktopOpen.value) return;
  if (trigger.value?.contains(event.target) || popover.value?.contains(event.target)) return;
  close();
}

function updatePosition() {
  if (!desktopOpen.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const gutter = 8;
  const desiredHeight = Math.min(340, 92 + filteredPeople.value.length * 40);
  const spaceBelow = window.innerHeight - rect.bottom - gutter;
  const spaceAbove = rect.top - gutter;
  const opensUp = spaceBelow < Math.min(desiredHeight, 240) && spaceAbove > spaceBelow;
  const width = Math.min(420, Math.max(280, rect.width));
  const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
  const available = Math.max(160, (opensUp ? spaceAbove : spaceBelow) - gutter);
  placement.value = opensUp ? "top" : "bottom";
  position.width = width;
  position.left = left;
  position.maxHeight = Math.min(desiredHeight, available);
  position.top = opensUp ? Math.max(gutter, rect.top - Math.min(desiredHeight, available) - gutter) : rect.bottom + gutter;
}

function syncMobileMode(event) {
  isMobile.value = event.matches;
}
</script>
