import test from "node:test";
import assert from "node:assert/strict";
import {
  completedPayPalCapture,
  handlePayPalWebhook,
  isAllowedPayPalApprovalUrl,
  isPayPalOrderBindingValid,
  paypalCaptureRequestId,
  paypalCreateRequestId,
  paypalWebhookHeaders,
  paypalWebhookOrderId,
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
  assert.equal(isPayPalOrderBindingValid(remote, order), true);
  assert.equal(isPayPalOrderBindingValid({ ...remote, id: "P-2" }, order), false);
  assert.equal(isPayPalOrderBindingValid({ ...remote, purchase_units: [{ ...remote.purchase_units[0], amount: { currency_code: "USD", value: "12.30" } }] }, order), false);
});

test("completed capture extraction supports callback replay without recapture", () => {
  const order = { id: "P-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "C-1", status: "COMPLETED" }] } }] };
  assert.equal(completedPayPalCapture(order)?.id, "C-1");
  assert.equal(completedPayPalCapture({ ...order, status: "APPROVED" }) , undefined);
});

test("PayPal idempotency keys are stable", () => {
  assert.equal(paypalCreateRequestId("ord_abc", 7), paypalCreateRequestId("ord_abc", 7));
  assert.equal(paypalCaptureRequestId("P-1"), "xhaccp-capture-P-1");
});

test("PayPal webhook headers and order ids use signed transmission fields", () => {
  const headers = paypalWebhookHeaders({
    "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-transmission-id": "t-1", "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "now",
  });
  assert.equal(headers.transmission_id, "t-1");
  assert.equal(paypalWebhookOrderId({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "P-1" } }), "P-1");
  assert.equal(paypalWebhookOrderId({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { supplementary_data: { related_ids: { order_id: "P-1" } } } }), "P-1");
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

function reconciliationDependencies() {
  const local: PayPalLocalOrder = {
    id: 42,
    paymentProviderOrderId: "P-1",
    paymentMethod: "paypal",
    market: "fr",
    currency: "EUR",
    totalAmount: "12.30",
    shippingAddress: { email: "customer@example.invalid" },
    billingAddress: {},
  };
  let paymentStatus = "pending";
  let paymentTransactionId: string | undefined;
  let invoiceCount = 0;
  let emailCount = 0;
  let captureCount = 0;
  const dependencies = {
    storage: {
      async getOrderByPaymentProviderOrderId() {
        return local;
      },
      async updateOrder(_id: number, update: { paymentTransactionId: string }) {
        paymentTransactionId = update.paymentTransactionId;
      },
      async markOrderPaid() {
        if (paymentStatus === "paid") return null;
        paymentStatus = "paid";
        return local;
      },
      async getOrder() {
        return local;
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
          return { id: 7, invoiceNumber: "INV-7" };
        },
        async getInvoicePdf() {
          return Buffer.from("pdf");
        },
      };
    },
    async sendInvoiceEmailFr() {
      emailCount++;
    },
  };
  return {
    dependencies,
    counts: () => ({ paymentStatus, paymentTransactionId, invoiceCount, emailCount, captureCount }),
  };
}

test("verified PayPal webhook reconciles a completed capture after the browser callback is lost", async () => {
  const { dependencies, counts } = reconciliationDependencies();
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
    emailCount: 1,
    captureCount: 0,
  });
});

test("repeated verified PayPal webhooks produce one paid transition, invoice, and email", async () => {
  const { dependencies, counts } = reconciliationDependencies();
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
    emailCount: 1,
    captureCount: 0,
  });
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
    emailCount: 0,
    captureCount: 0,
  });
});