<template>
  <form class="settings-panel-form" @submit.prevent="submit">
    <header><h2>偏好设置</h2><p>这些设置会应用到当前账号的工作界面。</p></header>
    <fieldset><legend>界面密度</legend><div class="settings-choice-grid"><label v-for="item in densityOptions" :key="item.value" :class="{ selected: form.density === item.value }"><input v-model="form.density" type="radio" name="density" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span></label></div></fieldset>
    <div class="settings-field-grid">
      <label><span>日期格式</span><select v-model="form.dateFormat"><option value="yyyy-mm-dd">2026-06-22</option><option value="mm-dd-yyyy">06-22-2026</option><option value="dd-mm-yyyy">22-06-2026</option></select></label>
      <label><span>每周起始日</span><select v-model="form.weekStart"><option value="monday">周一</option><option value="sunday">周日</option></select></label>
      <label><span>默认导航状态</span><select v-model="form.defaultNav"><option value="expanded">展开</option><option value="collapsed">收起</option><option value="auto">跟随窗口宽度</option></select></label>
      <label><span>主页到期事项默认范围</span><select v-model="form.homeDueRange"><option value="all">全部</option><option value="mine">我的</option><option value="others">其他成员</option></select></label>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <footer><Button variant="primary" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存偏好" }}</Button></footer>
  </form>
</template>
<script setup>
import { reactive, ref, watch } from "vue";
import Button from "../ui/Button.vue";
const props = defineProps({ preferences: { type: Object, required: true }, saving: { type: Boolean, default: false } });
const emit = defineEmits(["save"]);
const densityOptions = [{ value: "comfortable", label: "舒适", hint: "更宽松的间距，适合日常浏览" }, { value: "compact", label: "紧凑", hint: "同一屏展示更多项目和事项" }];
const form = reactive({ ...props.preferences });
const error = ref("");
watch(() => props.preferences, (value) => Object.assign(form, value), { deep: true });
async function submit() {
  error.value = "";
  const result = await new Promise((resolve) => emit("save", { ...form }, resolve));
  if (!result?.ok) error.value = result?.message || "偏好保存失败。";
}
</script>
