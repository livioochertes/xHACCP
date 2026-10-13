import assert from "node:assert/strict";
import test from "node:test";
import { filterOrdersForAdminList, isUnpaidOnlinePaymentAttempt } from "./admin-payment-attempts";

const sampleOrders = [
  { id: 1, paymentMethod: "paypal", paymentStatus: "pending" },
  { id: 2, paymentMethod: "viva", paymentStatus: "cancelled" },
  { id: 3, paymentMethod: "viva", paymentStatus: "failed" },
  { id: 4, paymentMethod: "paypal", paymentStatus: "paid" },
  { id: 5, paymentMethod: "viva", paymentStatus: "refunded" },
  { id: 6, paymentMethod: "cash_on_delivery", paymentStatus: "pending" },
  { id: 7, paymentMethod: "bank_transfer", paymentStatus: "pending" },
];

test("unpaid Viva/PayPal attempts are separated from normally payable orders", () => {
  assert.deepEqual(filterOrdersForAdminList(sampleOrders, "payment-attempts").map(o => o.id), [1, 2, 3]);
  assert.deepEqual(filterOrdersForAdminList(sampleOrders, "orders").map(o => o.id), [4, 5, 6, 7]);
});

test("only a recorded paid status removes an online attempt from the attempts list", () => {
  assert.equal(isUnpaidOnlinePaymentAttempt({ paymentMethod: "paypal", paymentStatus: "paid" }), false);
  assert.equal(isUnpaidOnlinePaymentAttempt({ paymentMethod: "paypal", paymentStatus: "cancelled" }), true);
  assert.equal(isUnpaidOnlinePaymentAttempt({ paymentMethod: "viva", paymentStatus: "failed" }), true);
  assert.equal(isUnpaidOnlinePaymentAttempt({ paymentMethod: "viva", paymentStatus: "refunded" }), false);
});
