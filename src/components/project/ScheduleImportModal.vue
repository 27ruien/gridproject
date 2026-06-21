<template>
  <Modal :open="open" title="导入项目 Timeline" :eyebrow="project?.name || '未选择项目'" size="large" @close="$emit('close')">
    <TimelineImportPanel ref="panel" @change="preview = $event" />
    <template #footer>
      <Button variant="ghost" @click="$emit('close')">取消</Button>
      <Button variant="primary" :disabled="!canSubmit" @click="submit">确认导入</Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import Button from "../ui/Button.vue";
import Modal from "../ui/Modal.vue";
import TimelineImportPanel from "./TimelineImportPanel.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null },
});

const emit = defineEmits(["close", "import"]);
const panel = ref(null);
const preview = ref(null);
const canSubmit = computed(() => Boolean(preview.value?.valid));

watch(() => props.open, (open) => {
  if (!open) return;
  preview.value = null;
  panel.value?.reset();
}, { flush: "post" });

function submit() {
  if (!canSubmit.value) return;
  emit("import", preview.value);
}
</script>
