import { persistPaymentObservation, claimPaymentNotification, finishPaymentNotification, ensurePaymentHealthSchema, PAYMENT_HEALTH_ENVIRONMENT } from "./payment-health-store";
import { getSenderForMarket, sendEmailWithOutcome } from "./email-service";
import type { PaymentObservation } from "./payment-health-policy";

export const PAYMENT_ALERT_RECIPIENT = "info@namarteccl.com";
let flushing: Promise<void> | undefined;

export async function flushPaymentNotifications() {
  if (PAYMENT_HEALTH_ENVIRONMENT !== "production") return;
  if (flushing) return flushing;
  flushing = (async () => {
    for (let i = 0; i < 10; i++) {
      const notification = await claimPaymentNotification();
      if (!notification) return;
      const observation = notification.payload as PaymentObservation;
      const recovered = notification.kind === "recovery";
      const outcome = await sendEmailWithOutcome({
        to: PAYMENT_ALERT_RECIPIENT, from: getSenderForMarket(notification.market),
        subject: `${recovered ? "Revenire" : "Alertă"} plăți xHACCP — ${notification.provider.toUpperCase()} .${notification.market} / ${notification.stage}`,
        text: [
          recovered ? "Operațiunea de plată a funcționat din nou în activitatea reală a aplicației." :
            "Aplicația a detectat o eroare reală în procesarea plăților.",
          `Furnizor: ${notification.provider.toUpperCase()} | Magazin: .${notification.market}`,
          `Etapă: ${notification.stage} | Moment incident: ${new Date(notification.created_at).toISOString()}`,
          `Cod: ${observation.code || "OK"} | HTTP: ${observation.httpStatus || "indisponibil"}`,
          `Tip răspuns: ${observation.responseType || "indisponibil"}`,
          observation.reference ? `Reference furnizor: ${observation.reference}` : "",
          "Consultați Stare plăți în admin. Revenirea unei etape nu confirmă automat întregul checkout.",
          "Verificarea este bazată pe activitatea reală sau verificări manuale; nu sunt efectuate teste zilnice.",
        ].filter(Boolean).join("\n"),
        suppressRecipientLog: true,
        customArgs: { payment_health_notification_id: String(notification.id) },
      });
      await finishPaymentNotification(notification.id, outcome.status === "accepted", notification.attempts);
      if (outcome.status !== "accepted") return;
    }
  })().catch(() => {
    console.error("[Payment Health] Notification delivery failed; durable queue retained");
  }).finally(() => { flushing = undefined; });
  return flushing;
}

export async function observePayment(input: PaymentObservation) {
  try {
    await persistPaymentObservation(input);
    void flushPaymentNotifications();
  } catch {
    console.error("[Payment Health] Could not persist payment observation; checkout logic unchanged");
  }
}

export function startPaymentHealthNotifications() {
  void ensurePaymentHealthSchema().then(flushPaymentNotifications).catch(() => {
    console.error("[Payment Health] Schema initialization failed; will retry on the next observation/admin request");
  });
  // Deliver already-enqueued alerts, not synthetic payment checks.
  const timer = setInterval(() => { void flushPaymentNotifications(); }, 30_000);
  timer.unref();
}
