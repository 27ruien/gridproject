<template>
  <div ref="root" class="account-menu-root">
    <button
      ref="trigger"
      class="account-trigger"
      type="button"
      aria-haspopup="menu"
      :aria-label="`打开账户菜单：${user.name}`"
      :aria-expanded="open"
      :data-tooltip="user.name"
      @click="toggle"
      @keydown.down.prevent="openAndFocus(0)"
      @keydown.up.prevent="openAndFocus(items.length - 1)"
    >
      <span class="avatar" :style="{ '--avatar-color': preferences.avatarColor }">{{ initial }}</span>
      <strong>{{ user.name }}</strong>
      <Icon name="chevronDown" />
    </button>

    <Teleport to="body">
      <div v-if="open && mobile" class="account-sheet-scrim" @pointerdown.self="close">
        <section class="account-popover account-sheet" :style="popoverStyle" role="menu" aria-label="账户菜单" @keydown="handleKeydown">
          <span class="sheet-handle" aria-hidden="true" />
          <AccountMenuContent :user="user" :preferences="preferences" :show-logout="showLogout" @action="handleAction" @register="registerItem" />
        </section>
      </div>
      <section v-else-if="open" ref="popover" class="account-popover" :style="popoverStyle" role="menu" aria-label="账户菜单" @keydown="handleKeydown">
        <AccountMenuContent :user="user" :preferences="preferences" :show-logout="showLogout" @action="handleAction" @register="registerItem" />
      </section>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../ui/Icon.vue";
import AccountMenuContent from "./AccountMenuContent.vue";

const props = defineProps({
  user: { type: Object, required: true },
  preferences: { type: Object, required: true },
  showLogout: { type: Boolean, default: false },
});
const emit = defineEmits(["navigate", "logout", "open"]);
const root = ref(null);
const trigger = ref(null);
const popover = ref(null);
const open = ref(false);
const mobile = ref(false);
const popoverStyle = ref({});
const items = ref([]);
const initial = computed(() => props.user.name?.trim()?.slice(0, 1) || "用");

onMounted(() => {
  syncViewport();
  window.addEventListener("resize", syncViewport);
  document.addEventListener("pointerdown", onOutsidePointer);
  window.addEventListener("keydown", onWindowKeydown);
  window.addEventListener("popstate", close);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewport);
  document.removeEventListener("pointerdown", onOutsidePointer);
  window.removeEventListener("keydown", onWindowKeydown);
  window.removeEventListener("popstate", close);
});

function toggle() {
  if (open.value) close();
  else openAndFocus(-1);
}
function openAndFocus(index) {
  emit("open");
  open.value = true;
  items.value = [];
  placePopover();
  if (index >= 0) nextTick(() => items.value[index]?.focus());
}
function close({ restoreFocus = true } = {}) {
  if (!open.value) return;
  open.value = false;
  items.value = [];
  if (restoreFocus) nextTick(() => trigger.value?.focus());
}
function handleAction(action) {
  close({ restoreFocus: false });
  if (action === "logout") emit("logout");
  else emit("navigate", action);
}
function registerItem(element) {
  if (element && !items.value.includes(element)) items.value.push(element);
}
function handleKeydown(event) {
  const index = items.value.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    items.value[(index + 1 + items.value.length) % items.value.length]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    items.value[(index - 1 + items.value.length) % items.value.length]?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    items.value[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    items.value.at(-1)?.focus();
  }
}
function syncViewport() {
  mobile.value = window.innerWidth < 768;
  if (open.value) placePopover();
}
function placePopover() {
  nextTick(() => {
    if (mobile.value) {
      popoverStyle.value = {};
      return;
    }
    const rect = trigger.value?.getBoundingClientRect();
    if (!rect) return;
    const width = 304;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 300);
    popoverStyle.value = { width: `${width}px`, left: `${left}px`, top: `${Math.max(8, top)}px` };
  });
}
function onOutsidePointer(event) {
  if (!open.value) return;
  if (root.value?.contains(event.target) || popover.value?.contains(event.target) || event.target.closest?.(".account-sheet")) return;
  close({ restoreFocus: false });
}
function onWindowKeydown(event) {
  if (open.value && event.key === "Escape") {
    event.preventDefault();
    close();
  }
}
</script>
