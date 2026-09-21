import type { Order } from "@shared/schema";

const DEFAULT_PUBLIC_APP_URL = "https://xhaccp.fr";

export function getPublicAppUrl(): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (process.env.NODE_ENV !== "production" && devDomain) return `https://${devDomain}`;

  return DEFAULT_PUBLIC_APP_URL;
}

export function buildPublicTrackingUrl(publicOrderRef: string | null | undefined): string | null {
  if (!publicOrderRef) return null;
  return `${getPublicAppUrl()}/tracking/${encodeURIComponent(publicOrderRef)}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function trackingOrderLabel(order: Pick<Order, "publicOrderRef">): string {
  return order.publicOrderRef || "commande";
}