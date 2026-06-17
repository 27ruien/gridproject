<template>
  <Modal :open="open" :title="title" :eyebrow="eyebrow" size="confirm-modal" @close="$emit('cancel')">
    <p class="confirm-copy">{{ message }}</p>
    <template #footer>
      <Button variant="ghost" @click="$emit('cancel')">取消</Button>
      <Button variant="danger" :disabled="busy" @click="$emit('confirm')">{{ confirmText }}</Button>
    </template>
  </Modal>
</template>

<script setup>
import Button from "./Button.vue";
import Modal from "./Modal.vue";

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  eyebrow: { type: String, default: "确认操作" },
  message: { type: String, required: true },
  confirmText: { type: String, default: "确认删除" },
  busy: { type: Boolean, default: false },
});

defineEmits(["cancel", "confirm"]);
</script>
