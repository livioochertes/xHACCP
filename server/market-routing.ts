import type { Request } from "express";

export type Market = "ro" | "fr" | "com";

const KNOWN_MARKETS = new Set<Market>(["ro", "fr", "com"]);

function getFirstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getMarketFromHost(host?: string): Market | undefined {
  const hostname = (host || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "")
    .split(":")[0];

  if (hostname === "xhaccp.fr" || hostname.endsWith(".xhaccp.fr")) return "fr";
  if (hostname === "xhaccp.ro" || hostname.endsWith(".xhaccp.ro")) return "ro";
  if (hostname === "xhaccp.com" || hostname.endsWith(".xhaccp.com")) return "com";
  return undefined;
}

/**
 * Uses a recognized canonical domain as the source of truth. Market request
 * overrides are supported only when no canonical xHACCP domain is present,
 * such as local development and isolated test environments.
 */
export function getMarketFromRequest(req: Request): Market {
  const forwardedHost = getFirstHeaderValue(req.headers["x-forwarded-host"]);
  const hostMarket = getMarketFromHost(forwardedHost || req.get("host") || undefined);
  if (hostMarket) return hostMarket;

  const queryMarket = typeof req.query?.market === "string"
    ? req.query.market.toLowerCase()
    : undefined;
  if (queryMarket && KNOWN_MARKETS.has(queryMarket as Market)) return queryMarket as Market;

  const headerMarket = getFirstHeaderValue(req.headers["x-market"])?.toLowerCase();
  if (headerMarket && KNOWN_MARKETS.has(headerMarket as Market)) return headerMarket as Market;

  return "ro";
}

/**
 * Legacy rows without a market belong to the Romanian storefront. Keeping
 * this normalization in one place prevents customer-facing scope checks from
 * accidentally treating NULL as a wildcard.
 */
export function marketMatches(
  recordMarket: string | null | undefined,
  currentMarket: Market,
): boolean {
  return (recordMarket ?? "ro") === currentMarket;
}