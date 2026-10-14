const ADMIN_ORIGIN_BY_MARKET: Record<string, string> = {
  fr: "https://xhaccp.fr",
  ro: "https://xhaccp.ro",
  com: "https://xhaccp.com",
};

export function buildAdminOrderUrl(orderId: number, market?: string | null): string {
  const normalizedMarket = market?.toLowerCase() || "ro";
  const adminOrigin = ADMIN_ORIGIN_BY_MARKET[normalizedMarket] || ADMIN_ORIGIN_BY_MARKET.ro;
  return `${adminOrigin}/admin?order=${encodeURIComponent(orderId)}`;
}
