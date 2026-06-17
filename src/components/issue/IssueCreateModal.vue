<template>
  <Modal :open="open" title="新建事项" :eyebrow="project?.name || '未选择项目'" @close="$emit('close')">
        <label>
          <span>事项类型</span>
          <select v-model="form.type">
            <option v-for="type in template.issueTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
        <label>
          <span>标题</span>
          <input v-model="form.title" placeholder="例如：补齐验收标准" />
        </label>
        <div class="form-two">
          <label>
            <span>执行人</span>
            <PersonPicker v-model="form.owner" :people="people" title="选择执行人" />
          </label>
          <label>
            <span>创建人</span>
            <PersonPicker v-model="form.creator" :people="people" title="选择创建人" />
          </label>
        </div>
        <div class="form-two">
          <label>
            <span>优先级</span>
            <select v-model="form.priority">
              <option>P0</option>
              <option>P1</option>
              <option>P2</option>
              <option>P3</option>
            </select>
          </label>
          <label>
            <span>开始日期</span>
            <input v-model="form.startDate" type="date" />
          </label>
        </div>
        <div class="form-two">
          <label>
            <span>截止日期</span>
            <input v-model="form.dueDate" type="date" />
          </label>
          <label>
            <span>预估工时</span>
            <input v-model.number="form.estimatedHours" min="0" type="number" />
          </label>
        </div>
        <label>
          <span>已投入工时</span>
          <input v-model.number="form.actualHours" min="0" type="number" />
        </label>
        <label>
          <span>说明</span>
          <textarea v-model="form.description" placeholder="说明背景、目标或验收标准"></textarea>
        </label>
        <label>
          <span>下一步</span>
          <input v-model="form.next" placeholder="例如：确认负责人并补齐验收口径" />
        </label>
    <template #footer>
      <Button variant="ghost" @click="$emit('close')">取消</Button>
      <Button variant="primary" @click="submit">创建事项</Button>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, watch } from "vue";
import PersonPicker from "../common/PersonPicker.vue";
import Button from "../ui/Button.vue";
import Modal from "../ui/Modal.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null },
  template: { type: Object, required: true },
  people: { type: Array, required: true },
});

const emit = defineEmits(["close", "create"]);

const form = reactive({
  type: "",
  title: "",
  owner: "",
  creator: "",
  priority: "P1",
  startDate: "",
  dueDate: "",
  estimatedHours: 8,
  actualHours: 0,
  description: "",
  next: "",
});

watch(() => props.open, (open) => {
  if (!open || !props.project) return;
  form.type = props.template.defaultIssueType;
  form.title = "";
  form.owner = props.project.owner;
  form.creator = props.project.owner;
  form.priority = "P1";
  form.startDate = new Date().toISOString().slice(0, 10);
  form.dueDate = "";
  form.estimatedHours = 8;
  form.actualHours = 0;
  form.description = "";
  form.next = "";
});

function submit() {
  if (!props.project) return;
  emit("create", { ...form });
}
</script>
