<template>
  <details class="toolbar-menu filter-popover">
    <summary class="toolbar-button" :class="{ active: activeFilterCount }">
      <Icon name="filter" />
      <span>筛选</span>
      <small v-if="activeFilterCount">{{ activeFilterCount }}</small>
    </summary>
    <div class="toolbar-popover filter-popover-panel">
      <div class="toolbar-popover-heading">
        <strong>筛选事项</strong>
        <button v-if="activeFilterCount" type="button" @click="$emit('reset')">清除</button>
      </div>
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
    </div>
  </details>
</template>

<script setup>
import { computed } from "vue";
import PersonPicker from "../common/PersonPicker.vue";
import Icon from "../ui/Icon.vue";

const filters = defineModel({ type: Object, required: true });
const props = defineProps({ people: { type: Array, required: true } });

defineEmits(["reset"]);

const peopleWithAll = computed(() => ["", ...props.people]);
const activeFilterCount = computed(() => [filters.value.dateFrom, filters.value.dateTo, filters.value.owner, filters.value.creator].filter(Boolean).length);
</script>
