<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal large">
      <header class="drawer-head">
        <div>
          <p class="eyebrow">{{ project.name }}</p>
          <h2>导入项目排期</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="$emit('close')">
          <Icon name="close" />
        </button>
      </header>

      <div class="modal-body schedule-import-layout">
        <div class="form-panel">
          <div class="schedule-import-actions">
            <label class="btn ghost small file-trigger">
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

        <div class="modal-actions wide">
          <button class="btn ghost" type="button" @click="$emit('close')">取消</button>
          <button class="btn primary" type="button" :disabled="!canSubmit" @click="submit">导入排期</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { TIMELINE_IMPORT_FIELDS, parseScheduleText } from "../../domain/scheduleImport.js";
import Icon from "../ui/Icon.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, required: true },
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
