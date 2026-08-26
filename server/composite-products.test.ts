import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCompositeConfiguration,
  calculateCompositeStockQuantity,
  normalizeRequestedCompositeComponents,
  resolveCompositeStockQuantity,
} from "./composite-products";

const available = [
  {
    product: {
      id: 1,
      name: "Model A",
      price: "10.00",
      currency: "RON",
      productCode: "A",
      volumeDiscounts: [],
    } as any,
    marketPrice: null,
    marketCurrency: null,
    sortOrder: 0,
  },
  {
    product: {
      id: 2,
      name: "Model B",
      price: "20.00",
      currency: "RON",
      productCode: "B",
      status: "inactive",
      volumeDiscounts: [],
    } as any,
    marketPrice: "25.00",
    marketCurrency: "RON",
    sortOrder: 1,
  },
];

test("calculates independent quantities and permits inactive configured components", () => {
  const result = calculateCompositeConfiguration(
    available,
    [
      { componentProductId: 1, quantity: 3 },
      { componentProductId: 2, quantity: 2 },
    ],
    "RON",
    (price) => price,
  );

  assert.equal(result.totalPrice, "80.00");
  assert.deepEqual(result.components.map(item => [item.componentProductId, item.quantity]), [[1, 3], [2, 2]]);
});

test("rejects duplicate and unconfigured selections", () => {
  assert.throws(
    () => normalizeRequestedCompositeComponents([
      { componentProductId: 1, quantity: 1 },
      { componentProductId: 1, quantity: 2 },
    ]),
    /only be selected once/,
  );
  assert.throws(
    () => calculateCompositeConfiguration(
      available,
      [{ componentProductId: 99, quantity: 1 }],
      "RON",
      (price) => price,
    ),
    /not configured/,
  );
});

test("rejects more than eight configured selections", () => {
  assert.throws(
    () => normalizeRequestedCompositeComponents(
      Array.from({ length: 9 }, (_, index) => ({ componentProductId: index + 1, quantity: 1 })),
    ),
    /at most 8/,
  );
});

test("rejects implicit cross-currency fallback prices", () => {
  const eurComponentWithoutMarketPrice = [{
    ...available[0],
    product: { ...available[0].product, currency: "EUR" },
    marketPrice: null,
    marketCurrency: "RON",
  }];
  assert.throws(
    () => calculateCompositeConfiguration(
      eurComponentWithoutMarketPrice,
      [{ componentProductId: 1, quantity: 1 }],
      "RON",
      (price) => price,
    ),
    /requires an explicit RON market price/,
  );
});

test("rejects a component market price in a different currency", () => {
  const wrongMarketCurrency = [{
    ...available[0],
    marketPrice: "10.00",
    marketCurrency: "EUR",
  }];
  assert.throws(
    () => calculateCompositeConfiguration(
      wrongMarketCurrency,
      [{ componentProductId: 1, quantity: 1 }],
      "RON",
      (price) => price,
    ),
    /does not use the RON marketplace currency/,
  );
});

test("sums marketplace component stock for an automatic composite stock", () => {
  const stockSources = [
    {
      ...available[0],
      product: { ...available[0].product, stockQuantity: 4 },
      marketStockQuantity: null,
    },
    {
      ...available[1],
      product: { ...available[1].product, stockQuantity: 7 },
      marketStockQuantity: 9,
    },
  ];

  assert.equal(calculateCompositeStockQuantity(stockSources), 13);
  assert.equal(resolveCompositeStockQuantity(null, stockSources), 13);
  assert.equal(resolveCompositeStockQuantity(0, stockSources), 13);
});

test("a positive composite stock entered manually overrides the component sum", () => {
  assert.equal(resolveCompositeStockQuantity(5, available), 5);
});