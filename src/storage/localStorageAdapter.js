import { createStorageAdapter } from "./storageAdapter.js";

export const localStorageAdapter = createStorageAdapter({
  read(key) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  write(key, value) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  remove(key) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
});
