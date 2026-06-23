import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ServerConfig = {
  databaseUrl: string;
  host: string;
  port: number;
  nodeEnv: string;
  sessionSecret: string;
  sessionTtlHours: number;
  cookieSecure: boolean;
  cookieName: string;
  cookiePath: string;
  frontendOrigins: string[];
  appVersion: string;
};

loadDotEnv();

export function getConfig(): ServerConfig {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const nodeEnv = process.env.NODE_ENV || "development";
  const looksLikeProductionDatabase = databaseUrl.includes("127.0.0.1:5433") || databaseUrl.includes("gridproject_prod");
  const looksLikeDevelopmentDatabase = databaseUrl.includes("127.0.0.1:5432") || databaseUrl.includes("gridproject_dev");
  if (nodeEnv !== "production" && looksLikeProductionDatabase) {
    throw new Error("Refusing to start a non-production server with a production database URL");
  }
  if (nodeEnv === "production" && looksLikeDevelopmentDatabase) {
    throw new Error("Refusing to start a production server with a development database URL");
  }

  return {
    databaseUrl,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3000),
    nodeEnv,
    sessionSecret: process.env.SESSION_SECRET || (nodeEnv === "production" ? "" : "dev-only-session-secret-change-me"),
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
    cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : nodeEnv === "production",
    cookieName: process.env.SESSION_COOKIE_NAME || "gridproject_session",
    cookiePath: normalizeCookiePath(process.env.SESSION_COOKIE_PATH || "/"),
    frontendOrigins: parseFrontendOrigins(nodeEnv),
    appVersion: process.env.APP_VERSION || "0.1.0-dev.1",
  };
}

function normalizeCookiePath(value: string) {
  const path = value.trim() || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function parseFrontendOrigins(nodeEnv: string) {
  const configured = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  if (nodeEnv === "production") return [];
  return [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
  ];
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator < 0) return;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (process.env[key] !== undefined) return;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}
