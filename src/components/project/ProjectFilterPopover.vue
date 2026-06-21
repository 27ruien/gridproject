<template>
  <div ref="root" class="project-filter-popover">
    <Button icon="filter" size="small" :class="{ active: activeCount }" @click="open = !open">筛选<span v-if="activeCount" class="filter-count">{{ activeCount }}</span></Button>
    <div v-if="open" class="project-filter-panel">
      <header><strong>筛选项目</strong><button v-if="activeCount" type="button" @click="$emit('clear')">清除全部</button></header>
      <div class="project-filter-grid">
        <label><span>项目状态</span><select :value="filters.status" @change="change('status', $event.target.value)"><option value="">全部状态</option><option v-for="item in options.statuses" :key="item">{{ item }}</option></select></label>
        <label><span>执行团队</span><select :value="filters.team" @change="change('team', $event.target.value)"><option value="">全部团队</option><option v-for="item in options.teams" :key="item">{{ item }}</option></select></label>
        <label><span>负责人</span><select :value="filters.owner" @change="change('owner', $event.target.value)"><option value="">全部负责人</option><option v-for="item in options.owners" :key="item">{{ item }}</option></select></label>
        <label><span>当前阶段</span><select :value="filters.phase" @change="change('phase', $event.target.value)"><option value="">全部阶段</option><option v-for="item in options.phases" :key="item">{{ item }}</option></select></label>
        <label><span>上线日期从</span><input type="date" :value="filters.releaseFrom" @input="change('releaseFrom', $event.target.value)" /></label>
        <label><span>上线日期至</span><input type="date" :value="filters.releaseTo" @input="change('releaseTo', $event.target.value)" /></label>
        <label><span>风险状态</span><select :value="filters.risk" @change="change('risk', $event.target.value)"><option value="">全部风险</option><option value="risk">存在风险</option><option value="overdue">存在逾期</option><option value="clear">暂无异常</option></select></label>
      </div>
      <footer><Button variant="primary" size="small" @click="open = false">完成</Button></footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Button from "../ui/Button.vue";
const props = defineProps({ filters: { type: Object, required: true }, options: { type: Object, required: true } });
const emit = defineEmits(["change", "clear"]);
const root = ref(null);
const open = ref(false);
const activeCount = computed(() => Object.values(props.filters).filter(Boolean).length);
onMounted(() => document.addEventListener("pointerdown", closeOutside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeOutside));
function closeOutside(event) { if (!root.value?.contains(event.target)) open.value = false; }
function change(key, value) { emit("change", { ...props.filters, [key]: value }); }
</script>
