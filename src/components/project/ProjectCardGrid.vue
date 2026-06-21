<template>
  <div v-if="projects.length" class="project-card-grid" :class="{ compact }">
    <ProjectCard v-for="project in projects" :key="project.id" :project="project" :compact="compact" :date-format="dateFormat" @open="$emit('open', $event)" @edit="$emit('edit', $event)" />
  </div>
  <div v-else class="project-library-empty">
    <span class="empty-icon"><Icon name="projects" /></span>
    <strong>{{ emptyTitle }}</strong>
    <small>{{ emptyText }}</small>
    <Button v-if="showCreate" variant="primary" size="small" icon="plus" @click="$emit('create')">创建项目</Button>
  </div>
</template>

<script setup>
import ProjectCard from "./ProjectCard.vue";
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";
defineProps({ projects: { type: Array, required: true }, compact: { type: Boolean, default: false }, dateFormat: { type: String, default: "yyyy-mm-dd" }, emptyTitle: { type: String, default: "还没有项目" }, emptyText: { type: String, default: "创建第一个项目，开始组织工作。" }, showCreate: { type: Boolean, default: false } });
defineEmits(["open", "edit", "create"]);
</script>
