import { PrismaClient } from "../generated/prisma/client.js";
import { getConfig } from "./config/env.js";
import { hashPassword, validatePassword } from "./utils/password.js";

const config = getConfig();

if (config.nodeEnv === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error("Refusing to seed in production without ALLOW_PRODUCTION_SEED=true");
}

const adminEmail = requiredEnv("ADMIN_EMAIL").trim().toLowerCase();
const adminPassword = requiredEnv("ADMIN_PASSWORD");
const adminDisplayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "GridProject Admin";
const organizationName = requiredEnv("INITIAL_ORGANIZATION_NAME").trim();

const passwordErrors = validatePassword(adminPassword);
if (passwordErrors.length) throw new Error(passwordErrors.join(""));

const prisma = new PrismaClient();

try {
  const passwordHash = await hashPassword(adminPassword);
  const organization = await prisma.organization.upsert({
    where: { id: process.env.INITIAL_ORGANIZATION_ID || "org-default" },
    create: {
      id: process.env.INITIAL_ORGANIZATION_ID || "org-default",
      name: organizationName,
    },
    update: {
      name: organizationName,
    },
  });

  const user = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: adminEmail,
      },
    },
    create: {
      organizationId: organization.id,
      name: adminDisplayName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    update: {
      name: adminDisplayName,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      deletedAt: null,
      deletedById: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: user.id,
      action: "system.seed_admin",
      entityType: "User",
      entityId: user.id,
      data: { email: adminEmail, organizationName },
    },
  });

  console.log(`Seed complete for organization ${organization.id} and admin ${adminEmail}`);
} finally {
  await prisma.$disconnect();
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
