<template>
  <div class="account-menu-section account-identity">
    <span class="avatar account-avatar" :style="{ '--avatar-color': preferences.avatarColor }">{{ user.name?.slice(0, 1) }}</span>
    <span>
      <strong>{{ user.name }}</strong>
      <small>{{ user.email }}</small>
      <small>{{ roleLabel }}</small>
    </span>
  </div>

  <div class="account-menu-section account-menu-items">
    <p class="account-section-label">资料与设置</p>
    <button v-for="item in menuItems" :key="item.key" :ref="register" role="menuitem" type="button" @click="$emit('action', item.key)">
      <Icon :name="item.icon" /><span>{{ item.label }}</span>
    </button>
  </div>

  <div v-if="showLogout" class="account-menu-section account-logout-section">
    <button :ref="register" class="account-menu-logout danger" role="menuitem" type="button" @click="$emit('action', 'logout')">
      <Icon name="logout" /><span>退出登录</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Icon from "../ui/Icon.vue";
defineOptions({ inheritAttrs: false });
const props = defineProps({ user: { type: Object, required: true }, preferences: { type: Object, required: true }, showLogout: { type: Boolean, default: false } });
const emit = defineEmits(["action", "register"]);
const roleLabel = computed(() => props.user.role === "ADMIN" ? "组织管理员" : "项目成员");
const menuItems = [
  { key: "profile", label: "个人资料", icon: "user" },
  { key: "preferences", label: "偏好设置", icon: "sliders" },
  { key: "security", label: "安全设置", icon: "security" },
];
function register(element) { if (element) emit("register", element); }
</script>
