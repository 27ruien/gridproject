<template>
  <div class="personal-settings-layer">
    <section class="personal-settings-view" aria-label="个人设置">
      <header class="personal-settings-header">
        <div><span class="brand-mark">G</span><strong>个人设置</strong></div>
        <IconButton icon="close" label="关闭个人设置" @click="$emit('close')" />
      </header>
      <div class="personal-settings-body">
        <aside class="personal-settings-sidebar">
          <div class="personal-settings-identity">
            <span class="avatar profile-avatar-small" :style="{ '--avatar-color': preferences.avatarColor }">{{ initial }}</span>
            <span><strong>{{ user.name }}</strong><small>{{ user.email }}</small></span>
          </div>
          <PersonalSettingsNav :active="section" @navigate="$emit('navigate', $event)" />
        </aside>
        <main class="personal-settings-content"><slot /></main>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import IconButton from "../ui/IconButton.vue";
import PersonalSettingsNav from "./PersonalSettingsNav.vue";

const props = defineProps({
  section: { type: String, required: true },
  user: { type: Object, required: true },
  preferences: { type: Object, required: true },
});
defineEmits(["close", "navigate"]);
const initial = computed(() => props.user.name?.trim()?.slice(0, 1) || "用");
</script>
