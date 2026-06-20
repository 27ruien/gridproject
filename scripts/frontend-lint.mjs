import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "tests"];
const files = [];

for (const root of roots) {
  collectJavaScript(root);
}

for (const file of ["vite.config.js", "playwright.config.js"]) {
  files.push(file);
}

if (!files.length) {
  console.log("No frontend JavaScript files found.");
  process.exit(0);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Frontend lint passed for ${files.length} JavaScript files.`);

function collectJavaScript(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectJavaScript(fullPath);
      continue;
    }
    if (/\.(js|mjs)$/.test(entry)) {
      files.push(relative(process.cwd(), fullPath));
    }
  }
}
