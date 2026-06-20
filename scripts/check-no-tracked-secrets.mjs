import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const blockedPaths = [];
const blockedPatterns = [
  { name: "GitHub token", pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/ },
  { name: "OpenAI token", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS secret", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

for (const file of trackedFiles) {
  const name = basename(file);
  const extension = extname(file);
  const isEnvFile = name === ".env" || (name.startsWith(".env.") && !name.endsWith(".example"));
  const isSecretKeyFile = [".pem", ".key", ".p12", ".pfx"].includes(extension);
  if (isEnvFile || isSecretKeyFile) {
    blockedPaths.push(file);
    continue;
  }

  if (!existsSync(file) || statSync(file).size > 1024 * 1024) continue;
  const content = readFileSync(file, "utf8");
  for (const blocked of blockedPatterns) {
    if (blocked.pattern.test(content)) {
      blockedPaths.push(`${file} (${blocked.name})`);
      break;
    }
  }
}

if (blockedPaths.length) {
  console.error("Tracked secret check failed:");
  for (const file of blockedPaths) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Tracked secret check passed.");
