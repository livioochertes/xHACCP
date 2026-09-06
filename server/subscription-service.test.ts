import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  addOneMonth,
  billingKey,
  buildRecurringTransactionRequest,
  getRenewalFailureTransition,
  getSubscriptionMarketConfig,
  isRetryEligible,
  MAX_RENEWAL_ATTEMPTS,
  RETRY_DELAY_HOURS,
} from "./subscription-service";
import { buildVivaCheckoutPayload } from "./viva-config";
import { db } from "./db";
import { orders } from "@shared/schema";
import { storage } from "./storage";

const originalEnv = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
});

test("recurring Viva configuration covers every marketplace and currency", () => {
  process.env.VIVA_CLIENT_ID = "ro-client";
  process.env.VIVA_CLIENT_SECRET = "ro-secret";
  process.env.VIVA_SOURCE_CODE = "ro-source";
  process.env.VIVA_FR_CLIENT_ID = "fr-client";
  process.env.VIVA_FR_CLIENT_SECRET = "fr-secret";
  process.env.VIVA_FR_SOURCE_CODE = "fr-source";
  process.env.VIVA_COM_CLIENT_ID = "com-client";
  process.env.VIVA_COM_CLIENT_SECRET = "com-secret";
  process.env.VIVA_COM_SOURCE_CODE = "com-source";

  const cases = [
    ["ro", "RON", "ro-source"],
    ["fr", "EUR", "fr-source"],
    ["com", "EUR", "com-source"],
  ] as const;

  for (const [market, currency, sourceCode] of cases) {
    const config = getSubscriptionMarketConfig(market);
    assert.equal(config.currency, currency);
    assert.equal(config.credentials.sourceCode, sourceCode);
  }
});

test("initial checkout payload uses the configured currency code and source per market", () => {
  process.env.VIVA_SOURCE_CODE = "ro-source";
  process.env.VIVA_FR_SOURCE_CODE = "fr-source";
  process.env.VIVA_COM_SOURCE_CODE = "com-source";

  const cases = [
    ["ro", "RON", 946, "ro-source"],
    ["fr", "EUR", 978, "fr-source"],
    ["com", "EUR", 978, "com-source"],
  ] as const;

  for (const [market, currency, currencyCode, sourceCode] of cases) {
    const payload = buildVivaCheckoutPayload({
      market,
      amountCents: 2599,
      orderId: 91,
      baseUrl: `https://www.xhaccp.${market}`,
      hasSubscription: true,
    });
    assert.equal(payload.currencyCode, currencyCode);
    assert.equal(payload.sourceCode, sourceCode);
    assert.equal(payload.allowRecurring, true);
    assert.equal(currencyCode === 946 ? currency : "EUR", currency);
  }
});

test("COM safely uses the shared account when no dedicated account is configured", () => {
  process.env.VIVA_SOURCE_CODE = "shared-source";
  process.env.VIVA_CLIENT_ID = "shared-client";
  process.env.VIVA_CLIENT_SECRET = "shared-secret";

  const config = getSubscriptionMarketConfig("com");
  assert.equal(config.currency, "EUR");
  assert.equal(config.credentials.sourceCode, "shared-source");
});

test("recurring requests preserve each market source and amount", () => {
  process.env.VIVA_FR_SOURCE_CODE = "fr-source";
  const request = buildRecurringTransactionRequest(
    {
      id: 42,
      market: "fr",
      currency: "EUR",
      amount: "19.95",
      initialTransactionId: "initial-fr-transaction",
    },
    { billingKey: "2026-10" },
    "test-access-token",
  );

  assert.equal(
    request.url,
    "https://www.vivapayments.com/api/transactions/initial-fr-transaction",
  );
  assert.deepEqual(JSON.parse(request.init.body), {
    amount: 1995,
    customerTrns: "xHACCP subscription renewal #42",
    merchantTrns: "subscription_42_2026-10",
    sourceCode: "fr-source",
  });
  assert.equal(request.init.headers.Authorization, "Bearer test-access-token");
});

test("recurring requests reject a currency/source mismatch before Viva is called", () => {
  process.env.VIVA_SOURCE_CODE = "ro-source";
  assert.throws(
    () => buildRecurringTransactionRequest(
      {
        id: 7,
        market: "ro",
        currency: "EUR",
        amount: "10.00",
        initialTransactionId: "wrong-currency",
      },
      { billingKey: "2026-10" },
      "token",
    ),
    /must be RON/,
  );
});

test("a failed renewal retries twice and becomes past_due on the third failure", () => {
  const dueAt = new Date("2026-09-01T12:00:00.000Z");
  const subscription = { nextBillingAt: dueAt };

  assert.equal(
    getRenewalFailureTransition(subscription, { attemptNumber: 1 }),
    null,
  );
  assert.equal(
    getRenewalFailureTransition(subscription, { attemptNumber: 2 }),
    null,
  );
  assert.deepEqual(
    getRenewalFailureTransition(subscription, { attemptNumber: MAX_RENEWAL_ATTEMPTS }),
    { status: "past_due", nextBillingAt: addOneMonth(dueAt) },
  );
});

test("failed renewal retry waits the configured interval and billing key is monthly", () => {
  const failedAt = new Date("2026-09-01T12:00:00.000Z");
  const beforeRetry = new Date(failedAt.getTime() + (RETRY_DELAY_HOURS * 60 * 60 * 1000) - 1);
  const eligibleRetry = new Date(failedAt.getTime() + RETRY_DELAY_HOURS * 60 * 60 * 1000);

  assert.equal(
    isRetryEligible({ status: "failed", attemptNumber: 1, updatedAt: failedAt }, beforeRetry),
    false,
  );
  assert.equal(
    isRetryEligible({ status: "failed", attemptNumber: 1, updatedAt: failedAt }, eligibleRetry),
    true,
  );
  assert.equal(
    isRetryEligible({ status: "failed", attemptNumber: MAX_RENEWAL_ATTEMPTS, updatedAt: failedAt }, eligibleRetry),
    false,
  );
  assert.equal(billingKey(new Date("2026-09-30T23:59:59.000Z")), "2026-09");
});

test("concurrent callback and webhook claims are idempotent", async () => {
  const [order] = await db.insert(orders).values({
    market: "fr",
    currency: "EUR",
    status: "pending",
    totalAmount: "1.00",
    shippingCost: "0.00",
    shippingAddress: { email: "subscription-test@example.invalid" },
    billingAddress: {},
    paymentMethod: "viva",
    paymentStatus: "pending",
    notes: "automated idempotency test",
  }).returning({ id: orders.id });

  try {
    const claims = await Promise.all([
      storage.markOrderPaid(order.id),
      storage.markOrderPaid(order.id),
    ]);

    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(claims.filter((claim) => claim == null).length, 1);
  } finally {
    await db.delete(orders).where(eq(orders.id, order.id));
  }
});