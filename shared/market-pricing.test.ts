import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrderTaxSnapshot,
  defaultPriceDisplayMode,
  getOrderTaxSummary,
  pricePairFromDisplayPrice,
  resolveMarketPricePair,
} from "./market-pricing";

test("legacy market prices retain their visible amount with market-specific defaults", () => {
  const french = resolveMarketPricePair({
    market: "fr",
    price: "100.00",
    vatPercentage: "20",
  });
  const romanian = resolveMarketPricePair({
    market: "ro",
    price: "119.00",
    vatPercentage: "19",
  });

  assert.equal(french.priceDisplayMode, "net");
  assert.equal(french.displayPrice, 100);
  assert.equal(french.priceGross, 120);
  assert.equal(romanian.priceDisplayMode, "gross");
  assert.equal(romanian.displayPrice, 119);
  assert.equal(romanian.priceNet, 100);
  assert.equal(defaultPriceDisplayMode("com"), "gross");
});

test("explicit net and gross values follow the selected display mode", () => {
  const pair = resolveMarketPricePair({
    market: "fr",
    priceNet: "80.00",
    priceGross: "96.00",
    priceDisplayMode: "gross",
    vatPercentage: 20,
  });
  assert.deepEqual(pair, {
    priceNet: 80,
    priceGross: 96,
    displayPrice: 96,
    priceDisplayMode: "gross",
    vatPercentage: 20,
  });
  assert.deepEqual(pricePairFromDisplayPrice(96, "gross", 20), {
    priceNet: 80,
    priceGross: 96,
    displayPrice: 96,
  });
});

test("tax snapshots apply net- and gross-basis discounts once and include shipping", () => {
  const snapshot = calculateOrderTaxSnapshot([
    {
      priceDisplayMode: "net",
      displayTotalPrice: "100.00",
      totalPriceNet: "100.00",
      totalPriceGross: "120.00",
    },
    {
      priceDisplayMode: "gross",
      displayTotalPrice: "120.00",
      totalPriceNet: "100.00",
      totalPriceGross: "120.00",
    },
  ], 22, 12, 20);

  assert.equal(snapshot.discountAmount, "22.00");
  assert.equal(snapshot.discountNetAmount, "20.00");
  assert.equal(snapshot.discountGrossAmount, "24.00");
  assert.equal(snapshot.subtotalNet, "200.00");
  assert.equal(snapshot.vatAmount, "38.00");
  assert.equal(snapshot.totalAmount, "228.00");
});

test("zero-rate markets retain equal net, gross, VAT, and total values", () => {
  const pair = resolveMarketPricePair({ market: "com", price: "50.00", vatPercentage: 0 });
  const snapshot = calculateOrderTaxSnapshot([{
    priceDisplayMode: pair.priceDisplayMode,
    displayTotalPrice: pair.displayPrice,
    totalPriceNet: pair.priceNet,
    totalPriceGross: pair.priceGross,
  }], 5, 0, 0);
  assert.equal(snapshot.vatAmount, "0.00");
  assert.equal(snapshot.totalAmount, "45.00");
});

test("stored tax snapshots are reused instead of recalculating from a changed VAT default", () => {
  const summary = getOrderTaxSummary({
    totalAmount: "228.00",
    subtotalNet: "190.00",
    subtotalGross: "240.00",
    vatPercentage: "20",
    vatAmount: "38.00",
    discountAmount: "22.00",
    discountNetAmount: "20.00",
    discountGrossAmount: "24.00",
    shippingCost: "12.00",
    shippingNetAmount: "10.00",
    shippingVatAmount: "2.00",
  }, 25);

  assert.equal(summary.vatAmount, "38.00");
  assert.equal(summary.totalNetAmount, "190.00");
  assert.equal(summary.shippingNetAmount, "10.00");
  assert.equal(summary.discountNetAmount, "20.00");
});