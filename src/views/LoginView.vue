<template>
  <main class="login-page">
    <section class="login-panel">
      <div>
        <p class="eyebrow">GridProject</p>
        <h1>登录 GridProject</h1>
      </div>
      <label>
        <span>邮箱</span>
        <input v-model.trim="form.email" type="email" autocomplete="email" @keydown.enter="submit" />
      </label>
      <label>
        <span>密码</span>
        <input v-model="form.password" type="password" autocomplete="current-password" @keydown.enter="submit" />
      </label>
      <p v-if="props.error" class="form-error">{{ props.error }}</p>
      <Button variant="primary" :disabled="saving || !form.email || !form.password" @click="submit">
        {{ saving ? "登录中..." : "登录" }}
      </Button>
    </section>
  </main>
</template>

<script setup>
import { reactive } from "vue";
import Button from "../components/ui/Button.vue";

const props = defineProps({
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
});
const emit = defineEmits(["login"]);
const form = reactive({ email: "", password: "" });

function submit() {
  emit("login", { ...form });
}
</script>
