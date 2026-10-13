type PaymentOrderSummary = {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
};

export type AdminOrderListMode = "orders" | "payment-attempts";

const UNPAID_PAYMENT_STATUSES = new Set([
  "pending",
  "failed",
  "cancelled",
  "canceled",
  "voided",
  "reversed",
]);

export function isUnpaidOnlinePaymentAttempt(order: PaymentOrderSummary): boolean {
  const method = String(order.paymentMethod || "").toLowerCase();
  const status = String(order.paymentStatus || "").toLowerCase();
  return (method === "paypal" || method === "viva" || method === "stripe") &&
    UNPAID_PAYMENT_STATUSES.has(status);
}

export function filterOrdersForAdminList<T extends PaymentOrderSummary>(
  orders: T[],
  mode: AdminOrderListMode,
): T[] {
  return orders.filter(order => isUnpaidOnlinePaymentAttempt(order) === (mode === "payment-attempts"));
}
