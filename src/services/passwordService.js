import { argon2id } from "hash-wasm";

const ARGON2_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 4096,
  hashLength: 32,
  outputType: "encoded",
};

export function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 10) errors.push("密码不少于 10 位。");
  if (!/[A-Za-z]/.test(password || "") || !/\d/.test(password || "")) errors.push("密码至少包含字母和数字。");
  return errors;
}

export async function hashPasswordArgon2id(password) {
  const salt = randomSalt();
  return argon2id({
    password,
    salt,
    ...ARGON2_OPTIONS,
  });
}

export function isPasswordHash(value) {
  return typeof value === "string" && value.startsWith("$argon2id$");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
