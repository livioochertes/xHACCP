const validAdminMarkets = new Set(["ro", "fr", "com"]);

export function normalizeAdminEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  if (
    email.length > 255
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

export function normalizeAdminMarketAssignments(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const markets: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const market = item.trim().toLowerCase();
    if (!validAdminMarkets.has(market)) return null;
    if (!markets.includes(market)) markets.push(market);
  }

  return markets.length ? markets : null;
}

export function getAdminSuspensionError({
  targetId,
  callerId,
  targetMarkets,
  activeSuperAdminCount,
  nextSuspended,
}: {
  targetId: number;
  callerId: number;
  targetMarkets: string[];
  activeSuperAdminCount: number;
  nextSuspended: boolean;
}): "cannot_suspend_self" | "cannot_suspend_last_superadmin" | null {
  if (!nextSuspended) return null;
  if (targetId === callerId) return "cannot_suspend_self";
  if (targetMarkets.length === 0 && activeSuperAdminCount <= 1) {
    return "cannot_suspend_last_superadmin";
  }
  return null;
}