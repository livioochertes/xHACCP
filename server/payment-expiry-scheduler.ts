import { storage, type IStorage } from "./storage";
import {
  PAYPAL_APPROVAL_REVERSAL_DELAY_MS,
  PAYPAL_REVERSAL_RECONCILIATION_GRACE_MS,
  expirePayPalOrderIfProviderConfirms,
  getPayPalOrder,
} from "./paypal";
import {
  getVivaPaymentOrderStatus,
  isVivaOrderStateNonPayable,
} from "./viva-payment-status";
import type { VivaMarket } from "./viva-config";

const VIVA_ORDER_TIMEOUT_MS = 30 * 60 * 1000;
const VIVA_EXPIRY_GRACE_MS = 2 * 60 * 1000;
const PAYPAL_EXPIRY_AGE_MS =
  PAYPAL_APPROVAL_REVERSAL_DELAY_MS + PAYPAL_REVERSAL_RECONCILIATION_GRACE_MS;
const PAYMENT_EXPIRY_INTERVAL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 50;
const MAX_ORDERS_PER_RUN = 200;

type PaymentExpiryStorage = Pick<
  IStorage,
  "listPendingProviderPaymentOrders" | "markOrderPaymentFailed" | "getOrderByPaymentProviderOrderId"
>;

export async function reconcilePendingPaymentExpiryBatch(
  dependencies: {
    storage: PaymentExpiryStorage;
    getVivaOrderStatus?: typeof getVivaPaymentOrderStatus;
    getPayPalOrder?: typeof getPayPalOrder;
  },
  afterId: number,
  now = new Date(),
  limit = PAGE_SIZE,
): Promise<{ scanned: number; released: number; nextAfterId: number }> {
  const candidates = await dependencies.storage.listPendingProviderPaymentOrders(
    afterId,
    limit,
    new Date(now.getTime() - VIVA_ORDER_TIMEOUT_MS - VIVA_EXPIRY_GRACE_MS),
    new Date(now.getTime() - PAYPAL_EXPIRY_AGE_MS),
  );
  if (!candidates.length) return { scanned: 0, released: 0, nextAfterId: 0 };

  let released = 0;
  for (let start = 0; start < candidates.length; start += 10) {
    const batch = candidates.slice(start, start + 10);
    const results = await Promise.all(batch.map(async (order) => {
      const providerOrderId = order.paymentProviderOrderId;
      if (!providerOrderId) return false;
      try {
        if (order.paymentMethod === "viva") {
          const market = order.market === "fr" || order.market === "com" ? order.market : "ro";
          const getStatus = dependencies.getVivaOrderStatus || getVivaPaymentOrderStatus;
          const status = await getStatus(providerOrderId, market as VivaMarket);
          if (
            status.MerchantTrns !== `order_${order.id}` ||
            !isVivaOrderStateNonPayable(status.StateId)
          ) {
            return false;
          }
          return Boolean(await dependencies.storage.markOrderPaymentFailed(order.id));
        }

        if (order.paymentMethod === "paypal") {
          return expirePayPalOrderIfProviderConfirms(
            providerOrderId,
            `expiry-${order.id}`,
            {
              storage: dependencies.storage,
              getPayPalOrder: dependencies.getPayPalOrder,
            },
            now,
          );
        }
      } catch (error) {
        console.error(
          `[Payment Expiry] Provider status check failed for order ${order.id}:`,
          error instanceof Error ? error.message : "unknown error",
        );
      }
      return false;
    }));
    released += results.filter(Boolean).length;
  }

  return {
    scanned: candidates.length,
    released,
    nextAfterId: candidates.length >= limit ? candidates[candidates.length - 1].id : 0,
  };
}

let schedulerStarted = false;

export function startPaymentExpiryScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  let running = false;
  let cursor = 0;
  const run = async () => {
    if (running) return;
    running = true;
    let totalScanned = 0;
    let totalReleased = 0;
    try {
      while (totalScanned < MAX_ORDERS_PER_RUN) {
        const batch = await reconcilePendingPaymentExpiryBatch(
          { storage },
          cursor,
          new Date(),
        );
        if (batch.scanned === 0) {
          cursor = 0;
          break;
        }
        totalScanned += batch.scanned;
        totalReleased += batch.released;
        cursor = batch.nextAfterId;
        if (cursor === 0) break;
      }
      if (totalReleased > 0) {
        console.log(`[Payment Expiry] Released ${totalReleased} provider-confirmed pending order hold(s)`);
      }
    } catch (error) {
      console.error("[Payment Expiry] Reconciliation run failed:", error);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), PAYMENT_EXPIRY_INTERVAL_MS);
  console.log("[Payment Expiry] Provider status checks active — every five minutes");
}
