import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL || "";
const dbName = `gridproject_test_${Date.now()}_${randomBytes(4).toString("hex")}`;

if (!adminUrl) {
  fail("TEST_DATABASE_ADMIN_URL is required. Point it at a temporary PostgreSQL service admin database, not gridproject_dev or gridproject_prod.");
}

assertSafeAdminUrl(adminUrl);
assertSafeTestDatabaseName(dbName);

const testUrl = databaseUrlForName(adminUrl, dbName);
let created = false;
let exitCode = 0;

try {
  await withAdminClient(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    created = true;
  });

  const seedEmail = process.env.ADMIN_EMAIL || `admin-${dbName}@example.test`;
  const seedPassword = process.env.ADMIN_PASSWORD || `TestAdmin${Date.now()}9`;
  const commonEnv = {
    ...process.env,
    NODE_ENV: "test",
    APP_VERSION: process.env.APP_VERSION || "0.1.0-dev.1",
    SESSION_SECRET: process.env.SESSION_SECRET || "test-integration-session-secret",
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
    ADMIN_EMAIL: seedEmail,
    ADMIN_PASSWORD: seedPassword,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME || "Integration Test Admin",
    INITIAL_ORGANIZATION_NAME: process.env.INITIAL_ORGANIZATION_NAME || "GridProject Integration Test",
  };

  console.log(`Created temporary test database ${dbName}.`);
  run("server/node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    ...commonEnv,
    DATABASE_URL: testUrl,
  });

  run("node_modules/.bin/tsx", ["src/seed.ts"], {
    ...commonEnv,
    DATABASE_URL: testUrl,
  }, "server");
  run("node_modules/.bin/tsx", ["src/seed.ts"], {
    ...commonEnv,
    DATABASE_URL: testUrl,
  }, "server");

  const testEnv = {
    ...commonEnv,
    TEST_DATABASE_URL: testUrl,
  };
  delete testEnv.DATABASE_URL;
  run("node_modules/.bin/tsx", ["--test", ...testFiles()], testEnv, "server");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  if (created) {
    await dropDatabase(dbName);
  }
  process.exit(exitCode);
}

async function withAdminClient(callback) {
  let PrismaClient;
  try {
    ({ PrismaClient } = await import("../server/generated/prisma/client.js"));
  } catch (error) {
    throw new Error(`Prisma client is not generated. Run npm run server:prisma:generate first. ${error instanceof Error ? error.message : ""}`);
  }
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    return await callback(admin);
  } finally {
    await admin.$disconnect();
  }
}

async function dropDatabase(databaseName) {
  await withAdminClient(async (admin) => {
    await admin.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
  });
  console.log(`Dropped temporary test database ${databaseName}.`);
}

function run(command, args, env, cwd = ".") {
  const result = spawnSync(command, args, {
    cwd: resolve(rootDir, cwd),
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw new Error(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status || 1}.`);
  }
}

function testFiles() {
  return readdirSync(resolve(rootDir, "server/tests"))
    .filter((file) => file.endsWith(".test.ts"))
    .sort()
    .map((file) => `tests/${file}`);
}

function databaseUrlForName(url, databaseName) {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function assertSafeAdminUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("TEST_DATABASE_ADMIN_URL is not a valid URL.");
  }
  const port = parsed.port || "5432";
  const databaseName = parsed.pathname.replace(/^\/+/, "");
  if (port === "5433" || url.includes(":5433/")) {
    fail("Refusing to create test databases through port 5433.");
  }
  if (["gridproject_dev", "gridproject_prod"].includes(databaseName) || /gridproject_(dev|prod)/.test(url)) {
    fail("Refusing to use gridproject_dev or gridproject_prod as TEST_DATABASE_ADMIN_URL.");
  }
}

function assertSafeTestDatabaseName(databaseName) {
  if (!/^gridproject_test_[0-9]+_[a-f0-9]{8}$/.test(databaseName)) {
    fail(`Unsafe temporary database name: ${databaseName}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
