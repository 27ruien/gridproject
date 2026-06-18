import { randomBytes } from "node:crypto";
import { argon2Verify, argon2id } from "hash-wasm";

const ARGON2_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 4096,
  hashLength: 32,
  outputType: "encoded" as const,
};

export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 10) errors.push("密码不少于 10 位。");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.push("密码至少包含字母和数字。");
  return errors;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    ...ARGON2_OPTIONS,
  });
}

export async function verifyPassword(password: string, hash: string) {
  if (!hash.startsWith("$argon2id$")) return false;
  return argon2Verify({ password, hash });
}
