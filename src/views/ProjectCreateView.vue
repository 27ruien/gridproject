<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal large">
      <header class="drawer-head">
        <div>
          <p class="eyebrow">创建项目</p>
          <h2>选择模板并初始化项目空间</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭弹窗" @click="$emit('close')">×</button>
      </header>
      <div class="modal-body create-layout">
        <div>
          <label>
            <span>项目名称</span>
            <input v-model="form.name" placeholder="例如：新客户交付项目" />
          </label>
          <div class="form-two">
            <label>
              <span>项目负责人</span>
              <PersonPicker v-model="form.owner" :people="people" title="选择项目负责人" />
            </label>
            <label>
              <span>项目模板</span>
              <select v-model="form.templateId">
                <option v-for="template in templates" :key="template.id" :value="template.id">{{ template.name }}</option>
              </select>
            </label>
          </div>
          <div class="form-two">
            <label>
              <span>开始日期</span>
              <input v-model="form.startDate" type="date" />
            </label>
            <label>
              <span>截止日期</span>
              <input v-model="form.dueDate" type="date" />
            </label>
          </div>
          <div class="form-two">
            <label>
              <span>测试时间</span>
              <input v-model="form.testDate" type="date" />
            </label>
            <label>
              <span>验收时间</span>
              <input v-model="form.acceptanceDate" type="date" />
            </label>
          </div>
          <label>
            <span>上线时间</span>
            <input v-model="form.releaseDate" type="date" />
          </label>
          <label>
            <span>项目说明</span>
            <textarea v-model="form.description" placeholder="说明项目目标、范围或客户背景"></textarea>
          </label>
        </div>

        <div>
          <p class="form-label">模板会决定默认视图、事项类型、字段和空状态引导</p>
          <div class="template-select">
            <TemplateCard
              v-for="template in templates"
              :key="template.id"
              :template="template"
              :selected="form.templateId === template.id"
              @select="form.templateId = $event"
            />
          </div>
        </div>

        <div class="modal-actions wide">
          <button class="btn ghost" type="button" @click="$emit('close')">取消</button>
          <button class="btn primary" type="button" @click="submit">创建项目</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, watch } from "vue";
import TemplateCard from "../components/template/TemplateCard.vue";
import PersonPicker from "../components/common/PersonPicker.vue";
import { addDays, formatDate } from "../services/projectService";

const props = defineProps({
  open: { type: Boolean, default: false },
  templates: { type: Array, required: true },
  people: { type: Array, required: true },
  selectedTemplateId: { type: String, default: "agile" },
});

const emit = defineEmits(["close", "create"]);

const form = reactive({
  name: "",
  owner: "",
  templateId: "agile",
  startDate: "",
  dueDate: "",
  testDate: "",
  acceptanceDate: "",
  releaseDate: "",
  description: "",
});

watch(() => props.open, (open) => {
  if (!open) return;
  form.name = "";
  form.owner = props.people[0] || "";
  form.templateId = props.selectedTemplateId;
  form.startDate = formatDate(new Date());
  form.dueDate = formatDate(addDays(new Date(), 30));
  form.testDate = formatDate(addDays(new Date(), 21));
  form.acceptanceDate = formatDate(addDays(new Date(), 27));
  form.releaseDate = formatDate(addDays(new Date(), 30));
  form.description = "";
});

function submit() {
  emit("create", { ...form });
}
</script>
