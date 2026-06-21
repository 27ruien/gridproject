import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

run("node", ["scripts/check-dev-db-safety.mjs"]);

const status = spawnSync("pnpm", ["--dir", "server", "exec", "prisma", "migrate", "status", "--schema", "../prisma/schema.prisma"], {
  cwd: rootDir,
  stdio: "inherit",
});

if (status.error) {
  console.error(`Migration status check failed: ${status.error.message}`);
  process.exit(1);
}

if (status.status !== 0) {
  console.error("\nMigration status check failed.");
  console.error("If this is the first Dev deployment or the Dev database has no migrations yet, run:");
  console.error("  npm run db:migrate:deploy:dev");
  console.error("  npm run server:prisma:seed");
  console.error("Then run:");
  console.error("  npm run release:check:server");
  process.exit(status.status || 1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: rootDir, stdio: "inherit" });
  if (result.error) {
    console.error(`${command} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
