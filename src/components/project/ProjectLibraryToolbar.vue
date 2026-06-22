<template>
  <div class="project-library-toolbar">
    <label class="search project-library-search"><Icon name="search" /><input :value="search" type="search" placeholder="搜索项目" aria-label="搜索项目" @input="$emit('update:search', $event.target.value)" /></label>
    <label class="project-sort-control"><Icon name="sort" /><select :value="sort" aria-label="项目排序" @change="$emit('update:sort', $event.target.value)"><option value="updated">最近更新</option><option value="risk">风险优先</option><option value="release">上线日期</option><option value="name">项目名称</option></select></label>
    <ProjectFilterPopover :filters="filters" :options="options" @change="$emit('update:filters', $event)" @clear="$emit('clear-filters')" />
    <Button variant="primary" size="small" icon="plus" aria-label="创建项目" @click="$emit('create')"><span>创建项目</span></Button>
    <div v-if="chips.length" class="project-filter-chips">
      <button v-for="chip in chips" :key="chip.key" type="button" @click="$emit('remove-filter', chip.key)">{{ chip.label }}<Icon name="close" /></button>
      <button class="clear-all" type="button" @click="$emit('clear-filters')">清除全部</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Icon from "../ui/Icon.vue";
import Button from "../ui/Button.vue";
import ProjectFilterPopover from "./ProjectFilterPopover.vue";
const props = defineProps({ search: { type: String, default: "" }, sort: { type: String, default: "updated" }, filters: { type: Object, required: true }, options: { type: Object, required: true } });
defineEmits(["update:search", "update:sort", "update:filters", "clear-filters", "remove-filter", "create"]);
const labels = { status: "状态", team: "团队", owner: "负责人", phase: "阶段", releaseFrom: "上线从", releaseTo: "上线至", risk: "风险" };
const riskLabels = { risk: "存在风险", overdue: "存在逾期", clear: "暂无异常" };
const chips = computed(() => Object.entries(props.filters).filter(([, value]) => value).map(([key, value]) => ({ key, label: `${labels[key]}：${key === "risk" ? riskLabels[value] : value}` })));
</script>
