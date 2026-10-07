import crypto from "node:crypto";

export function hashPasswordSetupToken(token: unknown): string | null {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null;
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isPasswordSetupTokenUsable(
  record: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): boolean {
  return record.usedAt === null && record.expiresAt > now;
}
