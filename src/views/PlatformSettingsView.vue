<template>
  <section class="view-stack platform-settings-view">
    <div class="platform-settings-shell">
      <aside class="platform-settings-sidebar" aria-label="平台设置分类">
        <p class="eyebrow">平台设置</p>
        <nav>
          <button class="active" type="button">
            <span class="brand-mark preview-mark">{{ normalizedLogo }}</span>
            <span>
              <strong>基本设置</strong>
              <small>名称与 Logo</small>
            </span>
          </button>
        </nav>
      </aside>

      <form class="settings-panel-form platform-settings-form" @submit.prevent="save">
        <header>
          <div>
            <p class="eyebrow">基本设置</p>
            <h2>品牌信息</h2>
            <p>维护平台名称和左侧导航中的 Logo 文案。</p>
          </div>
          <span class="platform-save-state" :class="{ dirty: isDirty }">{{ isDirty ? "有未保存更改" : "已保存" }}</span>
        </header>

        <section class="platform-brand-row">
          <div class="platform-brand-preview" aria-label="品牌预览">
            <span class="brand-mark preview-mark">{{ normalizedLogo }}</span>
            <span>
              <strong>{{ normalizedName }}</strong>
              <small>导航与浏览器标题中的品牌展示</small>
            </span>
          </div>
        </section>

        <div class="settings-field-grid">
          <label>
            <span>平台 Logo 文案</span>
            <input v-model.trim="form.logoText" maxlength="2" placeholder="例如 G" />
          </label>
          <label>
            <span>平台名称</span>
            <input v-model.trim="form.platformName" maxlength="80" placeholder="例如 GridProject" />
          </label>
        </div>

        <footer>
          <Button variant="primary" type="submit" :disabled="!canSave">保存设置</Button>
          <Button variant="ghost" type="button" :disabled="!isDirty" @click="resetForm">还原</Button>
        </footer>
      </form>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, watch } from "vue";
import Button from "../components/ui/Button.vue";

const props = defineProps({
  settings: { type: Object, required: true },
});

const emit = defineEmits(["save"]);

const form = reactive({
  platformName: "",
  logoText: "",
});

const normalizedName = computed(() => form.platformName.trim() || "GridProject");
const normalizedLogo = computed(() => (form.logoText.trim() || "G").slice(0, 2));
const isDirty = computed(() => (
  form.platformName.trim() !== String(props.settings.platformName || "") ||
  form.logoText.trim() !== String(props.settings.logoText || "")
));
const canSave = computed(() => isDirty.value && normalizedName.value.length > 0 && normalizedLogo.value.length > 0);

watch(() => props.settings, () => {
  resetForm();
}, { immediate: true, deep: true });

function save() {
  if (!canSave.value) return;
  emit("save", {
    platformName: normalizedName.value,
    logoText: normalizedLogo.value,
  });
}

function resetForm() {
  form.platformName = props.settings.platformName || "GridProject";
  form.logoText = props.settings.logoText || "G";
}
</script>
