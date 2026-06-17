const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const stack = [];
let lockCount = 0;
let listening = false;

export function pushOverlay(entry) {
  const overlay = {
    ...entry,
  };
  overlay.lockScroll = entry.lockScroll ?? true;
  overlay.trapFocus = entry.trapFocus ?? true;
  overlay.closeOnEscape = entry.closeOnEscape ?? true;
  overlay.closeOnOutside = entry.closeOnOutside ?? false;
  overlay.restoreFocus = entry.restoreFocus ?? true;

  stack.push(overlay);
  if (overlay.lockScroll) lockBody();
  ensureListeners();
  return overlay.id;
}

export function removeOverlay(id) {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index === -1) return;

  const [overlay] = stack.splice(index, 1);
  if (overlay.lockScroll) unlockBody();
  if (overlay.restoreFocus) overlay.previouslyFocused?.focus?.({ preventScroll: true });
  if (!stack.length) removeListeners();
}

export function isTopOverlay(id) {
  return topOverlay()?.id === id;
}

export function focusOverlay(id) {
  const overlay = stack.find((entry) => entry.id === id);
  if (!overlay || !isTopOverlay(id) || overlay.initialFocus === false) return;

  const panel = overlay.panelRef?.value;
  if (!panel) return;
  const preferred = overlay.initialFocus?.value || panel.querySelector("[data-autofocus]");
  const firstFocusable = preferred || getFocusable(panel)[0];
  (firstFocusable || panel).focus({ preventScroll: true });
}

function topOverlay() {
  return stack[stack.length - 1] || null;
}

function ensureListeners() {
  if (listening || typeof document === "undefined") return;
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  listening = true;
}

function removeListeners() {
  if (!listening || typeof document === "undefined") return;
  document.removeEventListener("keydown", handleKeydown, true);
  document.removeEventListener("pointerdown", handlePointerDown, true);
  listening = false;
}

function handleKeydown(event) {
  const overlay = topOverlay();
  if (!overlay) return;

  if (event.key === "Escape" && overlay.closeOnEscape) {
    event.preventDefault();
    event.stopPropagation();
    overlay.close?.();
    return;
  }

  if (event.key !== "Tab" || !overlay.trapFocus) return;
  trapFocus(event, overlay);
}

function handlePointerDown(event) {
  const overlay = topOverlay();
  if (!overlay?.closeOnOutside) return;

  const panel = overlay.panelRef?.value;
  if (!panel || panel.contains(event.target)) return;
  overlay.close?.();
}

function trapFocus(event, overlay) {
  const panel = overlay.panelRef?.value;
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

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute("disabled") && !element.closest("[inert]") && isVisible(element));
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function lockBody() {
  lockCount += 1;
  document.body.classList.add("modal-locked");
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (!lockCount) document.body.classList.remove("modal-locked");
}
