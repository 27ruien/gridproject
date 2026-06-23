<template>
  <div v-if="projects.length" class="project-card-grid" :class="[{ compact }, variantClass]">
    <ProjectCard v-for="project in projects" :key="project.id" :project="project" :compact="compact" :variant="variant" :date-format="dateFormat" @open="$emit('open', $event)" @edit="$emit('edit', $event)" />
  </div>
  <div v-else class="project-library-empty">
    <span class="empty-icon"><Icon name="projects" /></span>
    <strong>{{ emptyTitle }}</strong>
    <small>{{ emptyText }}</small>
    <Button v-if="showCreate" variant="primary" size="small" icon="plus" @click="$emit('create')">创建项目</Button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import ProjectCard from "./ProjectCard.vue";
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";
const props = defineProps({ projects: { type: Array, required: true }, compact: { type: Boolean, default: false }, variant: { type: String, default: "" }, dateFormat: { type: String, default: "yyyy-mm-dd" }, emptyTitle: { type: String, default: "还没有项目" }, emptyText: { type: String, default: "创建第一个项目，开始组织工作。" }, showCreate: { type: Boolean, default: false } });
defineEmits(["open", "edit", "create"]);
const variantClass = computed(() => props.variant ? `project-card-grid-${props.variant}` : "");
</script>
