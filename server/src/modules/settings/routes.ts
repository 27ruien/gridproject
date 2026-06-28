import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../policies/access.js";
import { forbidden, validationError } from "../../utils/errors.js";
import { toJsonObject } from "../../utils/dto.js";

const settingsSchema = z.object({
  platformName: z.string().min(1).max(80).optional(),
  logoText: z.string().min(1).max(2).optional(),
  logoUrl: z.string().max(200000).optional(),
}).strict();

const DEFAULT_SETTINGS = {
  platformName: "GridProject",
  logoText: "G",
  logoUrl: "",
};

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const context = requireAuth(request);
    const organization = await app.prisma.organization.findUniqueOrThrow({ where: { id: context.organizationId } });
    return { requestId: request.id, settings: normalizeSettings(organization.settings) };
  });

  app.patch("/", async (request) => {
    const context = requireAuth(request);
    if (!requireAdmin(context)) throw forbidden("没有权限修改平台设置。");
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("设置参数不正确。", parsed.error.flatten());
    const organization = await app.prisma.organization.findUniqueOrThrow({ where: { id: context.organizationId } });
    const settings = {
      ...normalizeSettings(organization.settings),
      ...parsed.data,
      logoText: (parsed.data.logoText || normalizeSettings(organization.settings).logoText).slice(0, 2),
      logoUrl: parsed.data.logoUrl !== undefined ? parsed.data.logoUrl : normalizeSettings(organization.settings).logoUrl,
    };
    const updated = await app.prisma.organization.update({
      where: { id: context.organizationId },
      data: { settings },
    });
    await app.prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "settings.update",
        entityType: "Organization",
        entityId: context.organizationId,
        data: parsed.data as any,
        requestId: request.id,
      },
    });
    return { requestId: request.id, settings: normalizeSettings(updated.settings) };
  });
}

export function normalizeSettings(value: unknown) {
  const settings = toJsonObject(value as any);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    platformName: String(settings.platformName || DEFAULT_SETTINGS.platformName),
    logoText: String(settings.logoText || DEFAULT_SETTINGS.logoText).slice(0, 2),
    logoUrl: String(settings.logoUrl || ""),
  };
}
