import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function normalizeBasePath(value: string | undefined) {
  const appPath = String(value || "/").trim() || "/";
  const withLeadingSlash = appPath.startsWith("/") ? appPath : `/${appPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_APP_BASE_PATH),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
});
