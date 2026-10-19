import {
  CART_MONITORING_CONSENT_COOKIE,
  CART_MONITORING_CONSENT_STORAGE_KEY,
  CART_MONITORING_CONSENT_VERSION,
  CART_MONITORING_ID_COOKIE,
  CART_MONITORING_RETENTION_DAYS,
  isValidCartMonitoringId,
} from "@shared/cart-abandonment";

export interface CookiePreferences {
  analytics: boolean;
  cartMonitoring: boolean;
}

const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const CART_ID_MAX_AGE_SECONDS = CART_MONITORING_RETENTION_DAYS * 24 * 60 * 60;
export const COOKIE_CONSENT_CHANGED_EVENT = "xhaccp-cookie-consent-changed";

function cookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function readCookiePreferences(): CookiePreferences | null {
  const value = cookieValue(CART_MONITORING_CONSENT_COOKIE);
  if (!value) return null;
  const match = value.match(/^v1:analytics:([01]):cart:([01])$/);
  if (!match || CART_MONITORING_CONSENT_VERSION !== "v1") return null;
  return { analytics: match[1] === "1", cartMonitoring: match[2] === "1" };
}

export function hasAnalyticsConsent(): boolean {
  return readCookiePreferences()?.analytics === true;
}

function isFrenchStorefront(): boolean {
  const hostname = window.location.hostname;
  return hostname === "xhaccp.fr" || hostname.endsWith(".xhaccp.fr");
}

function clearKnownGoogleAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const names = document.cookie.split(";")
    .map(value => value.trim().split("=")[0])
    .filter(name => /^(_ga|_gid|_gat|_gcl_)/.test(name));
  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${name}=; Domain=.xhaccp.fr; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

function syncGoogleTagManager(analyticsAllowed: boolean): void {
  if (typeof window === "undefined" || !isFrenchStorefront()) return;
  const consentState = {
    analytics_storage: analyticsAllowed ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };

  const win = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  win.dataLayer = win.dataLayer || [];
  win.gtag = win.gtag || function (...args: unknown[]) {
    win.dataLayer?.push(args);
  };

  if (!analyticsAllowed) {
    win.gtag("consent", "update", consentState);
    document.getElementById("xhaccp-consented-gtm")?.remove();
    clearKnownGoogleAnalyticsCookies();
    return;
  }

  if (document.getElementById("xhaccp-consented-gtm")) return;
  win.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  win.gtag("consent", "update", consentState);
  win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.id = "xhaccp-consented-gtm";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-5WC2V3BF";
  document.head.appendChild(script);
}

export function getOrCreateCartMonitoringId(): string | null {
  if (readCookiePreferences()?.cartMonitoring !== true || typeof window === "undefined") return null;
  const existing = cookieValue(CART_MONITORING_ID_COOKIE);
  if (isValidCartMonitoringId(existing)) return existing;
  if (!window.crypto?.randomUUID) return null;
  const id = window.crypto.randomUUID();
  writeCookie(CART_MONITORING_ID_COOKIE, id, CART_ID_MAX_AGE_SECONDS);
  return id;
}

function clearCartMonitoringId(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CART_MONITORING_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export async function saveCookiePreferences(preferences: CookiePreferences): Promise<boolean> {
  const previous = readCookiePreferences();
  const next = {
    analytics: Boolean(preferences.analytics),
    cartMonitoring: Boolean(preferences.cartMonitoring),
  };

  if (previous?.cartMonitoring && !next.cartMonitoring) {
    try {
      await fetch("/api/cart-monitoring", { method: "DELETE", credentials: "same-origin" });
    } finally {
      clearCartMonitoringId();
    }
  }

  const consentValue = `${CART_MONITORING_CONSENT_VERSION}:analytics:${next.analytics ? "1" : "0"}:cart:${next.cartMonitoring ? "1" : "0"}`;
  writeCookie(CART_MONITORING_CONSENT_COOKIE, consentValue, CONSENT_MAX_AGE_SECONDS);
  try {
    localStorage.setItem(CART_MONITORING_CONSENT_STORAGE_KEY, consentValue);
  } catch {
    // The first-party cookie remains the source of truth when local storage is unavailable.
  }

  syncGoogleTagManager(next.analytics);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: next }));
  return Boolean(previous?.analytics && !next.analytics);
}

export async function removeCartMonitoringData(): Promise<void> {
  try {
    await fetch("/api/cart-monitoring", { method: "DELETE", credentials: "same-origin" });
  } finally {
    clearCartMonitoringId();
  }
}

export function applyStoredCookiePreferences(): void {
  const preferences = readCookiePreferences();
  syncGoogleTagManager(preferences?.analytics === true);
}
