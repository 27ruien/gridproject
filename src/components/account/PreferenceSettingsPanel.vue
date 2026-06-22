<template>
  <form class="settings-panel-form" @submit.prevent="submit">
    <header><h2>偏好设置</h2><p>这些设置会应用到当前账号的工作界面。</p></header>
    <fieldset><legend>界面密度</legend><div class="settings-choice-grid"><label v-for="item in densityOptions" :key="item.value" :class="{ selected: form.density === item.value }"><input v-model="form.density" type="radio" name="density" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span></label></div></fieldset>
    <div class="settings-field-grid">
      <SelectField v-model="form.dateFormat" label="日期格式" :options="dateFormatOptions" />
      <SelectField v-model="form.weekStart" label="每周起始日" :options="weekStartOptions" />
      <SelectField v-model="form.defaultNav" label="默认导航状态" :options="navigationOptions" />
      <SelectField v-model="form.homeDueRange" label="主页待关注事项默认范围" :options="dueRangeOptions" />
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <footer><Button variant="primary" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存偏好" }}</Button></footer>
  </form>
</template>
<script setup>
import { reactive, ref, watch } from "vue";
import Button from "../ui/Button.vue";
import SelectField from "../ui/SelectField.vue";
const props = defineProps({ preferences: { type: Object, required: true }, saving: { type: Boolean, default: false } });
const emit = defineEmits(["save"]);
const densityOptions = [{ value: "comfortable", label: "舒适", hint: "更宽松的间距，适合日常浏览" }, { value: "compact", label: "紧凑", hint: "同一屏展示更多项目和事项" }];
const dateFormatOptions = [{ value: "yyyy-mm-dd", label: "2026-06-22" }, { value: "mm-dd-yyyy", label: "06-22-2026" }, { value: "dd-mm-yyyy", label: "22-06-2026" }];
const weekStartOptions = [{ value: "monday", label: "周一" }, { value: "sunday", label: "周日" }];
const navigationOptions = [{ value: "expanded", label: "展开" }, { value: "collapsed", label: "收起" }, { value: "auto", label: "跟随窗口宽度" }];
const dueRangeOptions = [{ value: "all", label: "全部" }, { value: "mine", label: "我的" }, { value: "others", label: "其他成员" }];
const form = reactive({ ...props.preferences });
const error = ref("");
watch(() => props.preferences, (value) => Object.assign(form, value), { deep: true });
async function submit() {
  error.value = "";
  const result = await new Promise((resolve) => emit("save", { ...form }, resolve));
  if (!result?.ok) error.value = result?.message || "偏好保存失败。";
}
</script>
