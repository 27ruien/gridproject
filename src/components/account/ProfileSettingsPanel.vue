<template>
  <form class="settings-panel-form" @submit.prevent="submit">
    <header><h2>个人资料</h2><p>维护其他成员在项目中看到的身份信息。</p></header>
    <div class="profile-avatar-editor">
      <span class="avatar profile-avatar" :style="{ '--avatar-color': form.avatarColor }">{{ initial }}</span>
      <div><strong>头像颜色</strong><div class="avatar-swatches"><button v-for="color in colors" :key="color" type="button" :class="{ selected: form.avatarColor === color }" :style="{ background: color }" :aria-label="`选择头像颜色 ${color}`" @click="form.avatarColor = color" /></div></div>
    </div>
    <label><span>姓名</span><input v-model="form.name" autocomplete="name" :aria-invalid="Boolean(fieldErrors.name)" /><small v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</small></label>
    <label><span>登录邮箱</span><input :value="user.email" type="email" readonly aria-readonly="true" /><small>邮箱由组织管理员维护，个人资料中不可修改。</small></label>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <footer><Button variant="primary" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存资料" }}</Button></footer>
  </form>
</template>
<script setup>
import { computed, reactive, ref, watch } from "vue";
import Button from "../ui/Button.vue";
const props = defineProps({ user: { type: Object, required: true }, preferences: { type: Object, required: true }, saving: { type: Boolean, default: false } });
const emit = defineEmits(["save"]);
const colors = ["#315a9f", "#177565", "#8b5a18", "#7656a7", "#9b4454", "#3f6c7a"];
const form = reactive({ name: props.user.name, avatarColor: props.preferences.avatarColor });
const error = ref("");
const fieldErrors = reactive({ name: "" });
const initial = computed(() => form.name.trim().slice(0, 1) || "用");
watch(() => props.user, (user) => { form.name = user.name; }, { deep: true });
async function submit() {
  error.value = ""; fieldErrors.name = "";
  if (!form.name.trim()) { fieldErrors.name = "请输入姓名。"; return; }
  const result = await emitSave({ name: form.name.trim(), avatarColor: form.avatarColor });
  if (!result?.ok) {
    error.value = result?.message || "资料保存失败。";
    fieldErrors.name = result?.details?.fieldErrors?.name?.[0] || "";
  }
}
function emitSave(payload) { return new Promise((resolve) => emit("save", payload, resolve)); }
</script>
