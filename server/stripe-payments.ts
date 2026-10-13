import Stripe from "stripe";
import type { PaymentMarket } from "./payment-health-policy";

export type StripeAccountMarket = "fr" | "ro";

export function getStripeAccountMarket(market: PaymentMarket): StripeAccountMarket {
  return market === "fr" ? "fr" : "ro";
}

function envForMarket(base: string, market: PaymentMarket): string | undefined {
  const accountMarket = getStripeAccountMarket(market).toUpperCase();
  return process.env[`${base}_${accountMarket}`] || undefined;
}

export function getStripePublishableKey(market: PaymentMarket): string | undefined {
  return envForMarket("STRIPE_PUBLISHABLE_KEY", market);
}

export function getStripeWebhookSecret(market: PaymentMarket): string | undefined {
  return envForMarket("STRIPE_WEBHOOK_SECRET", market);
}

export function isStripeConfigured(market: PaymentMarket): boolean {
  return Boolean(
    envForMarket("STRIPE_SECRET_KEY", market) &&
    getStripePublishableKey(market) &&
    getStripeWebhookSecret(market),
  );
}

export function getStripeClient(market: PaymentMarket): Stripe {
  const secretKey = envForMarket("STRIPE_SECRET_KEY", market);
  if (!secretKey) throw new Error(`Stripe credentials are not configured for ${getStripeAccountMarket(market).toUpperCase()}`);
  return new Stripe(secretKey);
}

export async function findOrCreateStripeCustomer(
  stripe: Stripe,
  input: { market: PaymentMarket; userId: number; email: string; name?: string; phone?: string },
): Promise<Stripe.Customer> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("A customer email is required for recurring card payments");

  const existing = await stripe.customers.list({ email, limit: 100 });
  const match = existing.data.find(customer =>
    !customer.deleted &&
    customer.metadata?.xhaccp_user_id === String(input.userId) &&
    customer.metadata?.xhaccp_market === input.market,
  );
  if (match && !match.deleted) return match;

  return stripe.customers.create({
    email,
    name: input.name?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    metadata: {
      xhaccp_user_id: String(input.userId),
      xhaccp_market: input.market,
      xhaccp_account_market: getStripeAccountMarket(input.market),
    },
  }, {
    idempotencyKey: `xhaccp-customer-${input.market}-${input.userId}`,
  });
}

export async function createOrderPaymentIntent(input: {
  market: PaymentMarket;
  amountCents: number;
  currency: string;
  orderId: number;
  customer?: Stripe.Customer;
  email?: string;
  recurring: boolean;
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient(input.market);
  return stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    payment_method_types: ["card"],
    customer: input.customer?.id,
    setup_future_usage: input.recurring ? "off_session" : undefined,
    receipt_email: input.email || undefined,
    description: `xHACCP order #${input.orderId}`,
    metadata: {
      xhaccp_order_id: String(input.orderId),
      xhaccp_market: input.market,
      xhaccp_recurring: input.recurring ? "true" : "false",
    },
  }, {
    idempotencyKey: `xhaccp-order-payment-${input.orderId}`,
  });
}

export async function chargeStripeSubscription(input: {
  market: PaymentMarket;
  amountCents: number;
  currency: string;
  subscriptionId: number;
  billingPaymentId: number;
  customerId: string;
  paymentMethodId: string;
  attemptNumber: number;
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient(input.market);
  return stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    customer: input.customerId,
    payment_method: input.paymentMethodId,
    payment_method_types: ["card"],
    off_session: true,
    confirm: true,
    description: `xHACCP subscription renewal #${input.subscriptionId}`,
    metadata: {
      xhaccp_subscription_id: String(input.subscriptionId),
      xhaccp_market: input.market,
      xhaccp_billing_payment_id: String(input.billingPaymentId),
    },
  }, {
    idempotencyKey: `xhaccp-subscription-renewal-${input.billingPaymentId}-${input.attemptNumber}`,
  });
}

export async function checkStripeAuthentication(market: PaymentMarket): Promise<void> {
  await getStripeClient(market).accounts.retrieve();
}
