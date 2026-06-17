<template>
  <section class="empty-state">
    <div class="empty-icon"><Icon :name="iconName" /></div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <Button v-if="action" variant="primary" size="small" @click="$emit('action')">{{ action }}</Button>
  </section>
</template>

<script setup>
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";

defineProps({
  iconName: { type: String, default: "plus" },
  title: { type: String, required: true },
  description: { type: String, required: true },
  action: { type: String, default: "" },
});

defineEmits(["action"]);
</script>
