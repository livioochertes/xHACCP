export type PaymentProvider = "viva" | "paypal";
export type PaymentMarket = "ro" | "fr" | "com";
export type PaymentStage = "auth" | "checkout" | "callback" | "webhook";
export type PaymentObservation = {
  provider: PaymentProvider; market: PaymentMarket; stage: PaymentStage;
  status: "ok" | "error"; code?: string; httpStatus?: number;
  responseType?: string; reference?: string;
};

export const PAYMENT_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function sanitizePaymentObservation(input: PaymentObservation): PaymentObservation {
  if (!["viva", "paypal"].includes(input.provider) || !["ro", "fr", "com"].includes(input.market) ||
      !["auth", "checkout", "callback", "webhook"].includes(input.stage) ||
      !["ok", "error"].includes(input.status) || (input.provider === "paypal" && input.market !== "fr")) {
    throw new Error("Invalid payment observation");
  }
  return {
    provider: input.provider, market: input.market, stage: input.stage, status: input.status,
    code: input.status === "error" ? (/^[A-Z0-9_]{1,80}$/.test(input.code || "") ? input.code : "PAYMENT_OPERATION_FAILED") : undefined,
    httpStatus: Number.isInteger(input.httpStatus) && input.httpStatus! >= 100 && input.httpStatus! <= 599 ? input.httpStatus : undefined,
    responseType: ["html", "json", "other"].includes(input.responseType || "") ? input.responseType : undefined,
    reference: /^[a-zA-Z0-9_.-]{1,120}$/.test(input.reference || "") ? input.reference : undefined,
  };
}

export function paymentNotificationDecision(previous: {
  status: string; lastAlertAt: Date | null; incidentAlerted: boolean;
} | undefined, observation: PaymentObservation, now: Date, anotherStageAlerted: boolean) {
  if (observation.status === "ok") {
    return previous?.status === "error" && previous.incidentAlerted ? "recovery" : undefined;
  }
  const isNewIncident = previous?.status !== "error";
  const cooldownPassed = !previous?.lastAlertAt ||
    now.getTime() - previous.lastAlertAt.getTime() >= PAYMENT_ALERT_COOLDOWN_MS;
  return !anotherStageAlerted && (isNewIncident || cooldownPassed) ? "failure" : undefined;
}

export function paymentAlertGuidance(observation: PaymentObservation) {
  if (observation.provider === "viva" && [
    "VIVA_AUTH_EDGE_ACCESS_DENIED",
    "VIVA_CHECKOUT_EDGE_ACCESS_DENIED",
  ].includes(observation.code || "")) {
    return "Posibilă blocare Akamai/Viva în Production: verificați răspunsul 403 HTML, User-Agent-ul xHACCP/1.0 și Reference-ul Viva. Transmiteți Reference-ul și ora UTC către Viva; nu trimiteți secrete sau tokenuri.";
  }
  return undefined;
}
