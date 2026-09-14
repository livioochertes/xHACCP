import assert from "node:assert/strict";
import test from "node:test";
import { getPaymentEventName, getPaymentStatus } from "./analytics";

test("direct thank-you page access has no confirmed payment state", () => {
  assert.equal(getPaymentStatus(null), "unavailable");
  assert.equal(getPaymentStatus(""), "unavailable");
  assert.equal(getPaymentEventName(null), null);
  assert.equal(getPaymentEventName(""), null);
});

test("success and cash payment statuses show success and track a purchase", () => {
  for (const paymentResult of ["success", "cash"]) {
    assert.equal(getPaymentStatus(paymentResult), "success");
    assert.equal(getPaymentEventName(paymentResult), "purchase_completed");
  }
});

test("failed and error payment statuses show failure and track a failed payment", () => {
  for (const paymentResult of ["failed", "error"]) {
    assert.equal(getPaymentStatus(paymentResult), "failed");
    assert.equal(getPaymentEventName(paymentResult), "payment_failed");
  }
});