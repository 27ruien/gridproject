<template>
  <div class="person-picker">
    <button class="picker-trigger" type="button" @click="open = true">
      <span>{{ modelValue || placeholder }}</span>
      <small>选择</small>
    </button>
    <div v-if="open" class="picker-backdrop" @click.self="open = false">
      <section class="picker-panel">
        <header>
          <h3>{{ title }}</h3>
          <button class="icon-btn" type="button" @click="open = false">×</button>
        </header>
        <input v-model="keyword" placeholder="搜索姓名" />
        <div class="picker-list">
          <button
            v-for="person in filteredPeople"
            :key="person || '__all'"
            type="button"
            :class="{ active: person === modelValue }"
            @click="select(person)"
          >
            <span class="avatar">{{ person ? person.slice(0, 1) : "全" }}</span>
            <strong>{{ person || "全部" }}</strong>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  people: { type: Array, required: true },
  title: { type: String, default: "选择人员" },
  placeholder: { type: String, default: "未选择" },
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const keyword = ref("");

const filteredPeople = computed(() => props.people.filter((person) => !keyword.value.trim() || person.includes(keyword.value.trim())));

function select(person) {
  emit("update:modelValue", person);
  open.value = false;
  keyword.value = "";
}
</script>
