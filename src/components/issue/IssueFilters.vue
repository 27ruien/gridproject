<template>
  <section class="filter-bar">
    <label class="filter-keyword">
      <span>关键词</span>
      <input v-model="filters.keyword" placeholder="标题、编号、类型、描述" />
    </label>
    <label>
      <span>开始日期</span>
      <input v-model="filters.dateFrom" type="date" />
    </label>
    <label>
      <span>结束日期</span>
      <input v-model="filters.dateTo" type="date" />
    </label>
    <label>
      <span>执行人</span>
      <PersonPicker v-model="filters.owner" :people="peopleWithAll" title="筛选执行人" placeholder="全部" />
    </label>
    <label>
      <span>创建人</span>
      <PersonPicker v-model="filters.creator" :people="peopleWithAll" title="筛选创建人" placeholder="全部" />
    </label>
    <button class="btn ghost small" type="button" @click="$emit('reset')">重置</button>
  </section>
</template>

<script setup>
import { computed } from "vue";
import PersonPicker from "../common/PersonPicker.vue";

const filters = defineModel({ type: Object, required: true });
const props = defineProps({
  people: { type: Array, required: true },
});
const peopleWithAll = computed(() => ["", ...props.people]);

defineEmits(["reset"]);
</script>
