import assert from "node:assert/strict";
import test from "node:test";
import {
  isVivaOrderStateNonPayable,
  isVivaPaymentOrderNonPayable,
} from "./viva-payment-status";
import { VIVA_USER_AGENT } from "./viva-http";

test("only provider-expired and provider-cancelled Viva orders are non-payable", () => {
  assert.equal(isVivaOrderStateNonPayable(0), false);
  assert.equal(isVivaOrderStateNonPayable("1"), true);
  assert.equal(isVivaOrderStateNonPayable(2), true);
  assert.equal(isVivaOrderStateNonPayable(3), false);
});

test("Viva order reconciliation uses the market credentials and verifies the local merchant reference", async () => {
  const originalMerchantId = process.env.VIVA_MERCHANT_ID;
  const originalApiKey = process.env.VIVA_API_KEY;
  process.env.VIVA_MERCHANT_ID = "test-merchant";
  process.env.VIVA_API_KEY = "test-api-key";
  try {
    let requestCount = 0;
    const fakeFetch: typeof fetch = async (input, init) => {
      requestCount++;
      assert.equal(String(input), "https://www.vivapayments.com/api/orders/123456789");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["User-Agent"], VIVA_USER_AGENT);
      assert.equal(
        headers.Authorization,
        `Basic ${Buffer.from("test-merchant:test-api-key").toString("base64")}`,
      );
      return new Response(JSON.stringify({
        MerchantTrns: requestCount === 1 ? "order_73" : "order_99",
        StateId: 1,
      }), { status: 200 });
    };

    assert.equal(
      await isVivaPaymentOrderNonPayable("123456789", "ro", 73, fakeFetch),
      true,
    );
    assert.equal(
      await isVivaPaymentOrderNonPayable("123456789", "ro", 73, fakeFetch),
      false,
    );
  } finally {
    if (originalMerchantId === undefined) delete process.env.VIVA_MERCHANT_ID;
    else process.env.VIVA_MERCHANT_ID = originalMerchantId;
    if (originalApiKey === undefined) delete process.env.VIVA_API_KEY;
    else process.env.VIVA_API_KEY = originalApiKey;
  }
});
