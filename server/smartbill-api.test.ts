import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SmartbillAPI,
} from "./smartbill-api.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

type MockResponse = {
  status?: number;
  body: unknown;
};

function makeResponse({ status = 200, body }: MockResponse): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function withMockFetch<T>(
  responses: MockResponse[],
  callback: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      init,
    });

    const response = responses.shift();
    if (!response) {
      throw new Error("Unexpected SmartBill request in test");
    }
    return makeResponse(response);
  }) as typeof fetch;

  try {
    return await callback(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function captureConsole() {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));

  return {
    lines,
    restore() {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

function createClient() {
  return new SmartbillAPI({
    username: "smartbill-test-user",
    token: "smartbill-basic-secret",
    companyVat: "RO12345678",
    invoiceSeries: "TEST",
  });
}

function product(index: number) {
  return {
    id: index,
    productCode: `SKU-${index}`,
    name: `Product ${index}`,
    marketPrice: 10 + index,
    marketCurrency: "RON",
    marketVatPercentage: 19,
    description: `Description ${index}`,
    isService: index === 2,
  };
}

test("product sync uses invoice/v2 drafts with the documented saveToDb fields", async () => {
  const client = createClient();

  await withMockFetch(
    [
      { body: [] },
      {
        body: {
          documentId: 42,
          series: "TEST",
          number: "DRAFT-1",
          message: "Saved",
        },
      },
    ],
    async (calls) => {
      const result = await client.syncProductsToSmartbill("RO12345678", [
        product(1),
        product(2),
      ]);

      assert.deepEqual(result, {
        submitted: 2,
        draftsCreated: 1,
        failed: 0,
        errors: [],
        drafts: [{
          documentId: 42,
          series: "TEST",
          number: "DRAFT-1",
          message: "Saved",
        }],
        skippedDuplicateCodes: [],
      });

      assert.equal(calls.length, 2);
      assert.equal(
        calls[0].url,
        "https://ws.smartbill.ro/SBORO/api/series?cif=RO12345678",
      );
      assert.equal(
        calls[1].url,
        "https://ws.smartbill.ro/SBORO/api/invoice/v2",
      );
      assert.equal(calls[1].init?.method, "POST");

      const payload = JSON.parse(String(calls[1].init?.body));
      assert.equal(payload.companyVatCode, "RO12345678");
      assert.equal(payload.seriesName, "TEST");
      assert.match(payload.issueDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(payload.isDraft, true);
      assert.deepEqual(payload.client, {
        name: "xHACCP product synchronization",
        country: "Romania",
        saveToDb: false,
      });
      assert.deepEqual(payload.products, [
        {
          name: "Product 1",
          code: "SKU-1",
          quantity: 1,
          price: 11,
          measuringUnitName: "buc",
          currency: "RON",
          isTaxIncluded: true,
          taxName: "Normala",
          taxPercentage: 19,
          productDescription: "Description 1",
          saveToDb: true,
          isService: false,
        },
        {
          name: "Product 2",
          code: "SKU-2",
          quantity: 1,
          price: 12,
          measuringUnitName: "buc",
          currency: "RON",
          isTaxIncluded: true,
          taxName: "Normala",
          taxPercentage: 19,
          productDescription: "Description 2",
          saveToDb: true,
          isService: true,
        },
      ]);
      assert.ok(calls.every(({ url }) => !url.endsWith("/products")));
    },
  );
});

test("product sync filters duplicate codes and submits at most 400 lines per draft", async () => {
  const client = createClient();
  const products = Array.from({ length: 401 }, (_, index) => product(index + 1));
  products.push({ ...product(1), id: 999, name: "Duplicate product" });
  const captured = captureConsole();

  try {
    await withMockFetch(
      [
        { body: [] },
        { body: { documentId: 1 } },
        { body: [] },
        { body: { documentId: 2 } },
      ],
      async (calls) => {
        const result = await client.syncProductsToSmartbill(
          "RO12345678",
          products,
        );

        assert.equal(result.submitted, 401);
        assert.equal(result.draftsCreated, 2);
        assert.equal(result.failed, 0);
        assert.deepEqual(result.skippedDuplicateCodes, ["SKU-1"]);

        const draftBodies = calls
          .filter(({ url }) => url.endsWith("/invoice/v2"))
          .map(({ init }) => JSON.parse(String(init?.body)));
        assert.deepEqual(
          draftBodies.map(({ products: draftProducts }) => draftProducts.length),
          [400, 1],
        );
        assert.ok(
          draftBodies.every(({ isDraft, products: draftProducts }) =>
            isDraft === true &&
            draftProducts.every((draftProduct: { saveToDb: boolean }) =>
              draftProduct.saveToDb === true,
            ),
          ),
        );
      },
    );
  } finally {
    captured.restore();
  }
});

test("a successful HTTP response with errorText is treated as a failed sync", async () => {
  const client = createClient();
  const captured = captureConsole();

  try {
    await withMockFetch(
      [
        { body: [] },
        { body: { errorText: "Product code is invalid" } },
      ],
      async (calls) => {
        const result = await client.syncProductsToSmartbill(
          "RO12345678",
          [product(1)],
        );

        assert.equal(calls.length, 2);
        assert.equal(result.submitted, 0);
        assert.equal(result.draftsCreated, 0);
        assert.equal(result.failed, 1);
        assert.deepEqual(result.errors, [
          "Failed to sync 1 products: Smartbill API error 200: Product code is invalid",
        ]);
      },
    );
  } finally {
    captured.restore();
  }
});
