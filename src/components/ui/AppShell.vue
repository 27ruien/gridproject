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

      <div class="sidebar-navigation">
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

        <section v-if="projectContext" class="project-sidebar-context" aria-label="当前项目导航">
          <header>
            <span class="project-sidebar-mark" aria-hidden="true">{{ projectContext.name.slice(0, 1) }}</span>
            <div>
              <small>当前项目</small>
              <strong :title="projectContext.name">{{ projectContext.name }}</strong>
            </div>
          </header>
          <nav class="project-sidebar-nav" aria-label="当前项目视图">
            <button
              v-for="view in projectContext.views"
              :key="view"
              class="nav-item project-nav-item"
              :class="{ active: projectContext.activeView === view }"
              :aria-label="view"
              :data-tooltip="view"
              type="button"
              @click="selectProjectView(view)"
            >
              <Icon :name="projectViewIcon(view)" />
              <span>{{ view }}</span>
            </button>
          </nav>
        </section>
      </div>

      <details class="account-menu">
        <summary class="account-trigger" :data-tooltip="manager.name">
          <span class="avatar">{{ manager.name.slice(0, 1) }}</span>
          <strong>{{ manager.name }}</strong>
          <Icon name="chevronDown" />
        </summary>
        <div class="account-popover">
          <strong>{{ manager.name }}</strong>
          <small>{{ manager.role }}</small>
          <small>管理 {{ projectCount }} 个项目</small>
          <button v-if="showLogout" class="account-action" type="button" @click="$emit('logout')">退出登录</button>
        </div>
      </details>
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
  projectContext: { type: Object, default: null },
});

const emit = defineEmits(["navigate", "logout", "project-view"]);
const mobileNavOpen = ref(false);
const navCollapsed = ref(false);
const navPreference = "gridproject.navCollapsed";

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

function selectProjectView(view) {
  emit("project-view", view);
  mobileNavOpen.value = false;
}

function projectViewIcon(view) {
  if (view === "概览") return "dashboard";
  if (view === "看板") return "board";
  if (view === "甘特图") return "calendar";
  if (view === "版本") return "issueEpic";
  if (view === "复盘") return "check";
  return "list";
}

function toggleCollapsed() {
  navCollapsed.value = !navCollapsed.value;
  window.localStorage.setItem(navPreference, String(navCollapsed.value));
}

function syncResponsiveCollapse() {
  if (window.innerWidth < 768) navCollapsed.value = false;
}
</script>
