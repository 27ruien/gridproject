<template>
  <section class="view-stack">
    <div class="panel settings-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">平台设置</p>
          <h2>品牌信息</h2>
          <p>维护左上角平台 Logo 和平台名称，避免把组织名写死在界面里。</p>
        </div>
      </div>

      <div class="settings-form">
        <div class="brand-preview">
          <span class="brand-mark preview-mark">{{ form.logoText || "K" }}</span>
          <strong>{{ form.platformName || "KiviFlow" }}</strong>
        </div>
        <div class="settings-fields">
          <label>
            <span>平台 Logo 文案</span>
            <input v-model="form.logoText" maxlength="2" placeholder="例如 K" />
          </label>
          <label>
            <span>平台名称</span>
            <input v-model="form.platformName" placeholder="例如 KiviFlow" />
          </label>
          <div class="modal-actions">
            <Button variant="primary" @click="save">保存设置</Button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, watch } from "vue";
import Button from "../components/ui/Button.vue";

const props = defineProps({
  settings: { type: Object, required: true },
});

const emit = defineEmits(["save"]);

const form = reactive({
  platformName: "",
  logoText: "",
});

watch(() => props.settings, (settings) => {
  form.platformName = settings.platformName;
  form.logoText = settings.logoText;
}, { immediate: true, deep: true });

function save() {
  emit("save", { ...form });
}
</script>
