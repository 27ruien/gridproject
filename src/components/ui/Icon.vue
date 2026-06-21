<template>
  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  name: { type: String, required: true },
});

const icons = {
  dashboard: [
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z",
    "M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Z",
    "M4 14.5A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z",
    "M13 14.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z",
  ],
  projects: ["M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"],
  timesheets: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M12 7v5l3 2",
  ],
  costs: [
    "M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z",
    "M4 9h16",
    "M15.5 14.5h2",
    "M7.5 14h4",
  ],
  users: [
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M3.5 20a5.5 5.5 0 0 1 11 0",
    "M17 10a3 3 0 1 0 0-6",
    "M15.5 14.5A4.5 4.5 0 0 1 21 19",
  ],
  settings: [
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M19.4 15a8.2 8.2 0 0 0 .1-1 8.2 8.2 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 5.5h-4L10.7 8a7.5 7.5 0 0 0-1.7 1L6.6 8l-2 3.5 2 1.5a8.2 8.2 0 0 0-.1 1c0 .34.03.67.1 1l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z",
  ],
  trash: ["M5 7h14", "M10 11v6", "M14 11v6", "M7 7l1 13h8l1-13", "M9 7V4h6v3"],
  search: ["M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z", "M15.5 15.5 20 20"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  more: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z", "M14 7l3 3"],
  import: ["M12 4v10", "M8 10l4 4 4-4", "M5 20h14"],
  chevronDown: ["M7 10l5 5 5-5"],
  chevronRight: ["M9 6l6 6-6 6"],
  list: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  board: ["M4 5h7v14H4V5Z", "M13 5h7v8h-7V5Z"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  sort: ["M8 6h12", "M8 12h9", "M8 18h6", "M4 5v14", "M2 17l2 2 2-2"],
  sliders: ["M4 6h8", "M16 6h4", "M4 12h3", "M11 12h9", "M4 18h10", "M18 18h2", "M12 4v4", "M7 10v4", "M14 16v4"],
  check: ["M5 12l4 4L19 6"],
  calendar: ["M5 4v3", "M19 4v3", "M4 9h16", "M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z"],
};

const paths = computed(() => icons[props.name] || icons.more);
</script>

<style scoped>
.ui-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
