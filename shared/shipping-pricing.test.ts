import test from "node:test";
import assert from "node:assert/strict";
import { calculateShippingQuote } from "./shipping-pricing";

test("service-only orders do not incur shipping", () => {
  const quote = calculateShippingQuote([
    { productType: "service", displayTotalPrice: "250.00" },
  ], 1000, 35);

  assert.deepEqual(quote, {
    hasShippableItems: false,
    shippableSubtotal: 0,
    shippingCost: 0,
  });
});

test("legacy service products do not incur shipping", () => {
  const quote = calculateShippingQuote([
    { productType: "standard", isService: true, displayTotalPrice: 250 },
  ], 1000, 35);

  assert.equal(quote.shippingCost, 0);
  assert.equal(quote.hasShippableItems, false);
});

test("mixed carts calculate shipping thresholds from shippable products only", () => {
  const underThreshold = calculateShippingQuote([
    { productType: "service", displayTotalPrice: 1000 },
    { productType: "standard", displayTotalPrice: 400 },
  ], 500, 35);
  const freeShipping = calculateShippingQuote([
    { productType: "service", displayTotalPrice: 1000 },
    { productType: "standard", displayTotalPrice: 600 },
  ], 500, 35);

  assert.equal(underThreshold.shippableSubtotal, 400);
  assert.equal(underThreshold.shippingCost, 35);
  assert.equal(freeShipping.shippableSubtotal, 600);
  assert.equal(freeShipping.shippingCost, 0);
});