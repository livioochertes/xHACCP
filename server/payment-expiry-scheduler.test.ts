import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePendingPaymentExpiryBatch } from "./payment-expiry-scheduler";

function pendingVivaOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    paymentMethod: "viva",
    market: "ro",
    currency: "RON",
    totalAmount: "42.00",
    paymentProviderOrderId: "987654321",
    createdAt: new Date("2026-10-07T00:00:00.000Z"),
    ...overrides,
  };
}

test("Viva pending voucher hold is released only for a matching expired or cancelled provider order", async () => {
  const released: number[] = [];
  let capturedCutoffs: [Date, Date] | undefined;
  let pending = true;
  const storage = {
    async listPendingProviderPaymentOrders(
      _afterId: number,
      _limit: number,
      vivaBefore: Date,
      paypalBefore: Date,
    ) {
      capturedCutoffs = [vivaBefore, paypalBefore];
      return [pendingVivaOrder()];
    },
    async markOrderPaymentFailed(orderId: number) {
      if (!pending) return null;
      pending = false;
      released.push(orderId);
      return { id: orderId };
    },
    async getOrderByPaymentProviderOrderId() { return undefined; },
  };

  const result = await reconcilePendingPaymentExpiryBatch({
    storage,
    getVivaOrderStatus: async (orderCode, market) => {
      assert.equal(orderCode, "987654321");
      assert.equal(market, "ro");
      return { MerchantTrns: "order_18", StateId: 1 };
    },
  }, 0, new Date("2026-10-07T04:00:00.000Z"));

  assert.deepEqual(result, { scanned: 1, released: 1, nextAfterId: 0 });
  assert.deepEqual(released, [18]);
  assert.ok(capturedCutoffs);
  assert.equal(
    new Date("2026-10-07T04:00:00.000Z").getTime() - capturedCutoffs[0].getTime(),
    32 * 60 * 1000,
  );
  assert.equal(
    new Date("2026-10-07T04:00:00.000Z").getTime() - capturedCutoffs[1].getTime(),
    3 * 60 * 60 * 1000 + 5 * 60 * 1000,
  );

  const replay = await reconcilePendingPaymentExpiryBatch({
    storage,
    getVivaOrderStatus: async () => ({ MerchantTrns: "order_18", StateId: 1 }),
  }, 0, new Date("2026-10-07T04:00:00.000Z"));
  assert.equal(replay.released, 0);
  assert.deepEqual(released, [18]);
});

test("Viva pending voucher hold remains reserved for a paid, pending, or mismatched provider order", async () => {
  const released: number[] = [];
  const storage = {
    async listPendingProviderPaymentOrders() {
      return [
        pendingVivaOrder({ id: 18, paymentProviderOrderId: "A" }),
        pendingVivaOrder({ id: 19, paymentProviderOrderId: "B" }),
        pendingVivaOrder({ id: 20, paymentProviderOrderId: "C" }),
      ];
    },
    async markOrderPaymentFailed(orderId: number) {
      released.push(orderId);
      return { id: orderId };
    },
    async getOrderByPaymentProviderOrderId() { return undefined; },
  };

  const result = await reconcilePendingPaymentExpiryBatch({
    storage,
    getVivaOrderStatus: async (orderCode) => ({
      MerchantTrns: orderCode === "C" ? "order_999" : `order_${orderCode === "A" ? 18 : 19}`,
      StateId: orderCode === "A" ? 3 : orderCode === "B" ? 0 : 2,
    }),
  }, 0, new Date("2026-10-07T04:00:00.000Z"));

  assert.equal(result.released, 0);
  assert.deepEqual(released, []);
});
