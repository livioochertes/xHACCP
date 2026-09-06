import { and, eq, lte, lt, or } from "drizzle-orm";
import { db } from "./db";
import { products, subscriptions, subscriptionPayments, orders, orderItems } from "@shared/schema";
import { storage } from "./storage";

type SubscriptionMarket = "ro" | "fr" | "com";

function getCredentials(market: SubscriptionMarket) {
  if (market === "fr") {
    return {
      clientId: process.env.VIVA_FR_CLIENT_ID,
      clientSecret: process.env.VIVA_FR_CLIENT_SECRET,
      sourceCode: process.env.VIVA_FR_SOURCE_CODE,
    };
  }
  return {
    clientId: process.env.VIVA_CLIENT_ID,
    clientSecret: process.env.VIVA_CLIENT_SECRET,
    sourceCode: process.env.VIVA_SOURCE_CODE,
  };
}

async function getAccessToken(market: SubscriptionMarket) {
  const credentials = getCredentials(market);
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(`Viva ${market} recurring credentials are not configured`);
  }
  const response = await fetch("https://accounts.vivapayments.com/connect/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Viva recurring authentication failed: ${response.status}`);
  }
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Viva recurring authentication returned no token");
  return data.access_token;
}

function addOneMonth(value: Date) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function billingKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
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

  const nextBillingAt = addOneMonth(new Date());
  const [created] = await db
    .insert(subscriptions)
    .values({
      userId: order.userId,
      productId: subscriptionItem.productId,
      initialOrderId: order.id,
      market: order.market || "ro",
      currency: order.currency || "RON",
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

async function claimBillingAttempt(subscription: any, dueAt: Date) {
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
    existing.attemptNumber < 3 &&
    existing.updatedAt &&
    Date.now() - new Date(existing.updatedAt).getTime() >= 23 * 60 * 60 * 1000
  ) {
    const [retry] = await db
      .update(subscriptionPayments)
      .set({
        status: "pending",
        attemptNumber: existing.attemptNumber + 1,
        updatedAt: new Date(),
        failureReason: null,
      })
      .where(and(eq(subscriptionPayments.id, existing.id), eq(subscriptionPayments.status, "failed")))
      .returning();
    return retry || null;
  }
  return null;
}

async function createRecurringTransaction(subscription: any, payment: any) {
  const market = (subscription.market || "ro") as SubscriptionMarket;
  const credentials = getCredentials(market);
  if (!credentials.sourceCode) throw new Error(`Viva ${market} source code is not configured`);
  const accessToken = await getAccessToken(market);
  const amountCents = Math.round(Number(subscription.amount) * 100);
  const response = await fetch(
    `https://www.vivapayments.com/api/transactions/${encodeURIComponent(subscription.initialTransactionId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        customerTrns: `xHACCP subscription renewal #${subscription.id}`,
        merchantTrns: `subscription_${subscription.id}_${payment.billingKey}`,
        sourceCode: credentials.sourceCode,
      }),
    },
  );
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
    const payment = await claimBillingAttempt(subscription, new Date(subscription.nextBillingAt));
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
          if (user?.email) {
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
      if (attemptNumber >= 3) {
        await db.update(subscriptions)
          .set({
            status: "past_due",
            nextBillingAt: addOneMonth(new Date(subscription.nextBillingAt)),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));
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