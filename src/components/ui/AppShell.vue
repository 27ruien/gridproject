<template>
  <div class="app-shell" :class="{ 'nav-collapsed': navCollapsed }" @keydown.esc="mobileNavOpen = false">
    <header class="mobile-shellbar">
      <div class="brand">
        <span class="brand-mark">{{ settings.logoText }}</span>
        <strong>{{ settings.platformName }}</strong>
      </div>
      <IconButton icon="menu" label="打开导航" :aria-expanded="mobileNavOpen" @click="mobileNavOpen = true" />
    </header>

    <button v-if="mobileNavOpen" class="sidebar-scrim" type="button" aria-label="关闭导航" @click="mobileNavOpen = false" />

    <aside class="sidebar" :class="{ open: mobileNavOpen }">
      <div class="sidebar-head">
        <div class="brand">
          <span class="brand-mark">{{ settings.logoText }}</span>
          <div>
            <strong>{{ settings.platformName }}</strong>
          </div>
        </div>
        <IconButton class="collapse-toggle" icon="menu" :label="navCollapsed ? '展开导航' : '收起导航'" @click="toggleCollapsed" />
        <IconButton class="mobile-close" icon="close" label="关闭导航" @click="mobileNavOpen = false" />
      </div>

      <nav class="nav" aria-label="主导航">
        <button
          v-for="route in routes"
          :key="route.key"
          class="nav-item"
          :class="{ active: currentView === route.key }"
          :aria-label="route.label"
          :data-tooltip="route.label"
          type="button"
          @click="navigate(route.key)"
        >
          <Icon :name="route.icon" />
          <span>{{ route.label }}</span>
        </button>
      </nav>

      <section class="manager-card">
        <span class="avatar">{{ manager.name.slice(0, 1) }}</span>
        <div>
          <strong>{{ manager.name }}</strong>
          <small>{{ manager.role }} · 管理 {{ projectCount }} 个项目</small>
        </div>
        <button v-if="showLogout" class="logout-button" type="button" @click="$emit('logout')">退出</button>
      </section>
    </aside>

    <main class="workspace">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import IconButton from "./IconButton.vue";

const props = defineProps({
  routes: { type: Array, required: true },
  currentView: { type: String, required: true },
  settings: { type: Object, required: true },
  manager: { type: Object, required: true },
  projectCount: { type: Number, required: true },
  showLogout: { type: Boolean, default: false },
});

const emit = defineEmits(["navigate", "logout"]);
const mobileNavOpen = ref(false);
const navCollapsed = ref(false);
const navPreference = "kiviflow.navCollapsed";

watch(() => props.currentView, () => {
  mobileNavOpen.value = false;
});

onMounted(() => {
  const saved = window.localStorage.getItem(navPreference);
  navCollapsed.value = saved ? saved === "true" : window.innerWidth >= 768 && window.innerWidth < 1024;
  window.addEventListener("resize", syncResponsiveCollapse);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncResponsiveCollapse);
});

function navigate(routeKey) {
  emit("navigate", routeKey);
  mobileNavOpen.value = false;
}

function toggleCollapsed() {
  navCollapsed.value = !navCollapsed.value;
  window.localStorage.setItem(navPreference, String(navCollapsed.value));
}

function syncResponsiveCollapse() {
  if (window.innerWidth < 768) navCollapsed.value = false;
}
</script>
