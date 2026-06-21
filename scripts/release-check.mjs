import { spawnSync } from "node:child_process";

const mode = process.argv[2] || "server";

const profiles = {
  ci: [
    ["前端 lint", "npm", ["run", "frontend:lint"]],
    ["前端 test", "npm", ["run", "test"]],
    ["前端 build", "npm", ["run", "build"]],
    ["后端 lint", "npm", ["run", "server:lint"]],
    ["后端 build", "npm", ["run", "server:build"]],
    ["Prisma validate", "npm", ["run", "db:validate"]],
    ["Prisma generate", "npm", ["run", "server:prisma:generate"]],
    ["临时数据库 migrate deploy / 后端集成测试 / Smoke Test", "npm", ["run", "test:integration"]],
    ["部署自动化静态测试", "npm", ["run", "test:deployment"]],
    ["Secret 检查", "npm", ["run", "security:check-tracked-secrets"]],
  ],
  server: [
    ["前端 lint", "npm", ["run", "frontend:lint"]],
    ["前端 test", "npm", ["run", "test"]],
    ["前端 build", "npm", ["run", "build"]],
    ["后端 lint", "npm", ["run", "server:lint"]],
    ["后端 build", "npm", ["run", "server:build"]],
    ["Prisma validate", "npm", ["run", "db:validate"]],
    ["Prisma generate", "npm", ["run", "server:prisma:generate"]],
    ["Migration status", "npm", ["run", "db:migrate:status:safe"]],
    ["Secret 检查", "npm", ["run", "security:check-tracked-secrets"]],
  ],
};

const steps = profiles[mode];
if (!steps) {
  console.error(`Unknown release check mode "${mode}". Use "ci" or "server".`);
  process.exit(1);
}

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

console.log(`\nRelease check (${mode}) passed.`);
