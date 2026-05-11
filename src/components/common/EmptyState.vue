<template>
  <section class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button v-if="action" class="btn primary small" type="button" @click="$emit('action')">{{ action }}</button>
  </section>
</template>

<script setup>
defineProps({
  icon: { type: String, default: "＋" },
  title: { type: String, required: true },
  description: { type: String, required: true },
  action: { type: String, default: "" },
});

defineEmits(["action"]);
</script>

