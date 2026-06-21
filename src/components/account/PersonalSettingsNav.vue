<template>
  <nav class="personal-settings-nav" aria-label="个人设置">
    <button v-for="item in items" :key="item.key" type="button" :class="{ active: active === item.key }" @click="$emit('navigate', item.key)">
      <Icon :name="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
    </button>
  </nav>
</template>
<script setup>
import Icon from "../ui/Icon.vue";
defineProps({ active: { type: String, required: true } });
defineEmits(["navigate"]);
const items = [
  { key: "profile", label: "个人资料", hint: "姓名与头像", icon: "user" },
  { key: "preferences", label: "偏好设置", hint: "界面与日期", icon: "sliders" },
  { key: "security", label: "安全设置", hint: "更新登录密码", icon: "security" },
];
</script>
