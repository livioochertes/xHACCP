import crypto from "crypto";

const PAYPAL_API = "https://api-m.paypal.com";

export type PayPalLink = { href: string; rel: string; method?: string };
export type PayPalOrder = {
  id: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    invoice_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: Array<{ id?: string; status?: string }> };
  }>;
  links?: PayPalLink[];
};
export type PayPalWebhookEvent = { event_type?: string; resource?: any; supplementary_data?: any };
export type PayPalLocalOrder = {
  id: number;
  paymentProviderOrderId?: string | null;
  paymentMethod: string | null;
  paymentStatus?: string | null;
  paymentTransactionId?: string | null;
  market: string | null;
  currency: string | null;
  totalAmount: string | number;
  createdAt?: Date | string | null;
  shippingAddress?: unknown;
  billingAddress?: unknown;
};

export type PayPalReconciliationStorage = {
  getOrderByPaymentProviderOrderId(providerOrderId: string): Promise<PayPalLocalOrder | undefined>;
  markOrderPaid(id: number, paymentTransactionId?: string): Promise<PayPalLocalOrder | null>;
  markOrderPaymentFailed?(id: number): Promise<unknown>;
  getOrder(id: number): Promise<PayPalLocalOrder | undefined>;
  claimInvoiceEmail?(id: number): Promise<unknown>;
};

export type PayPalInvoiceService = {
  generateInvoiceAfterPayment(orderId: number, payment: {
    status: "succeeded";
    paymentMethod: "paypal";
    paymentId: string;
    amount: number;
  }): Promise<{ id?: number; invoiceNumber?: string }>;
  getInvoicePdf(invoiceId: number): Promise<Buffer>;
};

export type PayPalReconciliationDependencies = {
  storage: PayPalReconciliationStorage;
  getPayPalOrder?: typeof getPayPalOrder;
  capturePayPalOrder?: typeof capturePayPalOrder;
  getInvoiceService: () => Promise<PayPalInvoiceService>;
  ensureFrenchOrderAwb: (orderId: number) => Promise<unknown>;
  sendFrenchOrderConfirmationEmails: (orderId: number) => Promise<unknown>;
  sendFrenchOrderDocumentsEmail: (orderId: number) => Promise<unknown>;
};

export type PayPalExpiryDependencies = {
  storage: Pick<
    PayPalReconciliationStorage,
    "getOrderByPaymentProviderOrderId" | "markOrderPaymentFailed"
  >;
  getPayPalOrder?: typeof getPayPalOrder;
};

export const PAYPAL_APPROVAL_REVERSAL_DELAY_MS = 3 * 60 * 60 * 1000;
export const PAYPAL_REVERSAL_RECONCILIATION_GRACE_MS = 5 * 60 * 1000;

export class PayPalApiError extends Error {
  constructor(readonly status: number) {
    super(`PayPal request failed (${status})`);
    this.name = "PayPalApiError";
  }
}

type PayPalWebhookRequest = {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type PayPalWebhookResponse = {
  status(code: number): PayPalWebhookResponse;
  json(body: unknown): PayPalWebhookResponse;
  sendStatus(code: number): PayPalWebhookResponse;
};

export function paypalWebhookHeaders(headers: Record<string, string | string[] | undefined>) {
  const get = (name: string) => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    auth_algo: get("paypal-auth-algo"),
    cert_url: get("paypal-cert-url"),
    transmission_id: get("paypal-transmission-id"),
    transmission_sig: get("paypal-transmission-sig"),
    transmission_time: get("paypal-transmission-time"),
  };
}

export function paypalWebhookOrderId(event: PayPalWebhookEvent): string | undefined {
  if (event.event_type === "CHECKOUT.ORDER.APPROVED" ||
      event.event_type === "CHECKOUT.ORDER.VOIDED" ||
      event.event_type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
    return typeof event.resource?.id === "string" ? event.resource.id : undefined;
  }
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" || event.event_type === "PAYMENT.CAPTURE.DENIED") {
    const id = event.resource?.supplementary_data?.related_ids?.order_id ??
      event.supplementary_data?.related_ids?.order_id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

export async function reconcilePayPalPayment(
  providerOrderId: string,
  requestId: string,
  dependencies: PayPalReconciliationDependencies,
): Promise<number | null> {
  const local = await dependencies.storage.getOrderByPaymentProviderOrderId(providerOrderId);
  if (!local) return null;
  if (local.paymentStatus && local.paymentStatus !== "pending" && local.paymentStatus !== "paid") {
    return null;
  }
  const getOrder = dependencies.getPayPalOrder || getPayPalOrder;
  const captureOrder = dependencies.capturePayPalOrder || capturePayPalOrder;
  const paypalOrder = await getOrder(providerOrderId, requestId);
  if (!isPayPalOrderBindingValid(paypalOrder, local)) return null;
  let capture = completedPayPalCapture(paypalOrder);
  if (local.paymentStatus === "paid") {
    return capture?.id &&
      (!local.paymentTransactionId || local.paymentTransactionId === capture.id)
      ? local.id
      : null;
  }
  if (!capture) {
    if (paypalOrder.status === "VOIDED") return null;
    const captured = await captureOrder(providerOrderId, paypalCaptureRequestId(providerOrderId));
    capture = completedPayPalCapture(captured);
  }
  if (!capture?.id) return null;
  const captureId = capture.id;
  const paid = await dependencies.storage.markOrderPaid(local.id, captureId);
  if (paid) {
    try {
      await dependencies.sendFrenchOrderConfirmationEmails(local.id);
    } catch (error) {
      console.error(`[PayPal ${requestId}] French order confirmation failed:`, error instanceof Error ? error.message : "unknown error");
    }

    try {
      const invoiceService = await dependencies.getInvoiceService();
      await invoiceService.generateInvoiceAfterPayment(local.id, {
        status: "succeeded",
        paymentMethod: "paypal",
        paymentId: captureId,
        amount: Number(local.totalAmount),
      });
    } catch (error) {
      console.error(`[PayPal ${requestId}] invoice generation failed:`, error instanceof Error ? error.message : "unknown error");
    }

    try {
      // French customer delivery requires both the invoice and the
      // MyFlyingBox shipment details. The AWB generator reuses an existing
      // AWB, so retries remain safe, while the notifier owns the durable
      // invoice-email claim and PDF/label retrieval.
      await dependencies.ensureFrenchOrderAwb(local.id);
      await dependencies.sendFrenchOrderDocumentsEmail(local.id);
    } catch (error) {
      console.error(`[PayPal ${requestId}] post-payment AWB/email failed:`, error instanceof Error ? error.message : "unknown error");
    }
  }
  return local.id;
}

export async function expirePayPalOrderIfProviderConfirms(
  providerOrderId: string,
  requestId: string,
  dependencies: PayPalExpiryDependencies,
  now = new Date(),
): Promise<boolean> {
  const local = await dependencies.storage.getOrderByPaymentProviderOrderId(providerOrderId);
  if (!local || (local.paymentStatus && local.paymentStatus !== "pending")) return false;

  const getOrder = dependencies.getPayPalOrder || getPayPalOrder;
  let providerOrder: PayPalOrder;
  try {
    providerOrder = await getOrder(providerOrderId, requestId);
  } catch (error) {
    const createdAt = local.createdAt ? new Date(local.createdAt).getTime() : Number.NaN;
    const oldEnoughForProviderReversal = Number.isFinite(createdAt) &&
      now.getTime() - createdAt >=
        PAYPAL_APPROVAL_REVERSAL_DELAY_MS + PAYPAL_REVERSAL_RECONCILIATION_GRACE_MS;
    if (!(error instanceof PayPalApiError && error.status === 404 && oldEnoughForProviderReversal)) {
      throw error;
    }
    return Boolean(await dependencies.storage.markOrderPaymentFailed?.(local.id));
  }

  if (!isPayPalOrderBindingValid(providerOrder, local) || providerOrder.status !== "VOIDED") {
    return false;
  }
  return Boolean(await dependencies.storage.markOrderPaymentFailed?.(local.id));
}

export async function handlePayPalWebhook(
  req: PayPalWebhookRequest,
  res: PayPalWebhookResponse,
  dependencies: PayPalReconciliationDependencies & {
    verifyWebhook?: typeof verifyPayPalWebhook;
  },
  requestId = crypto.randomUUID().slice(0, 12),
): Promise<void> {
  const event = req.body;
  if (!event || typeof event !== "object" || typeof (event as PayPalWebhookEvent).event_type !== "string") {
    res.status(400).json({ message: "Malformed PayPal webhook" });
    return;
  }
  try {
    const verifyWebhook = dependencies.verifyWebhook || verifyPayPalWebhook;
    const verified = await verifyWebhook({ headers: req.headers, event: event as PayPalWebhookEvent, requestId });
    if (!verified) {
      res.status(401).json({ message: "PayPal webhook verification failed" });
      return;
    }
  } catch (error) {
    console.error(`[PayPal ${requestId}] webhook verification error:`, error instanceof Error ? error.message : "unknown error");
    res.status(503).json({ message: "PayPal webhook verification unavailable" });
    return;
  }
  const webhookEvent = event as PayPalWebhookEvent;
  const failedEvent = webhookEvent.event_type === "CHECKOUT.ORDER.VOIDED" ||
    webhookEvent.event_type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED" ||
    webhookEvent.event_type === "PAYMENT.CAPTURE.DENIED";
  if (!failedEvent &&
      webhookEvent.event_type !== "CHECKOUT.ORDER.APPROVED" &&
      webhookEvent.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    res.sendStatus(200);
    return;
  }
  const providerOrderId = paypalWebhookOrderId(webhookEvent);
  if (!providerOrderId) {
    res.status(400).json({ message: "PayPal webhook has no order ID" });
    return;
  }
  try {
    if (failedEvent) {
      const localOrder = await dependencies.storage.getOrderByPaymentProviderOrderId(providerOrderId);
      if (localOrder) {
        if (webhookEvent.event_type === "CHECKOUT.ORDER.VOIDED" ||
            webhookEvent.event_type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
          // Signed provider events explicitly indicate that the checkout
          // can no longer be paid. Capture-denied alone is not terminal.
          await dependencies.storage.markOrderPaymentFailed?.(localOrder.id);
        } else {
          await expirePayPalOrderIfProviderConfirms(providerOrderId, requestId, dependencies);
        }
      }
    } else {
      await reconcilePayPalPayment(providerOrderId, requestId, dependencies);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error(`[PayPal ${requestId}] webhook finalization failed:`, error instanceof Error ? error.message : "unknown error");
    res.status(503).json({ message: "PayPal payment reconciliation unavailable" });
  }
}

export function isAllowedPayPalApprovalUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com") ||
       url.hostname === "paypalobjects.com" || url.hostname.endsWith(".paypalobjects.com"));
  } catch { return false; }
}

export function paypalCreateRequestId(publicOrderRef: string, orderId: number): string {
  return `xhaccp-create-${publicOrderRef || orderId}`;
}

export function paypalCaptureRequestId(providerOrderId: string): string {
  return `xhaccp-capture-${providerOrderId}`;
}

export function completedPayPalCapture(order: PayPalOrder) {
  const capture = order.purchase_units?.flatMap(unit => unit.payments?.captures || [])
    .find(item => item.status === "COMPLETED");
  return order.status === "COMPLETED" && capture?.id ? capture : undefined;
}

export function isPayPalOrderBindingValid(order: PayPalOrder, local: {
  id: number; paymentProviderOrderId?: string | null; paymentMethod: string | null;
  market: string | null; currency: string | null; totalAmount: string | number;
}) {
  const unit = order.purchase_units?.[0];
  return !!unit && local.paymentMethod === "paypal" && local.market === "fr" &&
    local.currency === "EUR" && local.paymentProviderOrderId === order.id &&
    unit.custom_id === String(local.id) && unit.invoice_id === `xhaccp-${local.id}` &&
    unit.amount?.currency_code === "EUR" &&
    Number.isFinite(Number(unit.amount.value)) &&
    Number(unit.amount.value).toFixed(2) === Number(local.totalAmount).toFixed(2);
}

function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("PayPal payment configuration is incomplete");
  return { clientId, clientSecret };
}

async function accessToken(): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("PayPal authentication failed");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("PayPal authentication returned no access token");
  return body.access_token;
}

async function paypalRequest<T>(path: string, init: RequestInit, requestId: string): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${PAYPAL_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "PayPal-Request-Id": requestId,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    // Do not return PayPal response bodies: they may contain sensitive request metadata.
    throw new PayPalApiError(response.status);
  }
  return await response.json() as T;
}

export async function verifyPayPalWebhook(input: {
  headers: Record<string, string | string[] | undefined>;
  event: PayPalWebhookEvent;
  requestId: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) throw new Error("PayPal webhook configuration is incomplete");
  const headers = paypalWebhookHeaders(input.headers);
  if (Object.values(headers).some(value => !value)) return false;
  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({ auth_algo: headers.auth_algo, cert_url: headers.cert_url,
      transmission_id: headers.transmission_id, transmission_sig: headers.transmission_sig,
      transmission_time: headers.transmission_time, webhook_id: webhookId, webhook_event: input.event }),
  }, input.requestId);
  return result.verification_status === "SUCCESS";
}

export async function createPayPalOrder(input: {
  amount: string;
  returnUrl: string;
  cancelUrl: string;
  orderId: number;
  requestId: string;
}): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: `xhaccp-${input.orderId}`,
        custom_id: String(input.orderId),
        invoice_id: `xhaccp-${input.orderId}`,
        amount: { currency_code: "EUR", value: input.amount },
      }],
      application_context: {
        brand_name: "xHACCP",
        user_action: "PAY_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  }, input.requestId);
}

export function paypalApprovalUrl(order: PayPalOrder): string | undefined {
  const value = order.links?.find(link => link.rel === "approve")?.href;
  return isAllowedPayPalApprovalUrl(value) ? value : undefined;
}

export async function getPayPalOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" }, requestId);
}

export async function capturePayPalOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" }, requestId);
}