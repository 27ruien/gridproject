import { nextTick, onBeforeUnmount, watch } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let lockCount = 0;

export function useOverlay(openRef, panelRef, close, options = {}) {
  let previouslyFocused = null;

  function lockBody() {
    lockCount += 1;
    document.body.classList.add("modal-locked");
  }

  function unlockBody() {
    lockCount = Math.max(0, lockCount - 1);
    if (!lockCount) document.body.classList.remove("modal-locked");
  }

  function focusInitial() {
    const panel = panelRef.value;
    if (!panel) return;
    const preferred = options.initialFocus?.value || panel.querySelector("[data-autofocus]");
    const firstFocusable = preferred || getFocusable(panel)[0];
    (firstFocusable || panel).focus({ preventScroll: true });
  }

  function handleKeydown(event) {
    if (!openRef.value) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close?.();
      return;
    }
    if (event.key !== "Tab") return;

    const panel = panelRef.value;
    if (!panel) return;
    const focusable = getFocusable(panel);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(openRef, async (open) => {
    if (open) {
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      lockBody();
      document.addEventListener("keydown", handleKeydown, true);
      await nextTick();
      focusInitial();
      return;
    }

    document.removeEventListener("keydown", handleKeydown, true);
    unlockBody();
    if (options.restoreFocus !== false) previouslyFocused?.focus?.({ preventScroll: true });
    previouslyFocused = null;
  });

  onBeforeUnmount(() => {
    if (openRef.value) unlockBody();
    document.removeEventListener("keydown", handleKeydown, true);
  });
}

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute("disabled") && !element.closest("[inert]") && isVisible(element));
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}
