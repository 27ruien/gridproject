export function sanitizeUser<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function escapeExcelText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
