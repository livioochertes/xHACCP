import test from "node:test";
import assert from "node:assert/strict";
import {
  completedPayPalCapture,
  createPayPalOrderWithRecovery,
  expirePayPalOrderIfProviderConfirms,
  handlePayPalWebhook,
  isAllowedPayPalApprovalUrl,
  isPayPalOrderForLocalOrder,
  isPayPalOrderBindingValid,
  PayPalApiError,
  PayPalCreateOutcomeUnknownError,
  paypalCaptureRequestId,
  paypalCreateRequestId,
  paypalWebhookHeaders,
  paypalWebhookOrderId,
  reconcilePayPalPayment,
  type PayPalLocalOrder,
} from "./paypal";

test("PayPal approval URL allowlist only accepts HTTPS PayPal hosts", () => {
  assert.equal(isAllowedPayPalApprovalUrl("https://www.paypal.com/checkoutnow?token=x"), true);
  assert.equal(isAllowedPayPalApprovalUrl("https://www.paypalobjects.com/checkout"), true);
  assert.equal(isAllowedPayPalApprovalUrl("http://www.paypal.com/checkout"), false);
  assert.equal(isAllowedPayPalApprovalUrl("https://evil.example/paypal"), false);
});

test("PayPal binding validates provider id, amount and currency", () => {
  const order = {
    id: 42, paymentProviderOrderId: "P-1", paymentMethod: "paypal",
    market: "fr", currency: "EUR", totalAmount: "12.30",
  };
  const remote = { id: "P-1", purchase_units: [{ custom_id: "42", invoice_id: "xhaccp-42", amount: { currency_code: "EUR", value: "12.30" } }] };
  assert.equal(isPayPalOrderForLocalOrder(remote, { ...order, paymentProviderOrderId: null }), true);
  assert.equal(isPayPalOrderBindingValid(remote, order), true);
  assert.equal(isPayPalOrderBindingValid({ ...remote, id: "P-2" }, order), false);
  assert.equal(isPayPalOrderForLocalOrder({ ...remote, id: "P-2" }, order), true);
  assert.equal(isPayPalOrderBindingValid({ ...remote, purchase_units: [{ ...remote.purchase_units[0], amount: { currency_code: "USD", value: "12.30" } }] }, order), false);
  assert.equal(isPayPalOrderForLocalOrder({ ...remote, purchase_units: [{ ...remote.purchase_units[0], amount: { currency_code: "USD", value: "12.30" } }] }, order), false);
});

test("completed capture extraction supports callback replay without recapture", () => {
  const order = { id: "P-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "C-1", status: "COMPLETED" }] } }] };
  assert.equal(completedPayPalCapture(order)?.id, "C-1");
  assert.equal(completedPayPalCapture({ ...order, status: "APPROVED" }) , undefined);
});

test("PayPal idempotency keys are stable", () => {
  assert.equal(paypalCreateRequestId("ord_abc", 7), paypalCreateRequestId("ord_abc", 7));
  assert.equal(paypalCreateRequestId("ord_changed", 7), paypalCreateRequestId("ord_abc", 7));
  assert.equal(paypalCreateRequestId("ord_abc", 7).length <= 38, true);
  assert.notEqual(paypalCreateRequestId("ord_abc", 7), paypalCreateRequestId("ord_def", 8));
  assert.equal(paypalCaptureRequestId("P-1"), "xhaccp-capture-P-1");
});

const paypalCreateInput = {
  amount: "12.30",
  returnUrl: "https://xhaccp.fr/api/payments/paypal/callback",
  cancelUrl: "https://xhaccp.fr/api/payments/paypal/callback?cancel=1",
  orderId: 42,
  requestId: paypalCreateRequestId("fr-paypal-42", 42),
};

function createdPayPalOrder(id = "P-1") {
  return {
    id,
    status: "CREATED",
    purchase_units: [{
      custom_id: String(paypalCreateInput.orderId),
      invoice_id: `xhaccp-${paypalCreateInput.orderId}`,
      amount: { currency_code: "EUR", value: paypalCreateInput.amount },
    }],
    links: [{ href: "https://www.paypal.com/checkoutnow?token=P-1", rel: "approve" }],
  };
}

test("PayPal create retries with the same key when the request fails before acceptance", async () => {
  let attempts = 0;
  const requestIds: string[] = [];

  const result = await createPayPalOrderWithRecovery(paypalCreateInput, async (input) => {
    attempts++;
    requestIds.push(input.requestId);
    if (attempts === 1) throw new TypeError("network failed before provider acceptance");
    return createdPayPalOrder();
  });

  assert.equal(attempts, 2);
  assert.deepEqual(requestIds, [paypalCreateInput.requestId, paypalCreateInput.requestId]);
  assert.equal(result.id, "P-1");
});

test("PayPal create recovers the accepted checkout after its response is lost", async () => {
  let attempts = 0;
  let createdCount = 0;
  const idempotentResponses = new Map<string, ReturnType<typeof createdPayPalOrder>>();

  const result = await createPayPalOrderWithRecovery(paypalCreateInput, async (input) => {
    attempts++;
    const previous = idempotentResponses.get(input.requestId);
    if (previous) return previous;

    const accepted = createdPayPalOrder();
    idempotentResponses.set(input.requestId, accepted);
    createdCount++;
    if (attempts === 1) throw new TypeError("response lost after provider acceptance");
    return accepted;
  });

  assert.equal(attempts, 2);
  assert.equal(createdCount, 1);
  assert.equal(result.id, "P-1");

  const local = {
    id: 42,
    paymentProviderOrderId: null as string | null,
    paymentMethod: "paypal",
    market: "fr",
    currency: "EUR",
    totalAmount: "12.30",
  };
  assert.equal(isPayPalOrderForLocalOrder(result, local), true);
  local.paymentProviderOrderId = result.id;
  assert.equal(isPayPalOrderBindingValid(result, local), true);
});

test("PayPal create keeps an uncertain result pending and does not retry definitive rejection", async () => {
  let attempts = 0;
  await assert.rejects(
    createPayPalOrderWithRecovery(paypalCreateInput, async () => {
      attempts++;
      throw new TypeError("response unavailable");
    }),
    PayPalCreateOutcomeUnknownError,
  );
  assert.equal(attempts, 2);

  attempts = 0;
  await assert.rejects(
    createPayPalOrderWithRecovery(paypalCreateInput, async () => {
      attempts++;
      throw new PayPalApiError(422);
    }),
    PayPalApiError,
  );
  assert.equal(attempts, 1);
});

test("PayPal webhook headers and order ids use signed transmission fields", () => {
  const headers = paypalWebhookHeaders({
    "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-transmission-id": "t-1", "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "now",
  });
  assert.equal(headers.transmission_id, "t-1");
  assert.equal(paypalWebhookOrderId({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "P-1" } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "CHECKOUT.ORDER.VOIDED", resource: { id: "P-1" } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "CHECKOUT.PAYMENT-APPROVAL.REVERSED", resource: { id: "P-1" } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { supplementary_data: { related_ids: { order_id: "P-1" } } } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.DENIED", resource: { supplementary_data: { related_ids: { order_id: "P-1" } } } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "C-1" } }), undefined);
});

function webhookResponse() {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    sendStatus(code: number) {
      response.statusCode = code;
      return response;
    },
  };
  return response;
}

function completedRemoteOrder() {
  return {
    id: "P-1",
    status: "COMPLETED",
    purchase_units: [{
      custom_id: "42",
      invoice_id: "xhaccp-42",
      amount: { currency_code: "EUR", value: "12.30" },
      payments: { captures: [{ id: "C-1", status: "COMPLETED" }] },
    }],
  };
}

let frenchNotifierModule: typeof import("./fr-order-notification.js") | undefined;

async function sendRealFrenchOrderDocumentsEmail(
  orderId: number,
  dependencies: Parameters<typeof import("./fr-order-notification.js")["sendFrenchOrderDocumentsEmail"]>[1],
) {
  if (!frenchNotifierModule) {
    process.env.DATABASE_URL ||= "postgresql://paypal-test.invalid/test";
    frenchNotifierModule = await import("./fr-order-notification.js");
  }
  return frenchNotifierModule.sendFrenchOrderDocumentsEmail(orderId, dependencies);
}

function reconciliationDependencies(sendResults: boolean[] = [true]) {
  const local: PayPalLocalOrder = {
    id: 42,
    paymentProviderOrderId: "P-1",
    paymentMethod: "paypal",
    market: "fr",
    currency: "EUR",
    totalAmount: "12.30",
    shippingAddress: { email: "customer@example.invalid" },
    billingAddress: {},
    items: [],
  };
  const localWithShipping = local as PayPalLocalOrder & {
    publicOrderRef: string;
    awbNumber?: string;
    awbCourier?: string;
    awbTrackingUrl?: string;
  };
  localWithShipping.publicOrderRef = "fr-paypal-42";
  let paymentStatus = "pending";
  let paymentTransactionId: string | undefined;
  let invoiceCount = 0;
  let awbCount = 0;
  let orderConfirmationCount = 0;
  let notificationCount = 0;
  let captureCount = 0;
  let issuedInvoice: { id: number; invoiceNumber: string } = { id: 7, invoiceNumber: "INV-FR-7" };
  let invoiceEmailClaimed = false;
  let deliveryAttempts = 0;
  const sentEmails: any[] = [];
  const sideEffects: string[] = [];
  const dependencies = {
    storage: {
      async getOrderByPaymentProviderOrderId() {
        localWithShipping.paymentStatus = paymentStatus;
        localWithShipping.paymentTransactionId = paymentTransactionId;
        return localWithShipping;
      },
      async updateOrder(_id: number, update: { paymentTransactionId: string }) {
        paymentTransactionId = update.paymentTransactionId;
      },
      async markOrderPaid(_id: number, transactionId?: string) {
        if (paymentStatus !== "pending") return null;
        paymentStatus = "paid";
        paymentTransactionId = transactionId;
        localWithShipping.paymentStatus = "paid";
        localWithShipping.paymentTransactionId = transactionId;
        return local;
      },
      async markOrderPaymentFailed() {
        if (paymentStatus !== "pending") return null;
        paymentStatus = "failed";
        localWithShipping.paymentStatus = "failed";
        return local;
      },
      async getOrder() {
        return localWithShipping;
      },
    },
    async getPayPalOrder() {
      return completedRemoteOrder();
    },
    async capturePayPalOrder() {
      captureCount++;
      return completedRemoteOrder();
    },
    async getInvoiceService() {
      return {
        async generateInvoiceAfterPayment() {
          invoiceCount++;
          sideEffects.push("invoice");
          issuedInvoice = { id: 7, invoiceNumber: "INV-FR-7" };
          return { id: 7, invoiceNumber: "INV-7" };
        },
        async getInvoicePdf() {
          return Buffer.from("pdf");
        },
      };
    },
    async ensureFrenchOrderAwb(orderId: number) {
      assert.equal(orderId, 42);
      awbCount++;
      sideEffects.push("awb");
      localWithShipping.awbNumber = "MFB-FR-42";
      localWithShipping.awbCourier = "MyFlyingBox";
      localWithShipping.awbTrackingUrl = "https://xhaccp.fr/tracking/fr-paypal-42";
    },
    async sendFrenchOrderConfirmationEmails(orderId: number) {
      assert.equal(orderId, 42);
      orderConfirmationCount++;
      sideEffects.push("order_confirmation");
    },
    async sendFrenchOrderDocumentsEmail(orderId: number) {
      assert.equal(orderId, 42);
      notificationCount++;
      sideEffects.push("notification");
      return sendRealFrenchOrderDocumentsEmail(orderId, {
        getOrder: async () => localWithShipping,
        getIssuedInvoice: async () => issuedInvoice,
        getInvoicePdf: async (invoiceId) => {
          assert.equal(invoiceId, 7);
          return Buffer.from("invoice-pdf");
        },
        claimInvoiceEmail: async (invoiceId) => {
          assert.equal(invoiceId, 7);
          if (invoiceEmailClaimed) return undefined;
          invoiceEmailClaimed = true;
          return issuedInvoice;
        },
        resetInvoiceEmailClaim: async (invoiceId) => {
          assert.equal(invoiceId, 7);
          invoiceEmailClaimed = false;
        },
        getAwbPdf: async (awbNumber) => {
          assert.equal(awbNumber, "MFB-FR-42");
          return Buffer.from("awb-pdf");
        },
        sendEmail: async (email) => {
          deliveryAttempts++;
          const sent = sendResults[deliveryAttempts - 1] ?? sendResults.at(-1) ?? false;
          if (sent) sentEmails.push(email);
          return sent;
        },
      });
    },
  };
  return {
    dependencies,
    order: localWithShipping,
    sentEmails,
    state: () => ({ invoiceEmailClaimed, deliveryAttempts }),
    counts: () => ({ paymentStatus, paymentTransactionId, invoiceCount, awbCount, orderConfirmationCount, notificationCount, captureCount, sideEffects }),
  };
}

test("verified PayPal webhook reconciles a completed capture after the browser callback is lost", async () => {
  const { dependencies, counts, sentEmails } = reconciliationDependencies();
  const response = webhookResponse();

  await handlePayPalWebhook(
    {
      headers: { "paypal-transmission-id": "t-1" },
      body: {
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { supplementary_data: { related_ids: { order_id: "P-1" } } },
      },
    },
    response,
    { ...dependencies, verifyWebhook: async () => true },
    "webhook-1",
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(counts(), {
    paymentStatus: "paid",
    paymentTransactionId: "C-1",
    invoiceCount: 1,
    awbCount: 1,
    orderConfirmationCount: 1,
    notificationCount: 1,
    captureCount: 0,
    sideEffects: ["order_confirmation", "invoice", "awb", "notification"],
  });
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "customer@example.invalid");
  assert.match(sentEmails[0].text, /MFB-FR-42/);
  assert.match(sentEmails[0].text, /MyFlyingBox/);
  assert.match(sentEmails[0].text, /https:\/\/xhaccp\.fr\/tracking\/fr-paypal-42/);
  assert.deepEqual(
    sentEmails[0].attachments.map((attachment: { filename: string; content: string }) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, "base64").toString(),
    })),
    [
      { filename: "Facture_xHACCP_INV_FR_7.pdf", content: "invoice-pdf" },
      { filename: "AWB_MFB-FR-42.pdf", content: "awb-pdf" },
    ],
  );
});

test("repeated verified PayPal webhooks produce one paid transition, invoice, and email", async () => {
  const { dependencies, counts, sentEmails } = reconciliationDependencies();
  const requests = () => ({
    headers: { "paypal-transmission-id": "t-1" },
    body: {
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "P-1" },
    },
  });

  const responses = [webhookResponse(), webhookResponse()];
  await Promise.all([
    handlePayPalWebhook(requests(), responses[0], { ...dependencies, verifyWebhook: async () => true }, "webhook-1"),
    handlePayPalWebhook(requests(), responses[1], { ...dependencies, verifyWebhook: async () => true }, "webhook-2"),
  ]);

  assert.equal(responses[0].statusCode, 200);
  assert.equal(responses[1].statusCode, 200);
  assert.deepEqual(counts(), {
    paymentStatus: "paid",
    paymentTransactionId: "C-1",
    invoiceCount: 1,
    awbCount: 1,
    orderConfirmationCount: 1,
    notificationCount: 1,
    captureCount: 0,
    sideEffects: ["order_confirmation", "invoice", "awb", "notification"],
  });
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].text, /https:\/\/xhaccp\.fr\/tracking\/fr-paypal-42/);
});

test("failed French invoice delivery releases its claim for a successful retry", async () => {
  const { dependencies, order, sentEmails, state } = reconciliationDependencies([false, true]);
  order.awbNumber = "MFB-FR-42";
  order.awbCourier = "MyFlyingBox";
  order.awbTrackingUrl = "https://xhaccp.fr/tracking/fr-paypal-42";

  const firstAttempt = await dependencies.sendFrenchOrderDocumentsEmail(42);

  assert.equal(firstAttempt, "failed");
  assert.deepEqual(state(), { invoiceEmailClaimed: false, deliveryAttempts: 1 });
  assert.equal(sentEmails.length, 0);

  const secondAttempt = await dependencies.sendFrenchOrderDocumentsEmail(42);

  assert.equal(secondAttempt, "sent");
  assert.deepEqual(state(), { invoiceEmailClaimed: true, deliveryAttempts: 2 });
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "customer@example.invalid");
  assert.match(sentEmails[0].text, /Facture N° INV-FR-7/);
  assert.match(sentEmails[0].text, /https:\/\/xhaccp\.fr\/tracking\/fr-paypal-42/);
  assert.deepEqual(
    sentEmails[0].attachments.map((attachment: { filename: string; content: string }) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, "base64").toString(),
    })),
    [
      { filename: "Facture_xHACCP_INV_FR_7.pdf", content: "invoice-pdf" },
      { filename: "AWB_MFB-FR-42.pdf", content: "awb-pdf" },
    ],
  );
});

test("invalid PayPal webhook signatures never change the order", async () => {
  const { dependencies, counts } = reconciliationDependencies();
  const response = webhookResponse();

  await handlePayPalWebhook(
    {
      headers: { "paypal-transmission-id": "tampered" },
      body: {
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { supplementary_data: { related_ids: { order_id: "P-1" } } },
      },
    },
    response,
    {
      ...dependencies,
      verifyWebhook: async () => false,
    },
    "webhook-invalid",
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(counts(), {
    paymentStatus: "pending",
    paymentTransactionId: undefined,
    invoiceCount: 0,
    awbCount: 0,
    orderConfirmationCount: 0,
    notificationCount: 0,
    captureCount: 0,
    sideEffects: [],
  });
});

test("a PayPal capture-denied event alone does not release a still-payable order", async () => {
  const { dependencies, counts } = reconciliationDependencies();
  const response = webhookResponse();

  await handlePayPalWebhook(
    {
      headers: { "paypal-transmission-id": "t-failed" },
      body: {
        event_type: "PAYMENT.CAPTURE.DENIED",
        resource: {
          supplementary_data: { related_ids: { order_id: "P-1" } },
        },
      },
    },
    response,
    { ...dependencies, verifyWebhook: async () => true },
    "webhook-failed",
  );

  assert.equal(response.statusCode, 200);
  assert.equal(counts().paymentStatus, "pending");
  assert.equal(counts().invoiceCount, 0);
});

test("verified PayPal void events release the pending order voucher hold idempotently", async () => {
  const { dependencies, counts } = reconciliationDependencies();
  const request = () => ({
    headers: { "paypal-transmission-id": "t-voided" },
    body: { event_type: "CHECKOUT.ORDER.VOIDED", resource: { id: "P-1" } },
  });
  const first = webhookResponse();
  const second = webhookResponse();

  await handlePayPalWebhook(request(), first, { ...dependencies, verifyWebhook: async () => true }, "webhook-voided-1");
  await handlePayPalWebhook(request(), second, { ...dependencies, verifyWebhook: async () => true }, "webhook-voided-2");

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(counts().paymentStatus, "failed");
  assert.equal(counts().invoiceCount, 0);
});

test("PayPal expiry reconciliation requires a provider-confirmed terminal status", async () => {
  const local: PayPalLocalOrder = {
    id: 42,
    paymentProviderOrderId: "P-1",
    paymentMethod: "paypal",
    paymentStatus: "pending",
    market: "fr",
    currency: "EUR",
    totalAmount: "12.30",
    createdAt: new Date("2026-10-07T00:00:00.000Z"),
  };
  let failedCount = 0;
  const storage = {
    async getOrderByPaymentProviderOrderId() { return local; },
    async markOrderPaymentFailed() {
      if (local.paymentStatus !== "pending") return null;
      local.paymentStatus = "failed";
      failedCount++;
      return local;
    },
    async markOrderPaid() { return null; },
    async getOrder() { return local; },
  };

  const voided = await expirePayPalOrderIfProviderConfirms("P-1", "expiry-test", {
    storage,
    getPayPalOrder: async () => ({ ...completedRemoteOrder(), status: "VOIDED" }),
  }, new Date("2026-10-07T04:00:00.000Z"));
  assert.equal(voided, true);
  assert.equal(failedCount, 1);

  local.paymentStatus = "pending";
  const stillPayable = await expirePayPalOrderIfProviderConfirms("P-1", "expiry-test", {
    storage,
    getPayPalOrder: async () => ({ ...completedRemoteOrder(), status: "APPROVED" }),
  }, new Date("2026-10-07T04:00:00.000Z"));
  assert.equal(stillPayable, false);
  assert.equal(failedCount, 1);

  const reversed404 = await expirePayPalOrderIfProviderConfirms("P-1", "expiry-test", {
    storage,
    getPayPalOrder: async () => { throw new PayPalApiError(404); },
  }, new Date("2026-10-07T04:00:00.000Z"));
  assert.equal(reversed404, true);
  assert.equal(failedCount, 2);
});

test("late PayPal success cannot revive a locally failed order", async () => {
  const { dependencies, counts } = reconciliationDependencies();
  await dependencies.storage.markOrderPaymentFailed(42);

  const result = await reconcilePayPalPayment("P-1", "late-success", dependencies);

  assert.equal(result, null);
  assert.equal(counts().paymentStatus, "failed");
  assert.equal(counts().paymentTransactionId, undefined);
  assert.equal(counts().invoiceCount, 0);
  assert.equal(counts().captureCount, 0);
});