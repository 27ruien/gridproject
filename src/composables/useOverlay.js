import { computed, nextTick, onBeforeUnmount, watch } from "vue";
import { focusOverlay, isTopOverlay, pushOverlay, removeOverlay } from "./overlayManager.js";

export function useOverlay(openRef, panelRef, close, options = {}) {
  let previouslyFocused = null;
  let overlayId = "";

  const isTop = computed(() => Boolean(overlayId && isTopOverlay(overlayId)));

  watch(openRef, async (open) => {
    if (open) {
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      overlayId = options.id || `overlay-${Math.random().toString(36).slice(2)}`;
      pushOverlay({
        id: overlayId,
        panelRef,
        close,
        previouslyFocused,
        initialFocus: options.initialFocus,
        lockScroll: options.lockScroll,
        trapFocus: options.trapFocus,
        closeOnEscape: options.closeOnEscape,
        closeOnOutside: options.closeOnOutside,
        restoreFocus: options.restoreFocus,
      });
      await nextTick();
      focusOverlay(overlayId);
      return;
    }

    removeOverlay(overlayId);
    overlayId = "";
    previouslyFocused = null;
  });

  onBeforeUnmount(() => {
    if (overlayId) removeOverlay(overlayId);
  });

  return { isTop };
}
