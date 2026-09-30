import assert from "node:assert/strict";
import test from "node:test";
import { getProductSku } from "./product-sku";

test("French product SKU uses the Product Code shown in Admin when configured", () => {
  assert.equal(
    getProductSku({ id: 15123, productCode: " FR-AL-15123 " }),
    "FR-AL-15123",
  );
});

test("product SKU falls back to the stable product ID when no code is configured", () => {
  assert.equal(getProductSku({ id: 15123, productCode: null }), "KP-15123");
  assert.equal(getProductSku({ id: 15123, productCode: "   " }), "KP-15123");
});