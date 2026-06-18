import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "../generated/prisma/client.js";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/utils/password.js";

const databaseUrl = process.env.DATABASE_URL || "";
const canRun = Boolean(databaseUrl) && !databaseUrl.includes("127.0.0.1:5433") && !databaseUrl.includes("gridproject_prod");

test("auth login creates an HttpOnly session and me returns the user", { skip: !canRun }, async () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const organization = await prisma.organization.create({
    data: { id: `test-org-${suffix}`, name: `Test Org ${suffix}` },
  });
  const password = `StrongPass${suffix}9`;
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Test Admin",
      email: `admin-${suffix}@gridproject.test`,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const app = await buildApp({
    databaseUrl,
    host: "127.0.0.1",
    port: 0,
    nodeEnv: "test",
    sessionSecret: process.env.SESSION_SECRET || "test-session-secret",
    sessionTtlHours: 8,
    cookieSecure: false,
  });

  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password },
    });
    assert.equal(login.statusCode, 200);
    assert.match(String(login.headers["set-cookie"]), /HttpOnly/);
    assert.match(String(login.headers["set-cookie"]), /SameSite=Lax/i);
    assert.equal(login.json().user.email, user.email);
    assert.equal(login.json().user.passwordHash, undefined);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: String(login.headers["set-cookie"]) },
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.id, user.id);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});

test("auth login rejects bad passwords without setting a session", { skip: !canRun }, async () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const organization = await prisma.organization.create({
    data: { id: `test-org-bad-${suffix}`, name: `Test Org Bad ${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Test Admin",
      email: `bad-${suffix}@gridproject.test`,
      passwordHash: await hashPassword(`StrongPass${suffix}9`),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const app = await buildApp({
    databaseUrl,
    host: "127.0.0.1",
    port: 0,
    nodeEnv: "test",
    sessionSecret: process.env.SESSION_SECRET || "test-session-secret",
    sessionTtlHours: 8,
    cookieSecure: false,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password: "wrong-password" },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});
