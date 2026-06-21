<template>
  <form class="settings-panel-form" @submit.prevent="submit">
    <header><h2>安全设置</h2><p>更新密码后，当前设备保持登录，其他设备上的会话将退出。</p></header>
    <div class="security-notice"><Icon name="security" /><span><strong>密码要求</strong><small>至少 10 位，并同时包含字母和数字。</small></span></div>
    <label v-for="field in fields" :key="field.key"><span>{{ field.label }}</span><span class="password-field"><input v-model="form[field.key]" :type="visibility[field.key] ? 'text' : 'password'" :autocomplete="field.autocomplete" /><button type="button" :aria-label="visibility[field.key] ? '隐藏密码' : '显示密码'" @click="visibility[field.key] = !visibility[field.key]"><Icon :name="visibility[field.key] ? 'eyeOff' : 'eye'" /></button></span><small v-if="errors[field.key]" class="field-error">{{ errors[field.key] }}</small></label>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <footer><Button variant="primary" type="submit" :disabled="saving">{{ saving ? "更新中…" : "更新密码" }}</Button><small v-if="!apiMode">本地演示模式不保存登录密码。</small></footer>
  </form>
</template>
<script setup>
import { reactive, ref } from "vue";
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";
const props = defineProps({ saving: { type: Boolean, default: false }, apiMode: { type: Boolean, default: false } });
const emit = defineEmits(["save"]);
const fields = [{ key: "currentPassword", label: "当前密码", autocomplete: "current-password" }, { key: "newPassword", label: "新密码", autocomplete: "new-password" }, { key: "confirmPassword", label: "确认新密码", autocomplete: "new-password" }];
const form = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
const visibility = reactive({ currentPassword: false, newPassword: false, confirmPassword: false });
const errors = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
const error = ref("");
async function submit() {
  error.value = ""; Object.keys(errors).forEach((key) => { errors[key] = ""; });
  if (!form.currentPassword) errors.currentPassword = "请输入当前密码。";
  if (form.newPassword.length < 10 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) errors.newPassword = "新密码至少 10 位，并包含字母和数字。";
  if (form.newPassword === form.currentPassword) errors.newPassword = "新密码不能与当前密码相同。";
  if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "两次输入的新密码不一致。";
  if (Object.values(errors).some(Boolean)) return;
  const result = await new Promise((resolve) => emit("save", { ...form }, resolve));
  if (!result?.ok) { error.value = result?.message || "密码更新失败。"; return; }
  Object.assign(form, { currentPassword: "", newPassword: "", confirmPassword: "" });
}
</script>
