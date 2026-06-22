export type PasswordFailureState = {
  count: number;
  firstFailedAt: number;
  blockedUntil: number;
};

type PasswordFailureLimiterOptions = {
  maxFailures?: number;
  windowMs?: number;
};

export class PasswordFailureLimiter {
  private readonly buckets = new Map<string, PasswordFailureState>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(options: PasswordFailureLimiterOptions = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
  }

  isBlocked(key: string, now = Date.now()) {
    const state = this.getActiveState(key, now);
    return Boolean(state && state.count >= this.maxFailures);
  }

  recordFailure(key: string, now = Date.now()) {
    const current = this.getActiveState(key, now);
    const next = current
      ? { ...current, count: current.count + 1 }
      : { count: 1, firstFailedAt: now, blockedUntil: now + this.windowMs };
    this.buckets.set(key, next);
    return { ...next, blocked: next.count >= this.maxFailures };
  }

  clear(key: string) {
    this.buckets.delete(key);
  }

  private getActiveState(key: string, now: number) {
    const state = this.buckets.get(key);
    if (!state) return null;
    if (state.blockedUntil <= now) {
      this.buckets.delete(key);
      return null;
    }
    return state;
  }
}

export function passwordFailureBucketKey(userId: string, ip: string) {
  return `${userId}:${ip || "unknown"}`;
}
