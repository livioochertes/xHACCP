import { hasAnalyticsConsent } from "./cookie-consent";

type AnalyticsData = Record<string, string | number | boolean>;

export type PaymentStatus = "success" | "failed" | "unavailable";

export function getPaymentStatus(paymentResult: string | null): PaymentStatus {
  if (paymentResult === "success" || paymentResult === "cash" || paymentResult === "paypal") {
    return "success";
  }

  if (paymentResult === "failed" || paymentResult === "error") {
    return "failed";
  }

  return "unavailable";
}

export function getPaymentEventName(paymentResult: string | null): "purchase_completed" | "payment_failed" | null {
  const paymentStatus = getPaymentStatus(paymentResult);
  if (paymentStatus === "success") return "purchase_completed";
  if (paymentStatus === "failed") return "payment_failed";
  return null;
}

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the customer journey.
  }
}