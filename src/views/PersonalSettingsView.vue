<template>
  <Teleport to="body">
    <div class="personal-settings-layer">
      <section class="personal-settings-view" aria-label="个人设置">
        <header class="personal-settings-header"><div><span class="brand-mark">G</span><strong>个人设置</strong></div><IconButton icon="close" label="关闭个人设置" @click="$emit('close')" /></header>
        <div class="personal-settings-body">
          <PersonalSettingsNav :active="section" @navigate="$emit('navigate', $event)" />
          <main class="personal-settings-content">
            <ProfileSettingsPanel v-if="section === 'profile'" :user="user" :preferences="preferences" :saving="saving" @save="forwardProfile" />
            <PreferenceSettingsPanel v-else-if="section === 'preferences'" :preferences="preferences" :saving="saving" @save="forwardPreferences" />
            <SecuritySettingsPanel v-else :saving="saving" :api-mode="apiMode" @save="forwardPassword" />
          </main>
        </div>
      </section>
    </div>
  </Teleport>
</template>
<script setup>
import IconButton from "../components/ui/IconButton.vue";
import PersonalSettingsNav from "../components/account/PersonalSettingsNav.vue";
import ProfileSettingsPanel from "../components/account/ProfileSettingsPanel.vue";
import PreferenceSettingsPanel from "../components/account/PreferenceSettingsPanel.vue";
import SecuritySettingsPanel from "../components/account/SecuritySettingsPanel.vue";
defineProps({ section: { type: String, required: true }, user: { type: Object, required: true }, preferences: { type: Object, required: true }, saving: { type: Boolean, default: false }, apiMode: { type: Boolean, default: false } });
const emit = defineEmits(["close", "navigate", "save-profile", "save-preferences", "save-password"]);
function forwardProfile(payload, resolve) { emit("save-profile", payload, resolve); }
function forwardPreferences(payload, resolve) { emit("save-preferences", payload, resolve); }
function forwardPassword(payload, resolve) { emit("save-password", payload, resolve); }
</script>
