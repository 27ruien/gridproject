<template>
  <header class="project-context-header">
    <div class="project-context-primary">
      <span class="project-identity-mark" aria-hidden="true">{{ project.name.slice(0, 1) }}</span>
      <div class="project-context-title">
        <h1 :title="project.name">{{ project.name }}</h1>
        <select
          v-if="permissions.canUpdate"
          class="project-status-control"
          aria-label="项目状态"
          :value="project.status"
          @change="$emit('update-project', project.id, { status: $event.target.value })"
        >
          <option v-for="status in projectStatuses" :key="status" :value="status">{{ status }}</option>
        </select>
        <span v-else class="status-lozenge neutral">{{ project.status }}</span>
        <span v-if="summary.scheduleRiskCount" class="project-risk-alert">{{ summary.scheduleRiskCount }} 项排期风险</span>
      </div>

      <div class="project-context-actions">
        <span class="project-owner-avatar" :title="`负责人：${project.owner}`">{{ project.owner.slice(0, 1) }}</span>
        <IconButton v-if="permissions.canUpdate" icon="edit" label="编辑项目" @click="$emit('edit-project', project.id)" />
        <OverflowMenu v-if="permissions.canUpdate || permissions.canDelete">
          <template #default="{ close }">
            <Button v-if="permissions.canUpdate" variant="ghost" size="small" @click="close(); $emit('import-schedule')">导入 Timeline</Button>
            <Button v-if="permissions.canDelete" variant="danger" size="small" @click="close(); $emit('delete-project', project.id)">删除项目</Button>
          </template>
        </OverflowMenu>
      </div>
    </div>

    <div class="project-context-secondary">
      <p :title="project.description || '暂无项目概述。'">{{ project.description || "暂无项目概述。" }}</p>
      <details class="project-properties-menu">
        <summary class="compact-menu-trigger">
          <Icon name="sliders" />
          <span>项目属性</span>
        </summary>
        <div class="project-properties-popover">
          <div class="project-property-section">
            <span class="project-property-label">负责人</span>
            <strong>{{ project.owner }}</strong>
          </div>
          <div class="project-property-section">
            <span class="project-property-label">执行团队</span>
            <strong>{{ executionTeamsText }}</strong>
          </div>
          <dl class="project-property-grid">
            <div><dt>项目开始</dt><dd>{{ project.startDate || "未设置" }}</dd></div>
            <div><dt>测试</dt><dd>{{ project.testDate || "未设置" }}</dd></div>
            <div><dt>验收</dt><dd>{{ project.acceptanceDate || "未设置" }}</dd></div>
            <div><dt>上线</dt><dd>{{ project.releaseDate || "未设置" }}</dd></div>
          </dl>
          <dl class="project-signal-grid">
            <div><dt>健康度</dt><dd>{{ summary.health }}</dd></div>
            <div><dt>进度</dt><dd>{{ summary.progress }}%</dd></div>
            <div><dt>待办</dt><dd>{{ summary.openCount }}</dd></div>
            <div :class="{ danger: summary.scheduleRiskCount }"><dt>排期风险</dt><dd>{{ summary.scheduleRiskCount }}</dd></div>
          </dl>
        </div>
      </details>
    </div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { PROJECT_STATUS_OPTIONS } from "../../domain/project.js";
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";
import IconButton from "../ui/IconButton.vue";
import OverflowMenu from "../ui/OverflowMenu.vue";

const props = defineProps({
  project: { type: Object, required: true },
  summary: { type: Object, required: true },
  permissions: { type: Object, required: true },
});

defineEmits(["import-schedule", "update-project", "edit-project", "delete-project"]);

const projectStatuses = PROJECT_STATUS_OPTIONS;
const executionTeamsText = computed(() => props.project.executionTeams?.length ? props.project.executionTeams.join("、") : "未指定");
</script>
