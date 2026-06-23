import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

function normalizeBasePath(value) {
  const path = String(value || "/").trim() || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_APP_BASE_PATH),
  plugins: [vue()],
});
