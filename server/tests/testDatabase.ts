import { PrismaClient } from "../generated/prisma/client.js";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";

export function integrationTestSkipReason() {
  if (!testDatabaseUrl) {
    return "Set TEST_DATABASE_URL to a temporary PostgreSQL database before running backend integration tests.";
  }
  assertSafeTestDatabaseUrl(testDatabaseUrl);
  return false;
}

export function assertSafeTestDatabaseUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL.");
  }
  const port = parsed.port || "5432";
  const databaseName = parsed.pathname.replace(/^\/+/, "");
  if (port === "5433" || url.includes(":5433/")) {
    throw new Error("Refusing to run tests on port 5433.");
  }
  if (["gridproject_dev", "gridproject_prod"].includes(databaseName) || /gridproject_(dev|prod)/.test(url)) {
    throw new Error("Refusing to run tests on gridproject_dev or gridproject_prod.");
  }
}

export function createTestPrisma() {
  assertSafeTestDatabaseUrl(testDatabaseUrl);
  return new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
}

export function testServerConfig() {
  assertSafeTestDatabaseUrl(testDatabaseUrl);
  return {
    databaseUrl: testDatabaseUrl,
    host: "127.0.0.1",
    port: 0,
    nodeEnv: "test",
    sessionSecret: process.env.SESSION_SECRET || "test-session-secret",
    sessionTtlHours: 8,
    cookieSecure: false,
    frontendOrigins: ["http://127.0.0.1:5173"],
    appVersion: process.env.APP_VERSION || "0.1.0-dev.1",
  };
}
