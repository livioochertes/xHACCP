import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_ABANDONMENT_DELAY_MS,
  isCartMonitoringConsentCookie,
  isCartAbandoned,
  isValidCartMonitoringId,
  normalizeCartAbandonmentItems,
} from "./cart-abandonment";

test("cart monitoring is allowed only with a recent explicit opt-in cookie and valid opaque ID", () => {
  const consent = `v1:analytics:0:cart:1:${Date.now()}`;
  assert.equal(isCartMonitoringConsentCookie(consent), true);
  assert.equal(isCartMonitoringConsentCookie(`v1:analytics:1:cart:0:${Date.now()}`), false);
  assert.equal(isCartMonitoringConsentCookie(`v1:analytics:0:cart:1:${Date.now() - 181 * 86400000}`), false);
  assert.equal(isValidCartMonitoringId("0f34dcb5-63a1-4f4c-9d2c-318a47f72a62"), true);
  assert.equal(isValidCartMonitoringId("not-an-id"), false);
});

test("cart monitoring snapshot keeps only product IDs, quantities, and composite IDs", () => {
  const result = normalizeCartAbandonmentItems([{
    productId: 14,
    quantity: 2,
    name: "must not be stored",
    email: "visitor@example.com",
    compositeConfiguration: {
      components: [{ componentProductId: 8, quantity: 3, name: "not stored" }],
    },
  }]);

  assert.deepEqual(result, [{
    productId: 14,
    quantity: 2,
    components: [{ componentProductId: 8, quantity: 3 }],
  }]);
});

test("invalid or excessive cart snapshots are rejected", () => {
  assert.equal(normalizeCartAbandonmentItems({}), null);
  assert.equal(normalizeCartAbandonmentItems([{ productId: 1, quantity: 0 }]), null);
  assert.equal(normalizeCartAbandonmentItems([{ productId: "nope", quantity: 1 }]), null);
  assert.equal(normalizeCartAbandonmentItems(Array.from({ length: 81 }, (_, i) => ({
    productId: i + 1,
    quantity: 1,
  }))), null);
});

test("a cart becomes abandoned at the one-hour inactivity threshold", () => {
  const lastActivity = new Date("2026-10-20T10:00:00.000Z");
  assert.equal(isCartAbandoned(lastActivity, new Date(lastActivity.getTime() + CART_ABANDONMENT_DELAY_MS - 1)), false);
  assert.equal(isCartAbandoned(lastActivity, new Date(lastActivity.getTime() + CART_ABANDONMENT_DELAY_MS)), true);
});
