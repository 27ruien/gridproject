<template>
  <div class="progress" :aria-label="`${value}%`">
    <span :style="{ width: `${value}%` }"></span>
  </div>
</template>

<script setup>
defineProps({
  value: { type: Number, default: 0 },
});
</script>

