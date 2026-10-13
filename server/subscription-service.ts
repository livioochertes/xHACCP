import { and, eq, isNull, lte, lt, or } from "drizzle-orm";
import { db } from "./db";
import { products, subscriptions, subscriptionPayments, orders, orderItems } from "@shared/schema";
import { storage } from "./storage";
import { getVivaCredentials, getVivaCurrency, type VivaMarket } from "./viva-config";
import { withVivaUserAgent } from "./viva-http";
import { getVivaAccessToken } from "./viva-auth";

export { type VivaMarket };

export const MAX_RENEWAL_ATTEMPTS = 3;
export const RETRY_DELAY_HOURS = 23;

export function getSubscriptionMarketConfig(market: VivaMarket) {
  return {
    market,
    currency: getVivaCurrency(market),
    credentials: getVivaCredentials(market),
  };
}

async function getAccessToken(market: VivaMarket) {
  return getVivaAccessToken(market, "subscription-renewal");
}

export function addOneMonth(value: Date) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function billingKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isRetryEligible(payment: {
  status?: string | null;
  attemptNumber?: number | null;
  updatedAt?: Date | string | null;
}, now = new Date()) {
  if (
    payment.status !== "failed" ||
    Number(payment.attemptNumber || 0) >= MAX_RENEWAL_ATTEMPTS ||
    !payment.updatedAt
  ) {
    return false;
  }
  return now.getTime() - new Date(payment.updatedAt).getTime() >= RETRY_DELAY_HOURS * 60 * 60 * 1000;
}

export function getRenewalFailureTransition(
  subscription: { nextBillingAt: Date | string },
  payment: { attemptNumber?: number | null },
) {
  const attemptNumber = Number(payment.attemptNumber || 1);
  return attemptNumber >= MAX_RENEWAL_ATTEMPTS
    ? {
        status: "past_due" as const,
        nextBillingAt: addOneMonth(new Date(subscription.nextBillingAt)),
      }
    : null;
}

export function buildRecurringTransactionRequest(
  subscription: {
    id: number;
    market: VivaMarket;
    currency: string;
    amount: string | number;
    initialTransactionId: string;
  },
  payment: { billingKey: string },
  accessToken: string,
) {
  const config = getSubscriptionMarketConfig(subscription.market);
  if (subscription.currency !== config.currency) {
    throw new Error(
      `Viva ${subscription.market} recurring currency must be ${config.currency}, received ${subscription.currency}`,
    );
  }
  if (!config.credentials.sourceCode) {
    throw new Error(`Viva ${subscription.market} source code is not configured`);
  }

  const amountCents = Math.round(Number(subscription.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    throw new Error(`Invalid Viva recurring amount for subscription ${subscription.id}`);
  }

  return {
    url: `https://www.vivapayments.com/api/transactions/${encodeURIComponent(subscription.initialTransactionId)}`,
    init: {
      method: "POST",
      headers: withVivaUserAgent({
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      }),
      body: JSON.stringify({
        amount: amountCents,
        customerTrns: `xHACCP subscription renewal #${subscription.id}`,
        merchantTrns: `subscription_${subscription.id}_${payment.billingKey}`,
        sourceCode: config.credentials.sourceCode,
      }),
    },
  };
}

/**
 * Creates the local subscription only after the initial order has been claimed
 * as paid. The unique initial transaction constraint makes callback/webhook
 * replays harmless.
 */
export async function activateSubscriptionForOrder(
  order: any,
  initialTransactionId: string,
) {
  if (!order?.userId || !initialTransactionId) return null;
  const subscriptionItem = (order.items || []).find(
    (item: any) => item.product?.productType === "subscription",
  );
  if (!subscriptionItem) return null;

  const amount = Number.parseFloat(String(subscriptionItem.price || "0")) * Number(subscriptionItem.quantity || 1);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid subscription amount for order ${order.id}`);
  }

  const market = (order.market || "ro") as VivaMarket;
  const expectedCurrency = getVivaCurrency(market);
  const currency = order.currency || expectedCurrency;
  if (currency !== expectedCurrency) {
    throw new Error(
      `Subscription ${market} orders must use ${expectedCurrency}, received ${currency}`,
    );
  }

  const nextBillingAt = addOneMonth(new Date());
  const [created] = await db
    .insert(subscriptions)
    .values({
      userId: order.userId,
      productId: subscriptionItem.productId,
      initialOrderId: order.id,
      market,
      currency,
      amount: amount.toFixed(2),
      status: "active",
      initialTransactionId,
      nextBillingAt,
      consentAt: new Date(),
    })
    .onConflictDoNothing({ target: subscriptions.initialTransactionId })
    .returning();

  return created || null;
}

async function claimBillingAttempt(subscription: any, dueAt: Date, now = new Date()) {
  const key = billingKey(dueAt);
  const [claimed] = await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId: subscription.id,
      billingKey: key,
      initialTransactionId: subscription.initialTransactionId,
      amount: subscription.amount,
      currency: subscription.currency,
      status: "pending",
      attemptNumber: 1,
      dueAt,
    })
    .onConflictDoNothing({
      target: [subscriptionPayments.subscriptionId, subscriptionPayments.billingKey],
    })
    .returning();

  if (claimed) return claimed;

  const [existing] = await db
    .select()
    .from(subscriptionPayments)
    .where(and(
      eq(subscriptionPayments.subscriptionId, subscription.id),
      eq(subscriptionPayments.billingKey, key),
    ))
    .limit(1);
  if (
    existing &&
    existing.status === "failed" &&
    isRetryEligible(existing, now)
  ) {
    const [retry] = await db
      .update(subscriptionPayments)
      .set({
        status: "pending",
        attemptNumber: existing.attemptNumber + 1,
        updatedAt: new Date(),
        failureReason: null,
          failureNotifiedAt: null,
      })
      .where(and(eq(subscriptionPayments.id, existing.id), eq(subscriptionPayments.status, "failed")))
      .returning();
    return retry || null;
  }
  return null;
}

async function createRecurringTransaction(subscription: any, payment: any) {
  const market = (subscription.market || "ro") as VivaMarket;
  const accessToken = await getAccessToken(market);
  const request = buildRecurringTransactionRequest(subscription, payment, accessToken);
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Viva recurring payment failed: ${response.status} ${message.slice(0, 300)}`);
  }
  return await response.json() as { TransactionId?: string; transactionId?: string };
}

export async function processDueSubscriptions(now = new Date()) {
  const due = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, "active"),
      lte(subscriptions.nextBillingAt, now),
    ));

  let processed = 0;
  for (const subscription of due) {
    const payment = await claimBillingAttempt(subscription, new Date(subscription.nextBillingAt), now);
    if (!payment) continue;
    try {
      const result = await createRecurringTransaction(subscription, payment);
      const vivaTransactionId = result.TransactionId || result.transactionId || null;
      const initialOrder = subscription.initialOrderId
        ? await storage.getOrder(subscription.initialOrderId)
        : null;
      if (!initialOrder) throw new Error(`Initial order not found for subscription ${subscription.id}`);
      let renewalOrderId = 0;
      await db.transaction(async (tx) => {
        await tx.update(subscriptionPayments)
          .set({
            status: "succeeded",
            vivaTransactionId,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, payment.id));

        const canceled = subscription.cancelAtPeriodEnd === true;
        const [renewalOrder] = await tx.insert(orders).values({
          userId: subscription.userId,
          market: subscription.market,
          currency: subscription.currency,
          status: "processing",
          totalAmount: subscription.amount,
          shippingCost: "0.00",
          shippingAddress: initialOrder.shippingAddress,
          billingAddress: initialOrder.billingAddress,
          paymentMethod: "viva",
          paymentStatus: "paid",
          notes: `Monthly subscription renewal #${subscription.id}`,
          source: "website",
        }).returning();
        renewalOrderId = renewalOrder.id;
        await tx.insert(orderItems).values({
          orderId: renewalOrder.id,
          productId: subscription.productId,
          quantity: 1,
          price: subscription.amount,
          totalPrice: subscription.amount,
        });
        await tx.update(subscriptions)
          .set({
            status: canceled ? "canceled" : "active",
            canceledAt: canceled ? new Date() : subscription.canceledAt,
            nextBillingAt: addOneMonth(new Date(subscription.nextBillingAt)),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));
      });
      const renewalOrder = await storage.getOrder(renewalOrderId);
      if (renewalOrder) {
        try {
          const { createInvoiceService } = await import("./invoice-service");
          const invoiceService = await createInvoiceService();
          const invoice = await invoiceService.generateInvoiceAfterPayment(renewalOrder.id, {
            paymentMethod: "card",
            transactionId: vivaTransactionId,
          });
          let invoicePdf: Buffer | null = null;
          if (invoice?.id) {
            invoicePdf = await invoiceService.getInvoicePdf(invoice.id).catch(() => null);
          }
          const user = await storage.getUser(subscription.userId);
          const canSendFrenchInvoice = renewalOrder.market !== "fr" || !invoice?.id ||
            !!(await storage.claimInvoiceEmail(invoice.id));
          if (user?.email && canSendFrenchInvoice) {
            const { sendSubscriptionRenewalEmail } = await import("./email-service");
            await sendSubscriptionRenewalEmail(user.email, renewalOrder as any, invoicePdf, invoice?.invoiceNumber);
          }
        } catch (postPaymentError) {
          console.error(`[Subscriptions] Renewal post-payment processing failed for #${subscription.id}:`, postPaymentError);
        }
      }
      processed++;
    } catch (error) {
      const attemptNumber = Number(payment.attemptNumber || 1);
      await db.update(subscriptionPayments)
        .set({
          status: "failed",
          failureReason: error instanceof Error ? error.message : "Unknown Viva error",
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPayments.id, payment.id));
      const subscriptionUpdate = getRenewalFailureTransition(subscription, payment);
      if (subscriptionUpdate) {
        await db.update(subscriptions)
          .set({ ...subscriptionUpdate, updatedAt: new Date() })
          .where(eq(subscriptions.id, subscription.id));
      }
      const [notificationClaim] = await db
        .update(subscriptionPayments)
        .set({ failureNotifiedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(subscriptionPayments.id, payment.id),
          eq(subscriptionPayments.status, "failed"),
          isNull(subscriptionPayments.failureNotifiedAt),
        ))
        .returning();
      if (notificationClaim) {
        try {
          const [user, product] = await Promise.all([
            storage.getUser(subscription.userId),
            storage.getProduct(subscription.productId),
          ]);
          if (user?.email) {
            const { sendSubscriptionPaymentFailureEmail } = await import("./email-service");
            const market = subscription.market || "ro";
            const accountHost = market === "fr" ? "www.xhaccp.fr" : market === "com" ? "www.xhaccp.com" : "www.xhaccp.ro";
            await sendSubscriptionPaymentFailureEmail({
              customerEmail: user.email,
              market,
              productName: product?.name || `Subscription #${subscription.id}`,
              amount: subscription.amount,
              currency: subscription.currency,
              attemptNumber,
              maxAttempts: MAX_RENEWAL_ATTEMPTS,
              failureReason: notificationClaim.failureReason,
              accountUrl: `https://${accountHost}/account#subscriptions`,
            });
          }
        } catch (notificationError) {
          console.error(`[Subscriptions] Failed to notify customer for #${subscription.id}:`, notificationError);
        }
      }
      console.error(`[Subscriptions] Renewal failed for #${subscription.id}, attempt ${attemptNumber}:`, error);
    }
  }
  return processed;
}

export async function listUserSubscriptions(userId: number) {
  return db
    .select({
      id: subscriptions.id,
      productId: subscriptions.productId,
      productName: products.name,
      productImageUrl: products.imageUrl,
      market: subscriptions.market,
      currency: subscriptions.currency,
      amount: subscriptions.amount,
      status: subscriptions.status,
      nextBillingAt: subscriptions.nextBillingAt,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      canceledAt: subscriptions.canceledAt,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(products, eq(products.id, subscriptions.productId))
    .where(eq(subscriptions.userId, userId));
}

export async function cancelUserSubscription(userId: number, subscriptionId: number) {
  const [updated] = await db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(and(
      eq(subscriptions.id, subscriptionId),
      eq(subscriptions.userId, userId),
      or(eq(subscriptions.status, "active"), eq(subscriptions.status, "past_due")),
    ))
    .returning();
  return updated || null;
}