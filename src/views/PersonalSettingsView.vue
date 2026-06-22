<template>
  <Teleport to="body">
    <PersonalSettingsLayout :section="section" :user="user" :preferences="preferences" @close="$emit('close')" @navigate="$emit('navigate', $event)">
      <ProfileSettingsPanel v-if="section === 'profile'" :user="user" :preferences="preferences" :saving="saving" @save="forwardProfile" />
      <PreferenceSettingsPanel v-else-if="section === 'preferences'" :preferences="preferences" :saving="saving" @save="forwardPreferences" />
      <SecuritySettingsPanel v-else :saving="saving" :api-mode="apiMode" @save="forwardPassword" />
    </PersonalSettingsLayout>
  </Teleport>
</template>
<script setup>
import PersonalSettingsLayout from "../components/account/PersonalSettingsLayout.vue";
import ProfileSettingsPanel from "../components/account/ProfileSettingsPanel.vue";
import PreferenceSettingsPanel from "../components/account/PreferenceSettingsPanel.vue";
import SecuritySettingsPanel from "../components/account/SecuritySettingsPanel.vue";
defineProps({ section: { type: String, required: true }, user: { type: Object, required: true }, preferences: { type: Object, required: true }, saving: { type: Boolean, default: false }, apiMode: { type: Boolean, default: false } });
const emit = defineEmits(["close", "navigate", "save-profile", "save-preferences", "save-password"]);
function forwardProfile(payload, resolve) { emit("save-profile", payload, resolve); }
function forwardPreferences(payload, resolve) { emit("save-preferences", payload, resolve); }
function forwardPassword(payload, resolve) { emit("save-password", payload, resolve); }
</script>
