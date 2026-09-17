import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPennylaneProductPayload,
  buildPennylaneCustomerPayload,
  buildPennylaneInvoicePayload,
  PennylaneClient,
  PennylaneError,
  createPennylaneHttpTransport,
  pennylaneCustomerReference,
  pennylaneExternalReference,
  pennylaneProductExternalReference,
  type PennylaneTransport,
} from "./pennylane-api.js";

class FakeTransport implements PennylaneTransport {
  calls: Array<{ method: string; path: string; body?: unknown; headers?: Record<string, string> }> = [];
  responses: unknown[] = [];
  async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ method, path, body, headers });
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  }
  async download(): Promise<Buffer> {
    return Buffer.from("%PDF-test");
  }
}

test("external references are deterministic and do not expose customer data", () => {
  assert.equal(pennylaneExternalReference(42), "xhaccp-fr-order-42");
  const reference = pennylaneCustomerReference({ email: " Customer@Example.com " });
  assert.match(reference, /^xhaccp-fr-customer-[a-f0-9]{32}$/);
  assert.ok(!reference.includes("customer@example.com"));
});

test("customer upsert searches by external reference before creating", async () => {
  const transport = new FakeTransport();
  transport.responses.push({ data: [{ id: "customer-1", email: "buyer@example.com" }] });
  const client = new PennylaneClient(transport);
  const customer = await client.findOrCreateCustomer("stable-customer-ref", {
    external_reference: "stable-customer-ref",
    name: "Buyer",
  });
  assert.equal(customer.id, "customer-1");
  assert.equal(transport.calls.length, 1);
  assert.deepEqual(JSON.parse(decodeURIComponent(transport.calls[0].path.split("filter=")[1])), [{
    field: "external_reference",
    operator: "eq",
    value: "stable-customer-ref",
  }]);
});

test("product sync lists remote products and updates an existing deterministic mapping", async () => {
  const transport = new FakeTransport();
  transport.responses.push({
    items: [{ id: "product-1", external_reference: "xhaccp-fr-product-42" }],
    next_cursor: null,
  });
  transport.responses.push({ data: { id: "product-1", external_reference: "xhaccp-fr-product-42" } });
  const client = new PennylaneClient(transport);
  const products = await client.listProducts();
  const payload = buildPennylaneProductPayload({
    market: "fr",
    productId: 42,
    label: "Thermomètre",
    description: "Description",
    priceBeforeTax: 100,
    vatRate: 20,
  });
  const updated = await client.updateProduct(products[0].id, payload);
  assert.equal(pennylaneProductExternalReference("fr", 42), payload.external_reference);
  assert.equal(updated.id, "product-1");
  assert.equal(transport.calls[0].path, "/products?limit=100");
  assert.equal(transport.calls[1].method, "PUT");
  assert.equal((transport.calls[1].body as any).price_before_tax, "100.00");
});

test("invoice creation adds deterministic idempotency key and finalizes separately", async () => {
  const transport = new FakeTransport();
  transport.responses.push({ data: { id: "invoice-1", status: "draft" } });
  transport.responses.push({ data: { id: "invoice-1", invoice_number: "FA-2026-1", status: "finalized", pdf_url: "/pdf/1" } });
  const client = new PennylaneClient(transport);
  const payload = {
    external_reference: "xhaccp-fr-order-9",
    customer_id: 123,
    date: "2026-09-17",
    currency: "EUR" as const,
    line_items: [{ label: "Thermometer", quantity: 2, unit: "piece", raw_currency_unit_price: "10.00", vat_rate: "FR_200" }],
    seller: { name: "xHACCP", country: "France" },
  };
  const created = await client.createInvoice(payload);
  const finalized = await client.finalizeInvoice(created.id);
  assert.equal(finalized.invoice_number, "FA-2026-1");
  assert.equal(transport.calls[0].headers?.["Idempotency-Key"], "xhaccp-fr-order-9");
  assert.deepEqual((transport.calls[0].body as any).invoice_lines[0], payload.line_items[0]);
});

test("payload builder preserves EUR, VAT lines, and seller identity", () => {
  const customer = buildPennylaneCustomerPayload({
    externalReference: "customer-ref",
    name: "Jean Dupont",
    email: "jean@example.fr",
    vatNumber: "FR123",
    country: "FR",
  });
  const invoice = buildPennylaneInvoicePayload({
    external_reference: "xhaccp-fr-order-1",
    customer_id: 123,
    date: "2026-09-17",
    currency: "EUR",
    line_items: [{ label: "Product", quantity: 1, unit: "piece", raw_currency_unit_price: "120.00", vat_rate: "FR_200" }],
    seller: { name: "xHACCP", vat_number: "FR456", country: "France" },
  });
  assert.equal(customer.external_reference, "customer-ref");
  assert.equal(customer.vat_number, "FR123");
  assert.equal(invoice.currency, "EUR");
  assert.equal(invoice.invoice_lines[0].vat_rate, "FR_200");
  assert.match(invoice.pdf_invoice_free_text, /TVA FR456/);
});

test("provider timeout/error remains retryable and does not become a local invoice", async () => {
  const transport = new FakeTransport();
  transport.responses.push(new PennylaneError("Pennylane request timed out"));
  const client = new PennylaneClient(transport);
  await assert.rejects(
    () => client.findInvoiceByReference("xhaccp-fr-order-77"),
    (error: unknown) => error instanceof PennylaneError && error.retryable,
  );
});

test("HTTP transport preserves the configured API base path", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.PENNYLANE_API_BASE_URL;
  const originalToken = process.env.PENNYLANE_API_TOKEN;
  let requestedUrl = "";

  process.env.PENNYLANE_API_BASE_URL = "https://example.test/api/external/v2";
  process.env.PENNYLANE_API_TOKEN = "test-token";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = input.toString();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const transport = createPennylaneHttpTransport();
    assert.ok(transport);
    await transport.request("GET", "/me");
    assert.equal(requestedUrl, "https://example.test/api/external/v2/me");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.PENNYLANE_API_BASE_URL;
    else process.env.PENNYLANE_API_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.PENNYLANE_API_TOKEN;
    else process.env.PENNYLANE_API_TOKEN = originalToken;
  }
});
