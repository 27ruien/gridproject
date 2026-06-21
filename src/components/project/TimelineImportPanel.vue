<template>
  <section class="timeline-import-panel" aria-labelledby="timeline-import-title">
    <div class="timeline-import-heading">
      <div>
        <p class="eyebrow">可选</p>
        <h3 id="timeline-import-title">导入 Timeline</h3>
        <p>先解析并检查阶段、任务和关键日期，保存项目时才会写入。</p>
      </div>
      <label class="ui-button ghost small file-trigger">
        {{ loading ? "正在解析" : "选择文件" }}
        <input
          :disabled="loading"
          accept=".xlsx,.xlsm,.csv,.json,.txt,.tsv"
          type="file"
          @change="readFile"
        />
      </label>
    </div>

    <div class="timeline-source-grid">
      <label class="full-field">
        <span>粘贴排期内容</span>
        <textarea
          v-model="text"
          class="schedule-import-textarea"
          placeholder="Model,事项名称,相关方,开始日期,工作日天数或结束日期,状态"
        ></textarea>
      </label>
      <Button variant="ghost" size="small" :disabled="!text.trim() || loading" @click="parseText">解析内容</Button>
    </div>

    <div v-if="sourceLabel" class="timeline-file-note">
      <strong>{{ sourceLabel }}</strong>
      <span v-if="preview.sheetName">Sheet：{{ preview.sheetName }}</span>
    </div>

    <div v-if="preview.errors.length" class="import-message-list error" role="alert">
      <p v-for="error in preview.errors" :key="error.code">{{ error.message }}</p>
    </div>

    <template v-if="preview.tasks.length">
      <div class="import-stat-grid timeline-stats">
        <span><b>{{ preview.recognizedPhaseCount }}</b><small>识别阶段</small></span>
        <span><b>{{ preview.tasks.length }}</b><small>有效任务</small></span>
        <span><b>{{ preview.unrecognizedTaskCount }}</b><small>未匹配任务</small></span>
        <span><b>{{ preview.warnings.length }}</b><small>未识别行</small></span>
      </div>

      <fieldset class="timeline-behavior">
        <legend>保存行为</legend>
        <label v-for="option in behaviorOptions" :key="option.value" :class="{ active: behavior === option.value }">
          <input v-model="behavior" type="radio" :value="option.value" />
          <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
        </label>
      </fieldset>

      <div class="timeline-preview-section">
        <div class="timeline-section-heading">
          <div>
            <h4>关键日期</h4>
            <p>日期可在保存前调整；来源用于核对识别依据。</p>
          </div>
        </div>
        <div class="key-date-editor-grid">
          <label v-for="field in dateFields" :key="field.key">
            <span>{{ field.label }}</span>
            <input v-model="editableDates[field.key]" type="date" @input="emitChange" />
            <small :title="dateSource(field.key)">{{ dateSource(field.key) }}</small>
          </label>
        </div>
      </div>

      <div class="timeline-preview-section">
        <div class="timeline-section-heading">
          <div>
            <h4>阶段与任务</h4>
            <p>未匹配任务会保留，可在这里修正阶段、名称和日期。</p>
          </div>
        </div>
        <div class="timeline-task-table-wrap">
          <table class="timeline-task-table">
            <thead><tr><th>阶段</th><th>任务</th><th>开始</th><th>结束</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="(task, index) in editableTasks" :key="`${task.originalIndex}-${index}`">
                <td><input v-model="task.model" aria-label="阶段" @change="reanalyzeTasks" /></td>
                <td><input v-model="task.name" aria-label="任务名称" @change="reanalyzeTasks" /></td>
                <td><input v-model="task.startDate" aria-label="开始日期" type="date" @change="reanalyzeTasks" /></td>
                <td><input v-model="task.dueDate" aria-label="结束日期" type="date" @change="reanalyzeTasks" /></td>
                <td><span class="status-lozenge neutral">{{ task.status || "未完成" }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="preview.warnings.length" class="import-message-list warning">
        <p v-for="warning in preview.warnings" :key="warning">{{ warning }}</p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { analyzeScheduleImport, parseScheduleText } from "../../domain/scheduleImport.js";
import { parseScheduleFile } from "../../services/scheduleFileService.js";
import Button from "../ui/Button.vue";

const props = defineProps({
  initialBehavior: { type: String, default: "merge" },
});
const emit = defineEmits(["change"]);

const behaviorOptions = [
  { value: "dates-only", label: "仅更新关键日期", description: "不创建或修改任务" },
  { value: "merge", label: "合并任务", description: "只更新此前由 Timeline 导入的匹配任务" },
  { value: "replace", label: "替换 Timeline", description: "替换此前导入的任务，手工任务保留" },
];
const dateFields = [
  { key: "startDate", label: "项目开始" },
  { key: "developmentDate", label: "开发开始" },
  { key: "testDate", label: "测试时间" },
  { key: "acceptanceDate", label: "验收时间" },
  { key: "releaseDate", label: "上线时间" },
];
const text = ref("");
const loading = ref(false);
const behavior = ref(props.initialBehavior);
const editableTasks = ref([]);
const editableDates = reactive(emptyDates());
const preview = ref(emptyPreview());
const sourceLabel = computed(() => preview.value.fileName || (editableTasks.value.length ? "粘贴内容" : ""));

watch(behavior, emitChange);

async function readFile(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  loading.value = true;
  const result = await parseScheduleFile(file);
  loading.value = false;
  applyPreview(result);
}

function parseText() {
  applyPreview({ ...parseScheduleText(text.value), fileName: "", sheetName: "" });
}

function applyPreview(result) {
  preview.value = result;
  editableTasks.value = result.tasks.map((task) => ({ ...task, owners: [...(task.owners || [])] }));
  dateFields.forEach(({ key }) => {
    editableDates[key] = result.keyDates?.[key]?.date || "";
  });
  emitChange();
}

function reanalyzeTasks() {
  const previousDates = { ...editableDates };
  const analyzed = analyzeScheduleImport({
    tasks: editableTasks.value,
    warnings: preview.value.warnings,
    errors: [],
  });
  preview.value = { ...preview.value, ...analyzed };
  editableTasks.value = analyzed.tasks.map((task) => ({ ...task, owners: [...(task.owners || [])] }));
  dateFields.forEach(({ key }) => {
    editableDates[key] = previousDates[key] || analyzed.keyDates?.[key]?.date || "";
  });
  emitChange();
}

function dateSource(key) {
  const result = preview.value.keyDates?.[key];
  if (!result?.date) return "未自动识别";
  return `${result.sourceLabel} · ${result.match}`;
}

function emitChange() {
  emit("change", {
    ...preview.value,
    tasks: editableTasks.value.map((task) => ({ ...task, owners: [...(task.owners || [])] })),
    dates: { ...editableDates },
    behavior: behavior.value,
    valid: editableTasks.value.length > 0 && preview.value.errors.length === 0,
  });
}

function reset() {
  text.value = "";
  behavior.value = props.initialBehavior;
  editableTasks.value = [];
  Object.assign(editableDates, emptyDates());
  preview.value = emptyPreview();
  emitChange();
}

function emptyDates() {
  return { startDate: "", developmentDate: "", testDate: "", acceptanceDate: "", releaseDate: "" };
}

function emptyPreview() {
  return {
    tasks: [], phases: [], warnings: [], errors: [], keyDates: {},
    recognizedPhaseCount: 0, unrecognizedTaskCount: 0, fileName: "", sheetName: "",
  };
}

defineExpose({ reset });
</script>
