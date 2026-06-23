import { onBeforeUnmount, ref } from "vue";
import { stripAppBasePath, withAppBasePath } from "../services/appEnvironment.js";

export function useOverlayState() {
  const toastMessage = ref("");
  const personalSettingsSection = ref("");
  const personalSettingsReturnUrl = ref("");
  const confirmDialog = ref({
    open: false,
    title: "",
    message: "",
    confirmText: "确认删除",
    onConfirm: () => {},
  });
  let toastTimer = 0;

  onBeforeUnmount(() => {
    window.clearTimeout(toastTimer);
  });

  function showToast(message) {
    toastMessage.value = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage.value = "";
    }, 2200);
  }

  function requestConfirm(options) {
    confirmDialog.value = {
      open: true,
      title: options.title || "",
      message: options.message || "",
      confirmText: options.confirmText || "确认删除",
      onConfirm: options.onConfirm || (() => {}),
    };
  }

  function closeConfirmDialog() {
    confirmDialog.value = {
      open: false,
      title: "",
      message: "",
      confirmText: "确认删除",
      onConfirm: () => {},
    };
  }

  function openPersonalSettings(section = "profile") {
    const normalized = ["profile", "preferences", "security"].includes(section) ? section : "profile";
    if (!personalSettingsSection.value) personalSettingsReturnUrl.value = `${window.location.pathname}${window.location.search}`;
    personalSettingsSection.value = normalized;
    const path = withAppBasePath(`/settings/${normalized}`);
    if (window.location.pathname !== path) window.history.pushState({ personalSettings: true, returnUrl: personalSettingsReturnUrl.value }, "", path);
  }

  function closePersonalSettings() {
    if (!personalSettingsSection.value) return;
    const returnUrl = personalSettingsReturnUrl.value || withAppBasePath("/?view=dashboard");
    personalSettingsSection.value = "";
    personalSettingsReturnUrl.value = "";
    window.history.replaceState({}, "", returnUrl);
  }

  function syncPersonalSettingsFromPath(pathname = window.location.pathname, historyState = window.history.state) {
    const settingsMatch = stripAppBasePath(pathname).match(/^\/settings\/(profile|preferences|security)$/);
    if (settingsMatch) {
      if (!personalSettingsSection.value && !personalSettingsReturnUrl.value) personalSettingsReturnUrl.value = historyState?.returnUrl || withAppBasePath("/?view=dashboard");
      personalSettingsSection.value = settingsMatch[1];
      return true;
    }
    personalSettingsSection.value = "";
    return false;
  }

  return {
    toastMessage,
    confirmDialog,
    personalSettingsSection,
    personalSettingsReturnUrl,
    showToast,
    requestConfirm,
    closeConfirmDialog,
    openPersonalSettings,
    closePersonalSettings,
    syncPersonalSettingsFromPath,
  };
}
