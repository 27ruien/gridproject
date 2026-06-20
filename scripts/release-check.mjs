import { spawnSync } from "node:child_process";

const steps = [
  ["前端 lint", "npm", ["run", "frontend:lint"]],
  ["前端 test", "npm", ["run", "test"]],
  ["前端 build", "npm", ["run", "build"]],
  ["后端 lint", "npm", ["run", "server:lint"]],
  ["后端 test", "npm", ["run", "server:test"]],
  ["后端 build", "npm", ["run", "server:build"]],
  ["Prisma validate", "npm", ["run", "db:validate"]],
  ["Prisma generate", "npm", ["run", "server:prisma:generate"]],
  ["Migration 状态检查", "npm", ["run", "db:migrate:status:safe"]],
  [".env 和 Secret 未被 Git 跟踪", "npm", ["run", "security:check-tracked-secrets"]],
];

for (const [label, command, args] of steps) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) {
    console.error(`${label} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

console.log("\nRelease check passed.");
