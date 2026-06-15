<template>
  <section class="filter-bar" :class="{ expanded: showMore }">
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
    <label class="filter-advanced">
      <span>创建人</span>
      <PersonPicker v-model="filters.creator" :people="peopleWithAll" title="筛选创建人" placeholder="全部" />
    </label>
    <button class="btn ghost small" type="button" @click="showMore = !showMore">{{ showMore ? "收起筛选" : "更多筛选" }}</button>
    <button class="btn ghost small" type="button" @click="$emit('reset')">重置</button>
    <div v-if="chips.length" class="filter-chip-list">
      <button v-for="chip in chips" :key="chip.key" class="filter-chip" type="button" @click="clearChip(chip.key)">
        {{ chip.label }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import PersonPicker from "../common/PersonPicker.vue";

const filters = defineModel({ type: Object, required: true });
const props = defineProps({
  people: { type: Array, required: true },
});
const peopleWithAll = computed(() => ["", ...props.people]);
const showMore = ref(false);
const chips = computed(() => [
  filters.value.keyword && { key: "keyword", label: `关键词：${filters.value.keyword}` },
  filters.value.dateFrom && { key: "dateFrom", label: `开始：${filters.value.dateFrom}` },
  filters.value.dateTo && { key: "dateTo", label: `结束：${filters.value.dateTo}` },
  filters.value.owner && { key: "owner", label: `执行人：${filters.value.owner}` },
  filters.value.creator && { key: "creator", label: `创建人：${filters.value.creator}` },
].filter(Boolean));

defineEmits(["reset"]);

function clearChip(key) {
  filters.value[key] = "";
}
</script>
