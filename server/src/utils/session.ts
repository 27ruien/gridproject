import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gridproject_session";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, secret: string) {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionExpiry(ttlHours: number) {
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}
