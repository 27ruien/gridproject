<template>
  <Modal
    :open="open"
    :title="isEditing ? '编辑项目' : '创建项目'"
    :eyebrow="isEditing ? project?.name : 'GridProject'"
    size="large"
    @close="requestClose"
  >
    <nav class="form-step-nav" aria-label="项目表单步骤">
      <button type="button" :class="{ active: step === 'basic' }" @click="step = 'basic'">
        <span>1</span>基本信息
      </button>
      <button type="button" :class="{ active: step === 'timeline' }" @click="step = 'timeline'">
        <span>2</span>Timeline
      </button>
    </nav>

    <div v-show="step === 'basic'" class="project-form-content">
      <div class="form-panel project-form-main">
        <label class="full-field">
          <span>项目名称 <b aria-hidden="true">*</b></span>
          <input v-model="form.name" :aria-invalid="Boolean(errors.name)" placeholder="例如：新客户交付项目" @input="errors.name = ''" />
          <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
        </label>

        <label class="full-field">
          <span>项目概述</span>
          <textarea v-model="form.description" placeholder="说明项目目标、范围和交付背景"></textarea>
        </label>

        <div class="form-two">
          <label>
            <span>项目负责人</span>
            <PersonPicker v-model="form.owner" :people="people" title="选择项目负责人" />
          </label>
          <label>
            <span>项目状态</span>
            <select v-model="form.status">
              <option v-for="status in projectStatuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
        </div>

        <fieldset class="team-picker">
          <legend>执行团队</legend>
          <p>可多选，默认不指定团队。</p>
          <div>
            <label v-for="team in teamOptions" :key="team" :class="{ active: form.executionTeams.includes(team) }">
              <input v-model="form.executionTeams" type="checkbox" :value="team" />
              <span>{{ team }}</span>
            </label>
          </div>
        </fieldset>

        <div class="form-two key-date-form">
          <label>
            <span>项目开始时间</span>
            <input v-model="form.startDate" type="date" />
          </label>
          <label>
            <span>测试时间</span>
            <input v-model="form.testDate" type="date" />
          </label>
          <label>
            <span>验收时间</span>
            <input v-model="form.acceptanceDate" type="date" />
          </label>
          <label>
            <span>上线时间</span>
            <input v-model="form.releaseDate" type="date" />
          </label>
        </div>
      </div>

      <aside class="project-template-panel">
        <div class="project-template-heading">
          <span>排期模版</span>
          <small>{{ isEditing ? "已创建项目不可切换模版" : "决定默认视图和事项类型" }}</small>
        </div>
        <div class="template-select compact">
          <TemplateCard
            v-for="template in templates"
            :key="template.id"
            :template="template"
            :selected="form.templateId === template.id"
            @select="!isEditing && (form.templateId = $event)"
          />
        </div>
      </aside>
    </div>

    <div v-show="step === 'timeline'" class="project-timeline-step">
      <label class="timeline-enable-row">
        <input v-model="useTimeline" type="checkbox" />
        <span>
          <strong>{{ isEditing ? "重新导入 Timeline" : "使用 Timeline 初始化项目" }}</strong>
          <small>{{ isEditing ? "先预览影响范围；手工维护的任务默认不会被覆盖。" : "解析成功后再随项目一起保存。" }}</small>
        </span>
      </label>
      <TimelineImportPanel v-if="useTimeline" ref="timelinePanel" @change="handleTimelineChange" />
      <div v-else class="timeline-skipped-state">
        <strong>暂不导入</strong>
        <p>可以先创建项目，之后在项目工作区重新导入 Timeline。</p>
      </div>
      <p v-if="errors.timeline" class="field-error timeline-error" role="alert">{{ errors.timeline }}</p>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="requestClose">取消</Button>
      <Button v-if="step === 'timeline'" variant="ghost" :disabled="saving" @click="step = 'basic'">上一步</Button>
      <Button v-if="step === 'basic'" variant="primary" :disabled="saving" @click="step = 'timeline'">下一步</Button>
      <Button v-else variant="primary" :disabled="saving" @click="submit">
        {{ saving ? "正在保存…" : isEditing ? "保存项目" : "创建项目" }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import TemplateCard from "../components/template/TemplateCard.vue";
import PersonPicker from "../components/common/PersonPicker.vue";
import TimelineImportPanel from "../components/project/TimelineImportPanel.vue";
import Button from "../components/ui/Button.vue";
import Modal from "../components/ui/Modal.vue";
import { PROJECT_STATUS_OPTIONS } from "../domain/project.js";

const props = defineProps({
  open: { type: Boolean, default: false },
  templates: { type: Array, required: true },
  people: { type: Array, required: true },
  selectedTemplateId: { type: String, default: "agile" },
  project: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "create", "save"]);
const projectStatuses = PROJECT_STATUS_OPTIONS;
const teamOptions = ["商务", "设计", "开发", "特效"];
const isEditing = computed(() => Boolean(props.project));
const saving = computed(() => props.busy || submitting.value);
const step = ref("basic");
const useTimeline = ref(false);
const timelinePanel = ref(null);
const timelinePreview = ref(null);
const submitting = ref(false);
const errors = reactive({ name: "", timeline: "" });

const form = reactive(emptyForm());

watch(() => props.open, (open) => {
  if (!open) return;
  step.value = "basic";
  useTimeline.value = false;
  timelinePreview.value = null;
  submitting.value = false;
  errors.name = "";
  errors.timeline = "";
  Object.assign(form, props.project ? projectForm(props.project) : emptyForm(props.selectedTemplateId, props.people[0] || ""));
}, { flush: "post" });

watch(() => props.busy, (busy, previous) => {
  if (previous && !busy && props.open) submitting.value = false;
});

watch(() => form.templateId, (templateId) => {
  if (!props.open || isEditing.value) return;
  form.status = templateId === "agile" ? "规划中" : "开发阶段";
});

function handleTimelineChange(preview) {
  timelinePreview.value = preview;
  errors.timeline = "";
  if (!preview?.valid) return;
  const dates = preview.dates || {};
  form.startDate = dates.startDate || form.startDate;
  form.testDate = dates.testDate || form.testDate;
  form.acceptanceDate = dates.acceptanceDate || form.acceptanceDate;
  form.releaseDate = dates.releaseDate || form.releaseDate;
}

function submit() {
  if (saving.value) return;
  errors.name = form.name.trim() ? "" : "请填写项目名称。";
  errors.timeline = useTimeline.value && !timelinePreview.value?.valid ? "请先完成 Timeline 解析并确认至少一条有效任务。" : "";
  if (errors.name || errors.timeline) {
    step.value = errors.name ? "basic" : "timeline";
    return;
  }

  submitting.value = true;
  const payload = {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    executionTeams: [...form.executionTeams],
    timeline: useTimeline.value ? timelinePreview.value : null,
  };
  if (isEditing.value) emit("save", props.project.id, payload);
  else emit("create", payload);
}

function requestClose() {
  if (!saving.value) emit("close");
}

function emptyForm(templateId = "agile", owner = "") {
  return {
    name: "",
    owner,
    templateId,
    status: templateId === "agile" ? "规划中" : "开发阶段",
    executionTeams: [],
    startDate: "",
    testDate: "",
    acceptanceDate: "",
    releaseDate: "",
    description: "",
  };
}

function projectForm(project) {
  return {
    name: project.name || "",
    owner: project.owner || "",
    templateId: project.templateId || "agile",
    status: project.status || "规划中",
    executionTeams: Array.isArray(project.executionTeams) ? [...project.executionTeams] : [],
    startDate: project.startDate || "",
    testDate: project.testDate || "",
    acceptanceDate: project.acceptanceDate || "",
    releaseDate: project.releaseDate || "",
    description: project.description || "",
  };
}
</script>
