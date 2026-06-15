<template>
  <div class="app-shell" @keydown.esc="mobileNavOpen = false">
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
        <IconButton class="mobile-close" icon="close" label="关闭导航" @click="mobileNavOpen = false" />
      </div>

      <nav class="nav" aria-label="主导航">
        <button
          v-for="route in routes"
          :key="route.key"
          class="nav-item"
          :class="{ active: currentView === route.key }"
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
      </section>
    </aside>

    <main class="workspace">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import Icon from "./Icon.vue";
import IconButton from "./IconButton.vue";

const props = defineProps({
  routes: { type: Array, required: true },
  currentView: { type: String, required: true },
  settings: { type: Object, required: true },
  manager: { type: Object, required: true },
  projectCount: { type: Number, required: true },
});

const emit = defineEmits(["navigate"]);
const mobileNavOpen = ref(false);

watch(() => props.currentView, () => {
  mobileNavOpen.value = false;
});

function navigate(routeKey) {
  emit("navigate", routeKey);
  mobileNavOpen.value = false;
}
</script>
