<template>
  <div class="app-shell" :class="[{ 'nav-collapsed': navCollapsed }, `density-${preferences.density}`]" @keydown.esc="mobileNavOpen = false">
    <header class="mobile-shellbar">
      <div class="brand">
        <span class="brand-mark">{{ settings.logoText }}</span>
        <strong>{{ settings.platformName }}</strong>
      </div>
      <div class="mobile-shell-actions">
        <AccountMenu class="mobile-account-menu" :user="manager" :preferences="preferences" :show-logout="showLogout" @open="mobileNavOpen = false" @navigate="$emit('account-navigate', $event)" @logout="$emit('logout')" />
        <IconButton icon="menu" label="打开导航" :aria-expanded="mobileNavOpen" @click="mobileNavOpen = true" />
      </div>
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
          <template v-for="route in routes" :key="route.key">
            <div v-if="route.children?.length" class="nav-group" :class="{ open: isRouteGroupOpen(route), active: isRouteGroupActive(route) }">
              <button
                class="nav-item nav-group-trigger"
                :class="{ active: isRouteGroupActive(route) }"
                :aria-label="route.label"
                :aria-expanded="isRouteGroupOpen(route)"
                :data-tooltip="route.label"
                type="button"
                @click="toggleRouteGroup(route.key)"
              >
                <Icon :name="route.icon" />
                <span>{{ route.label }}</span>
                <Icon class="nav-group-arrow" name="chevronDown" />
              </button>
              <div v-if="isRouteGroupOpen(route)" class="nav-submenu" role="group" :aria-label="route.label">
                <button
                  v-for="child in route.children"
                  :key="child.key"
                  class="nav-item nav-subitem"
                  :class="{ active: currentView === child.key }"
                  :aria-label="child.label"
                  :data-tooltip="child.label"
                  type="button"
                  @click="navigate(child.key)"
                >
                  <Icon :name="child.icon" />
                  <span>{{ child.label }}</span>
                </button>
              </div>
            </div>
            <button
              v-else
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
          </template>
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
import AccountMenu from "../account/AccountMenu.vue";
import { storageKey } from "../../services/appEnvironment.js";

const props = defineProps({
  routes: { type: Array, required: true },
  currentView: { type: String, required: true },
  settings: { type: Object, required: true },
  manager: { type: Object, required: true },
  preferences: { type: Object, required: true },
  showLogout: { type: Boolean, default: false },
  projectContext: { type: Object, default: null },
});

const emit = defineEmits(["navigate", "logout", "project-view", "account-navigate"]);
const mobileNavOpen = ref(false);
const navCollapsed = ref(false);
const openRouteGroups = ref(new Set());
const navPreference = storageKey("navCollapsed");

watch(() => props.currentView, () => {
  mobileNavOpen.value = false;
  syncOpenRouteGroups();
});

onMounted(() => {
  applyNavPreference(props.preferences.defaultNav);
  syncOpenRouteGroups();
  window.addEventListener("resize", syncResponsiveCollapse);
});

watch(() => props.preferences.defaultNav, applyNavPreference, { immediate: true });

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

function toggleRouteGroup(routeKey) {
  const next = new Set(openRouteGroups.value);
  if (next.has(routeKey)) next.delete(routeKey);
  else next.add(routeKey);
  openRouteGroups.value = next;
}

function isRouteGroupActive(route) {
  return Boolean(route.children?.some((child) => child.key === props.currentView));
}

function isRouteGroupOpen(route) {
  return isRouteGroupActive(route) || openRouteGroups.value.has(route.key);
}

function syncOpenRouteGroups() {
  const activeGroup = props.routes.find((route) => route.children?.some((child) => child.key === props.currentView));
  if (!activeGroup || openRouteGroups.value.has(activeGroup.key)) return;
  const next = new Set(openRouteGroups.value);
  next.add(activeGroup.key);
  openRouteGroups.value = next;
}

function projectViewIcon(view) {
  if (view === "概览") return "dashboard";
  if (view === "工作项") return "board";
  if (view === "里程碑") return "milestone";
  if (view === "交付与验收") return "check";
  if (view === "风险") return "issueRisk";
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
  else if (props.preferences.defaultNav === "auto") navCollapsed.value = window.innerWidth < 1024;
}

function applyNavPreference(value) {
  if (typeof window === "undefined") return;
  if (value === "collapsed") navCollapsed.value = true;
  else if (value === "expanded") navCollapsed.value = false;
  else navCollapsed.value = window.innerWidth >= 768 && window.innerWidth < 1024;
}
</script>
