import assert from "node:assert/strict";
import test from "node:test";
import { PasswordFailureLimiter, passwordFailureBucketKey } from "../src/security/passwordFailureLimiter.js";

test("password failure limiter blocks the sixth attempt and restores after the window", () => {
  const limiter = new PasswordFailureLimiter({ maxFailures: 5, windowMs: 1_000 });
  const key = passwordFailureBucketKey("user-a", "127.0.0.1");

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    assert.equal(limiter.isBlocked(key, 100), false);
    assert.equal(limiter.recordFailure(key, 100).count, attempt);
  }
  assert.equal(limiter.isBlocked(key, 999), true);
  assert.equal(limiter.isBlocked(key, 1_100), false);
});

test("password failure limiter clears on success and isolates user buckets", () => {
  const limiter = new PasswordFailureLimiter({ maxFailures: 5, windowMs: 1_000 });
  const first = passwordFailureBucketKey("user-a", "127.0.0.1");
  const second = passwordFailureBucketKey("user-b", "127.0.0.1");

  for (let attempt = 0; attempt < 4; attempt += 1) limiter.recordFailure(first, 100);
  limiter.clear(first);
  assert.equal(limiter.recordFailure(first, 200).count, 1);

  for (let attempt = 0; attempt < 4; attempt += 1) limiter.recordFailure(first, 200);
  assert.equal(limiter.isBlocked(first, 300), true);
  assert.equal(limiter.isBlocked(second, 300), false);
});
