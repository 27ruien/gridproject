<template>
  <div ref="wrapper" class="person-picker">
    <button class="picker-trigger" type="button" @click="open = true">
      <span>{{ modelValue || placeholder }}</span>
      <small>选择</small>
    </button>
    <div v-if="open && !isMobile" class="picker-popover" role="dialog" :aria-label="title">
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
const wrapper = ref(null);
const searchInput = ref(null);
const desktopOpen = computed(() => open.value && !isMobile.value);
let mediaQuery = null;

const filteredPeople = computed(() => props.people.filter((person) => !keyword.value.trim() || person.includes(keyword.value.trim())));

useOverlay(desktopOpen, wrapper, close, {
  initialFocus: searchInput,
  lockScroll: false,
  trapFocus: false,
  closeOnOutside: true,
});

onMounted(() => {
  mediaQuery = window.matchMedia("(max-width: 767px)");
  syncMobileMode(mediaQuery);
  mediaQuery.addEventListener("change", syncMobileMode);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", syncMobileMode);
});

function select(person) {
  emit("update:modelValue", person);
  close();
}

function close() {
  open.value = false;
  keyword.value = "";
}

function syncMobileMode(event) {
  isMobile.value = event.matches;
}
</script>
