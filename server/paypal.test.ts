import test from "node:test";
import assert from "node:assert/strict";
import {
  completedPayPalCapture,
  isAllowedPayPalApprovalUrl,
  isPayPalOrderBindingValid,
  paypalCaptureRequestId,
  paypalCreateRequestId,
  paypalWebhookHeaders,
  paypalWebhookOrderId,
} from "./paypal";

test("PayPal approval URL allowlist only accepts HTTPS PayPal hosts", () => {
  assert.equal(isAllowedPayPalApprovalUrl("https://www.paypal.com/checkoutnow?token=x"), true);
  assert.equal(isAllowedPayPalApprovalUrl("https://www.paypalobjects.com/checkout"), true);
  assert.equal(isAllowedPayPalApprovalUrl("http://www.paypal.com/checkout"), false);
  assert.equal(isAllowedPayPalApprovalUrl("https://evil.example/paypal"), false);
});

test("PayPal binding validates provider id, amount and currency", () => {
  const order = {
    id: 42, paymentProviderOrderId: "P-1", paymentMethod: "paypal",
    market: "fr", currency: "EUR", totalAmount: "12.30",
  };
  const remote = { id: "P-1", purchase_units: [{ custom_id: "42", invoice_id: "xhaccp-42", amount: { currency_code: "EUR", value: "12.30" } }] };
  assert.equal(isPayPalOrderBindingValid(remote, order), true);
  assert.equal(isPayPalOrderBindingValid({ ...remote, id: "P-2" }, order), false);
  assert.equal(isPayPalOrderBindingValid({ ...remote, purchase_units: [{ ...remote.purchase_units[0], amount: { currency_code: "USD", value: "12.30" } }] }, order), false);
});

test("completed capture extraction supports callback replay without recapture", () => {
  const order = { id: "P-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "C-1", status: "COMPLETED" }] } }] };
  assert.equal(completedPayPalCapture(order)?.id, "C-1");
  assert.equal(completedPayPalCapture({ ...order, status: "APPROVED" }) , undefined);
});

test("PayPal idempotency keys are stable", () => {
  assert.equal(paypalCreateRequestId("ord_abc", 7), paypalCreateRequestId("ord_abc", 7));
  assert.equal(paypalCaptureRequestId("P-1"), "xhaccp-capture-P-1");
});

test("PayPal webhook headers and order ids use signed transmission fields", () => {
  const headers = paypalWebhookHeaders({
    "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-transmission-id": "t-1", "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "now",
  });
  assert.equal(headers.transmission_id, "t-1");
  assert.equal(paypalWebhookOrderId({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "P-1" } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { supplementary_data: { related_ids: { order_id: "P-1" } } } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "C-1" } }), undefined);
});