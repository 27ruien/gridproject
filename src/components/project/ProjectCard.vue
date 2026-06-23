<template>
  <article class="project-card" :class="{ compact }">
    <button class="project-card-hit" type="button" :aria-label="`打开项目 ${project.name}`" @click="$emit('open', project.id)">
      <span class="project-card-heading">
        <span class="project-card-mark" :style="markStyle">{{ project.code?.slice(0, 2) || project.name.slice(0, 1) }}</span>
        <span class="project-card-title">
          <strong :title="project.name">{{ project.name }}</strong>
          <small v-if="project.code">{{ project.code }}</small>
        </span>
        <StatusLozenge :label="currentPhase" />
      </span>
      <span v-if="!compact" class="project-card-description">{{ project.description || "暂无项目概述。" }}</span>
      <span class="project-card-meta">
        <span><span class="avatar mini-avatar">{{ project.owner?.slice(0, 1) || "未" }}</span>{{ project.owner || "未指定" }}</span>
        <span v-if="!compact">{{ teamText }}</span>
      </span>
      <span class="project-card-progress">
        <span><strong>{{ project.summary.progress }}%</strong><small>完成进度</small></span>
        <ProgressBar :value="project.summary.progress" />
      </span>
      <span class="project-card-footer">
        <span><Icon name="calendar" />{{ formattedReleaseDate }}</span>
        <span v-if="hasRisk" class="project-risk"><Icon name="issueRisk" />{{ riskText }}</span>
        <span v-else class="project-on-track"><Icon name="check" />暂无异常</span>
      </span>
    </button>
    <div v-if="!compact" class="project-card-menu">
      <button class="project-card-menu-trigger" type="button" aria-label="项目操作" aria-haspopup="menu" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen"><Icon name="more" /></button>
      <div v-if="menuOpen" class="project-card-menu-popover" role="menu">
        <button type="button" role="menuitem" @click.stop="openProject">打开项目</button>
        <button type="button" role="menuitem" @click.stop="editProject">编辑项目</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../ui/Icon.vue";
import StatusLozenge from "../ui/StatusLozenge.vue";
import ProgressBar from "../common/ProgressBar.vue";
import { formatPreferenceDate } from "../../domain/preferences.js";
const props = defineProps({ project: { type: Object, required: true }, compact: { type: Boolean, default: false }, dateFormat: { type: String, default: "yyyy-mm-dd" } });
const emit = defineEmits(["open", "edit"]);
const menuOpen = ref(false);
const palettes = ["#315a9f", "#177565", "#8b5a18", "#7656a7", "#9b4454", "#3f6c7a"];
const markStyle = computed(() => ({ "--project-mark": palettes[hash(props.project.id) % palettes.length] }));
const currentPhase = computed(() => props.project.milestones?.find((item) => item.status !== "已完成")?.name || props.project.status || "未设置阶段");
const teamText = computed(() => props.project.executionTeams?.length ? props.project.executionTeams.join("、") : "未指定团队");
const formattedReleaseDate = computed(() => formatPreferenceDate(props.project.releaseDate, props.dateFormat));
const hasRisk = computed(() => Boolean(props.project.summary.riskCount || props.project.summary.overdueCount));
const riskText = computed(() => [props.project.summary.riskCount ? `风险 ${props.project.summary.riskCount}` : "", props.project.summary.overdueCount ? `逾期 ${props.project.summary.overdueCount}` : ""].filter(Boolean).join(" · "));
onMounted(() => document.addEventListener("pointerdown", closeMenu));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeMenu));
function hash(value) { return [...String(value)].reduce((total, char) => total + char.charCodeAt(0), 0); }
function closeMenu(event) { if (!event.target.closest?.(".project-card-menu")) menuOpen.value = false; }
function openProject() { menuOpen.value = false; emit("open", props.project.id); }
function editProject() { menuOpen.value = false; emit("edit", props.project.id); }
</script>
