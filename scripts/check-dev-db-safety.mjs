import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(resolve(process.cwd(), "server/.env"));
loadEnvFile(resolve(process.cwd(), ".env"));

const databaseUrl = process.env.DATABASE_URL || "";
const nodeEnv = process.env.NODE_ENV || "development";
const allowCiDatabase = process.env.ALLOW_CI_DATABASE_URL === "true";

if (!databaseUrl) {
  fail("DATABASE_URL is required for Dev release checks.");
}

if (nodeEnv === "production") {
  fail("NODE_ENV=production is not allowed for Dev release database checks.");
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL.");
}

const host = parsed.hostname;
const port = parsed.port || "5432";
const databaseName = parsed.pathname.replace(/^\/+/, "");

if (databaseName === "gridproject_prod" || databaseUrl.includes("gridproject_prod")) {
  fail("Refusing to use a production database name.");
}

if (port === "5433" || databaseUrl.includes(":5433/")) {
  fail("Refusing to use the production database port 5433.");
}

const isDevDatabase = host === "127.0.0.1" && port === "5432" && databaseName === "gridproject_dev";
const isCiDatabase = allowCiDatabase && host === "127.0.0.1" && port === "5432" && databaseName === "gridproject_ci";

if (!isDevDatabase && !isCiDatabase) {
  fail("Dev release database checks require 127.0.0.1:5432/gridproject_dev. CI may use gridproject_ci only with ALLOW_CI_DATABASE_URL=true.");
}

console.log(`Database safety check passed for ${host}:${port}/${databaseName} with NODE_ENV=${nodeEnv}.`);

function fail(message) {
  console.error(`Database safety check failed: ${message}`);
  process.exit(1);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}
