<template>
  <Modal :open="open" title="导入项目排期" :eyebrow="project?.name || '未选择项目'" size="large" @close="$emit('close')">
      <div class="schedule-import-layout">
        <div class="form-panel">
          <div class="schedule-import-actions">
            <label class="ui-button ghost small file-trigger">
              选择文件
              <input accept=".csv,.json,.txt,.tsv" type="file" @change="readFile" />
            </label>
            <label class="check-line">
              <input v-model="merge" type="checkbox" />
              <span>按标题更新已有事项</span>
            </label>
          </div>

          <label class="full-field">
            <span>排期内容</span>
            <textarea
              v-model="text"
              class="schedule-import-textarea"
              placeholder="Model,事项名称,相关方,开始日期,工作日天数或结束日期,状态&#10;需求,Scope addendum,Kivisense,2026-06-18,4天,未完成&#10;设计,Creative Proposal,Kivisense,brand,2026-06-22,2026-07-03,未完成"
            ></textarea>
          </label>
        </div>

        <aside class="schedule-import-preview">
          <div>
            <span>可识别字段</span>
            <div class="field-chip-list">
              <small v-for="field in fields" :key="field">{{ field }}</small>
            </div>
          </div>

          <div class="import-stat-grid">
            <span><b>{{ preview.tasks.length }}</b><small>可导入事项</small></span>
            <span><b>{{ preview.warnings.length }}</b><small>需检查行</small></span>
          </div>

          <div v-if="preview.warnings.length" class="import-warning-list">
            <p v-for="warning in preview.warnings.slice(0, 4)" :key="warning">{{ warning }}</p>
          </div>
        </aside>
    </div>
    <template #footer>
      <Button variant="ghost" @click="$emit('close')">取消</Button>
      <Button variant="primary" :disabled="!canSubmit" @click="submit">导入排期</Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { TIMELINE_IMPORT_FIELDS, parseScheduleText } from "../../domain/scheduleImport.js";
import Button from "../ui/Button.vue";
import Modal from "../ui/Modal.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null },
});

const emit = defineEmits(["close", "import"]);
const fields = TIMELINE_IMPORT_FIELDS;
const text = ref("");
const merge = ref(true);

const preview = computed(() => text.value.trim() ? parseScheduleText(text.value) : { tasks: [], warnings: [] });
const canSubmit = computed(() => preview.value.tasks.length > 0);

watch(() => props.open, (open) => {
  if (!open) return;
  text.value = "";
  merge.value = true;
});

async function readFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  text.value = await file.text();
  event.target.value = "";
}

function submit() {
  if (!canSubmit.value) return;
  emit("import", {
    text: text.value,
    merge: merge.value,
  });
}
</script>
