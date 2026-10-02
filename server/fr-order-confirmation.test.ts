import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://fr-order-email-test.invalid/test";
const { sendFrenchOrderConfirmationEmails } = await import("./fr-order-confirmation.js");

function frenchOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    market: "fr",
    userId: null,
    paymentMethod: "paypal",
    totalAmount: "42.00",
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
    shippingAddress: {
      firstName: "Test",
      lastName: "Customer",
      email: "customer@example.invalid",
      phone: "+33123456789",
    },
    billingAddress: {},
    items: [],
    ...overrides,
  } as any;
}

test("French paid-order confirmation is sent to the customer and French company address", async () => {
  const order = frenchOrder();
  const sent: Array<{ kind: string; order: unknown; user: any; recipient?: string; method?: string }> = [];

  const result = await sendFrenchOrderConfirmationEmails(42, {
    getOrder: async () => order,
    getCompanyEmail: async () => "fr-operations@example.invalid",
    sendCustomerConfirmation: async (sentOrder, user, paymentMethod) => {
      sent.push({ kind: "customer", order: sentOrder, user, method: paymentMethod });
      return true;
    },
    sendCompanyNotification: async (sentOrder, user, recipient) => {
      sent.push({ kind: "company", order: sentOrder, user, recipient });
      return true;
    },
  });

  assert.deepEqual(result, { customer: "sent", company: "sent" });
  assert.deepEqual(sent.map(email => email.kind).sort(), ["company", "customer"]);
  assert.equal(sent[0].order, order);
  assert.equal(sent[0].user.email, "customer@example.invalid");
  assert.equal(sent.find(email => email.kind === "company")?.recipient, "fr-operations@example.invalid");
  assert.equal(sent.find(email => email.kind === "customer")?.method, "paypal");
});

test("French customer and company notifications are attempted independently", async () => {
  let companyNotified = false;
  const result = await sendFrenchOrderConfirmationEmails(42, {
    getOrder: async () => frenchOrder(),
    getCompanyEmail: async () => "fr-operations@example.invalid",
    sendCustomerConfirmation: async () => false,
    sendCompanyNotification: async () => {
      companyNotified = true;
      return true;
    },
  });

  assert.deepEqual(result, { customer: "failed", company: "sent" });
  assert.equal(companyNotified, true);
});

test("French notifications are skipped for non-French orders", async () => {
  let sends = 0;
  const result = await sendFrenchOrderConfirmationEmails(42, {
    getOrder: async () => frenchOrder({ market: "ro" }),
    getCompanyEmail: async () => "fr-operations@example.invalid",
    sendCustomerConfirmation: async () => { sends++; return true; },
    sendCompanyNotification: async () => { sends++; return true; },
  });

  assert.deepEqual(result, { customer: "not_ready", company: "not_ready" });
  assert.equal(sends, 0);
});

test("French guest order uses the checkout email when building the confirmation recipient", async () => {
  let recipient = "";
  await sendFrenchOrderConfirmationEmails(42, {
    getOrder: async () => frenchOrder({
      shippingAddress: { firstName: "Guest", lastName: "Buyer" },
      billingAddress: { email: "billing@example.invalid" },
    }),
    getCompanyEmail: async () => null,
    sendCustomerConfirmation: async (_order, user) => {
      recipient = user.email;
      return true;
    },
  });

  assert.equal(recipient, "billing@example.invalid");
});