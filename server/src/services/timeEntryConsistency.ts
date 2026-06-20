import { createHash } from "node:crypto";
import { badRequest } from "../utils/errors.js";

type DailyTimeEntryKey = {
  organizationId: string;
  userId: string;
  workDate: Date | string;
};

export async function withDailyTimeEntryLock<T>(
  prisma: any,
  key: DailyTimeEntryKey,
  callback: (tx: any) => Promise<T>,
) {
  return prisma.$transaction(async (tx: any) => {
    await acquireDailyTimeEntryLock(tx, key);
    return callback(tx);
  });
}

export async function acquireDailyTimeEntryLock(tx: any, key: DailyTimeEntryKey) {
  const lockKey = advisoryLockKey(key);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
}

export async function assertDailyHoursLimit(
  tx: any,
  key: DailyTimeEntryKey,
  nextHours: number,
  excludeId?: string,
) {
  if (nextHours <= 0 || nextHours > 24) throw badRequest("hours 必须大于 0 且不超过 24。");
  const aggregate = await tx.timeEntry.aggregate({
    where: {
      organizationId: key.organizationId,
      userId: key.userId,
      workDate: normalizeDateOnly(key.workDate),
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    _sum: { hours: true },
  });
  const currentHours = Number(aggregate._sum.hours || 0);
  if (currentHours + nextHours > 24) throw badRequest("同一用户同一日期的有效工时合计不能超过 24 小时。");
}

function advisoryLockKey(key: DailyTimeEntryKey) {
  const digest = createHash("sha256")
    .update(`${key.organizationId}:${key.userId}:${normalizeDateKey(key.workDate)}`)
    .digest();
  return digest.readBigInt64BE(0);
}

function normalizeDateOnly(value: Date | string) {
  if (value instanceof Date) return value;
  return new Date(`${normalizeDateKey(value)}T00:00:00.000Z`);
}

function normalizeDateKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
