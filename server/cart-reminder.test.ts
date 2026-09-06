import assert from "node:assert/strict";
import test from "node:test";
import { buildAbandonedCartReminderEmail } from "./cart-reminder";

const baseCandidate = {
  userId: 42,
  email: "client@example.com",
  firstName: "Ana",
  lastName: "Client",
  market: "fr",
  cartUpdatedAt: new Date("2026-09-05T08:00:00.000Z"),
  items: [{
    id: 1,
    productId: 101,
    quantity: 2,
    compositeConfiguration: null,
    productName: "Nettoyant <Premium>",
    price: "12.50",
    currency: "EUR",
  }],
} as const;

test("builds a French reminder with the French checkout URL and sender", () => {
  const email = buildAbandonedCartReminderEmail(baseCandidate as any);

  assert.equal(email.from, "info@xhaccp.fr");
  assert.match(email.checkoutUrl, /^https:\/\/xhaccp\.fr\/checkout\?/);
  assert.match(email.subject, /panier/i);
  assert.match(email.html, /Nettoyant &lt;Premium&gt;/);
  assert.match(email.html, /25\.00 EUR/);
});

test("uses market-specific Romanian checkout and currency", () => {
  const email = buildAbandonedCartReminderEmail({
    ...baseCandidate,
    market: "ro",
    items: [{ ...baseCandidate.items[0], price: "10", currency: "RON" }],
  } as any);

  assert.notEqual(email.from, "info@xhaccp.fr");
  assert.match(email.checkoutUrl, /^https:\/\/xhaccp\.ro\/checkout\?/);
  assert.match(email.text, /20\.00 RON/);
});