import test from "node:test";
import assert from "node:assert/strict";
import { buildPayPalCreateRequest, completePayPalOrder, isPayPalOrderForLocalOrder, type PayPalOrder } from "./paypal";

const fullOrder: PayPalOrder = {
  id: "provider-order", status: "CREATED",
  purchase_units: [{ custom_id: "42", invoice_id: "xhaccp-42", amount: { currency_code: "EUR", value: "85.20" } }],
  links: [{ rel: "approve", href: "https://www.paypal.com/checkoutnow?token=provider-order" }],
};
const localOrder = { id: 42, paymentMethod: "paypal", market: "fr", currency: "EUR", totalAmount: "85.20" };

test("create requests explicitly ask PayPal for a complete representation", () => {
  const init = buildPayPalCreateRequest({
    orderId: 42, amount: "85.20", requestId: "stable-request",
    returnUrl: "https://xhaccp.fr/callback", cancelUrl: "https://xhaccp.fr/cancel",
  });
  assert.equal(new Headers(init.headers).get("Prefer"), "return=representation");
  assert.equal(init.method, "POST");
  const payload = JSON.parse(String(init.body));
  assert.equal(payload.purchase_units[0].custom_id, "42");
  assert.equal(payload.purchase_units[0].amount.currency_code, "EUR");
});

test("minimal create and replay responses are enriched by a read of the same provider ID", async () => {
  let reads = 0;
  const result = await completePayPalOrder({ id: fullOrder.id, status: "CREATED", links: fullOrder.links },
    "stable-request", async (id, requestId) => {
      reads++;
      assert.equal(id, fullOrder.id);
      assert.equal(requestId, "stable-request");
      return fullOrder;
    });
  assert.equal(reads, 1);
  assert.ok(isPayPalOrderForLocalOrder(result, localOrder));
});

test("complete representations do not incur another read", async () => {
  const result = await completePayPalOrder(fullOrder, "stable-request", async () => {
    assert.fail("should not perform a second read");
  });
  assert.equal(result, fullOrder);
});

test("enrichment does not bypass currency, amount or ownership checks", async () => {
  for (const unit of [
    { custom_id: "43", invoice_id: "xhaccp-42", amount: { currency_code: "EUR", value: "85.20" } },
    { custom_id: "42", invoice_id: "xhaccp-42", amount: { currency_code: "RON", value: "85.20" } },
    { custom_id: "42", invoice_id: "xhaccp-42", amount: { currency_code: "EUR", value: "85.21" } },
  ]) {
    const result = await completePayPalOrder({ id: fullOrder.id }, "stable-request",
      async () => ({ ...fullOrder, purchase_units: [unit] }));
    assert.equal(isPayPalOrderForLocalOrder(result, localOrder), false);
  }
});

test("unrelated lookup IDs and missing IDs are rejected", async () => {
  await assert.rejects(completePayPalOrder({ id: fullOrder.id }, "stable-request",
    async () => ({ ...fullOrder, id: "different-order" })), /different order ID/);
  await assert.rejects(completePayPalOrder({ id: "" }, "stable-request"), /no order ID/);
});

test("failed detail reads remain failures without creating another checkout", async () => {
  let reads = 0;
  await assert.rejects(completePayPalOrder({ id: fullOrder.id }, "stable-request", async () => {
    reads++;
    throw new Error("read failed");
  }), /read failed/);
  assert.equal(reads, 1);
});
