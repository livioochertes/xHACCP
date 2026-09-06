import { storage, type AbandonedCartCandidate } from "./storage.js";
import { getSenderForMarket, sendEmail } from "./email-service.js";

const REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;

const MARKET_COPY = {
  ro: {
    domain: "https://xhaccp.ro",
    subject: "Coșul tău te așteaptă la xHACCP",
    greeting: "Salut",
    intro: "Ai adăugat produse în coș, dar comanda nu a fost finalizată.",
    action: "Finalizează comanda",
    summary: "Produsele din coșul tău",
    footer: "Dacă nu ai intenționat să păstrezi aceste produse, poți ignora acest mesaj.",
  },
  fr: {
    domain: "https://xhaccp.fr",
    subject: "Votre panier vous attend chez xHACCP",
    greeting: "Bonjour",
    intro: "Vous avez ajouté des produits à votre panier, mais votre commande n'a pas été finalisée.",
    action: "Finaliser ma commande",
    summary: "Les produits de votre panier",
    footer: "Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer cet email.",
  },
  com: {
    domain: "https://xhaccp.com",
    subject: "Your xHACCP cart is waiting for you",
    greeting: "Hello",
    intro: "You added products to your cart but did not complete your order.",
    action: "Complete your order",
    summary: "Items in your cart",
    footer: "If you did not intend to keep these items, you can ignore this email.",
  },
} as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatItemName(item: AbandonedCartCandidate["items"][number]): string {
  const components = Array.isArray(item.compositeConfiguration?.components)
    ? item.compositeConfiguration.components
    : [];
  if (!components.length) return item.productName;
  return `${item.productName} (${components
    .map((component: any) => `${component.name || `#${component.componentProductId}`} × ${component.quantity}`)
    .join(", ")})`;
}

export function buildAbandonedCartReminderEmail(candidate: AbandonedCartCandidate) {
  const market = candidate.market === "fr" || candidate.market === "com" ? candidate.market : "ro";
  const copy = MARKET_COPY[market];
  const checkoutUrl = `${copy.domain}/checkout?utm_source=abandoned_cart&utm_medium=email`;
  const customerName = candidate.firstName || copy.greeting;
  const total = candidate.items.reduce(
    (sum, item) => sum + Number.parseFloat(item.price || "0") * item.quantity,
    0,
  );
  const currency = candidate.items[0]?.currency || (market === "ro" ? "RON" : "EUR");

  const rowsHtml = candidate.items.slice(0, 25).map(item => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #edf0f2;">${escapeHtml(formatItemName(item))}</td>
      <td style="padding:10px 8px;text-align:center;border-bottom:1px solid #edf0f2;">${item.quantity}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #edf0f2;">${(Number.parseFloat(item.price || "0") * item.quantity).toFixed(2)} ${escapeHtml(currency)}</td>
    </tr>
  `).join("");

  const rowsText = candidate.items.slice(0, 25)
    .map(item => `- ${formatItemName(item)} × ${item.quantity}: ${(Number.parseFloat(item.price || "0") * item.quantity).toFixed(2)} ${currency}`)
    .join("\n");

  return {
    from: getSenderForMarket(market),
    subject: copy.subject,
    checkoutUrl,
    text: `${copy.greeting} ${candidateName(candidate, customerName)},\n\n${copy.intro}\n\n${rowsText}\n\nTotal estimat: ${total.toFixed(2)} ${currency}\n\n${copy.action}: ${checkoutUrl}\n\n${copy.footer}`,
    html: `
      <!doctype html>
      <html lang="${market === "ro" ? "ro" : market}">
        <head><meta charset="utf-8"><title>${escapeHtml(copy.subject)}</title></head>
        <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#243447;">
          <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
            <div style="background:#0f1d33;color:#fff;padding:24px 28px;border-radius:10px 10px 0 0;text-align:center;">
              <div style="font-size:24px;font-weight:700;">xHACCP</div>
              <div style="margin-top:8px;font-size:18px;">${escapeHtml(copy.subject)}</div>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e5eaf0;border-top:0;">
              <p style="margin-top:0;">${escapeHtml(copy.greeting)} ${escapeHtml(customerName)},</p>
              <p>${escapeHtml(copy.intro)}</p>
              <h3 style="margin:24px 0 10px;">${escapeHtml(copy.summary)}</h3>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead>
                  <tr style="background:#f4f7fb;">
                    <th style="padding:10px 8px;text-align:left;">${market === "fr" ? "Produit" : market === "ro" ? "Produs" : "Product"}</th>
                    <th style="padding:10px 8px;text-align:center;">${market === "fr" ? "Qté" : market === "ro" ? "Cant." : "Qty"}</th>
                    <th style="padding:10px 8px;text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              <p style="text-align:right;font-size:17px;font-weight:700;margin:18px 0 24px;">${total.toFixed(2)} ${escapeHtml(currency)}</p>
              <div style="text-align:center;">
                <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 24px;border-radius:6px;font-weight:700;">${escapeHtml(copy.action)}</a>
              </div>
              <p style="font-size:12px;color:#748094;margin:24px 0 0;">${escapeHtml(copy.footer)}</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}

function candidateName(candidate: AbandonedCartCandidate, fallback: string): string {
  return candidate.firstName || candidate.lastName || fallback;
}

export async function sendAbandonedCartReminder(candidate: AbandonedCartCandidate): Promise<boolean> {
  const email = buildAbandonedCartReminderEmail(candidate);
  const sent = await sendEmail({
    to: candidate.email,
    from: email.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (sent) {
    await storage.markAbandonedCartReminderSent(
      candidate.userId,
      candidate.market,
      candidate.cartUpdatedAt,
      candidate.dueThreshold,
    );
  }
  return sent;
}

let reminderRunInProgress = false;

export async function runAbandonedCartReminders(now = new Date()): Promise<{ eligible: number; sent: number }> {
  if (reminderRunInProgress) return { eligible: 0, sent: 0 };
  reminderRunInProgress = true;
  try {
    const candidates = await storage.getAbandonedCartCandidates(now);
    let sent = 0;
    for (const candidate of candidates) {
      try {
        if (await sendAbandonedCartReminder(candidate)) sent++;
      } catch (error) {
        console.error(`[Cart Reminder] Failed for user ${candidate.userId}/${candidate.market}:`, error);
      }
    }
    console.log(`[Cart Reminder] Checked ${candidates.length} eligible threshold(s), sent ${sent}.`);
    return { eligible: candidates.length, sent };
  } finally {
    reminderRunInProgress = false;
  }
}

export function startCartReminderScheduler(): void {
  void runAbandonedCartReminders();
  setInterval(() => {
    void runAbandonedCartReminders();
  }, REMINDER_INTERVAL_MS);
  console.log("[Cart Reminder] Scheduler started — hourly, using market-specific thresholds.");
}