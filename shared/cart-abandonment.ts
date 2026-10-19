export const CART_MONITORING_CONSENT_VERSION = "v1";
export const CART_MONITORING_CONSENT_COOKIE = "xhaccp_cookie_consent";
export const CART_MONITORING_ID_COOKIE = "xhaccp_cart_monitoring_id";
export const CART_MONITORING_CONSENT_STORAGE_KEY = "xhaccp-cookie-consent";
export const CART_MONITORING_RETENTION_DAYS = 90;
export const CART_ABANDONMENT_DELAY_MS = 60 * 60 * 1000;

export interface CartAbandonmentLine {
  productId: number;
  quantity: number;
  components?: Array<{ componentProductId: number; quantity: number }>;
}

export function isCartMonitoringConsentCookie(value: string | null | undefined): boolean {
  return value === `${CART_MONITORING_CONSENT_VERSION}:analytics:1:cart:1` ||
    value === `${CART_MONITORING_CONSENT_VERSION}:analytics:0:cart:1`;
}

export function isValidCartMonitoringId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeCartAbandonmentItems(value: unknown): CartAbandonmentLine[] | null {
  if (!Array.isArray(value) || value.length > 80) return null;
  const normalized: CartAbandonmentLine[] = [];
  for (const item of value) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(productId) || productId <= 0 ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) {
      return null;
    }
    const componentsValue = item?.compositeConfiguration?.components;
    let components: CartAbandonmentLine["components"];
    if (componentsValue !== undefined && componentsValue !== null) {
      if (!Array.isArray(componentsValue) || componentsValue.length > 80) return null;
      components = [];
      for (const component of componentsValue) {
        const componentProductId = Number(component?.componentProductId);
        const componentQuantity = Number(component?.quantity);
        if (!Number.isSafeInteger(componentProductId) || componentProductId <= 0 ||
            !Number.isSafeInteger(componentQuantity) || componentQuantity < 1 || componentQuantity > 9999) {
          return null;
        }
        components.push({ componentProductId, quantity: componentQuantity });
      }
    }
    normalized.push({ productId, quantity, ...(components ? { components } : {}) });
  }
  return normalized;
}

export function isCartAbandoned(lastActivityAt: Date, now = new Date()): boolean {
  return now.getTime() - lastActivityAt.getTime() >= CART_ABANDONMENT_DELAY_MS;
}
