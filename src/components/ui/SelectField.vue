<template>
  <label class="ui-select-field">
    <span>{{ label }}</span>
    <span class="ui-select-control">
      <select :value="modelValue" :aria-label="label" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <Icon name="chevronDown" />
    </span>
  </label>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
  modelValue: { type: String, required: true },
  label: { type: String, required: true },
  options: { type: Array, required: true },
});
defineEmits(["update:modelValue"]);
</script>
