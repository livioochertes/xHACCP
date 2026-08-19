import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAIMarketCatalog,
  formatAIMarketCatalog,
  type AIMarketProduct,
} from "./ai-catalog";

const products: AIMarketProduct[] = Array.from({ length: 18 }, (_, index) => ({
  id: index + 1,
  name: `Product ${index + 1}`,
  slug: `product-${index + 1}`,
  price: 100 + index,
  currency: "RON",
  status: "active",
}));

products.push({
  id: 19,
  name: "Inactive product",
  slug: "inactive-product",
  price: 999,
  currency: "RON",
  status: "inactive",
});

test("keeps the complete active catalog instead of truncating it", () => {
  const catalog = buildAIMarketCatalog(products, "ro", (product) => product);

  assert.equal(catalog.length, 18);
  assert.equal(catalog.at(-1)?.id, 18);
  assert.equal(catalog.some((product) => product.id === 19), false);
});

test("excludes products disabled for the selected market", () => {
  const catalog = buildAIMarketCatalog(products, "fr", (product) =>
    product.id === 3 ? null : { ...product, currency: "EUR", price: "12.50" },
  );

  assert.equal(catalog.length, 17);
  assert.equal(catalog.some((product) => product.id === 3), false);
  assert.equal(catalog[0].currency, "EUR");
  assert.equal(catalog[0].price, "12.50");
});

test("accepts case-insensitive active status and explicit isActive products", () => {
  const catalog = buildAIMarketCatalog(
    [
      { id: 1, name: "Mixed case", status: "Active" },
      { id: 2, name: "Explicitly active", status: "draft", isActive: true },
      { id: 3, name: "Not active", status: "draft", isActive: false },
    ],
    "com",
    (product) => product,
  );

  assert.deepEqual(catalog.map((product) => product.id), [1, 2]);
});

test("formats effective market prices and currencies without a hardcoded dollar symbol", () => {
  const catalog: AIMarketProduct[] = [
    { id: 1, name: "France item", slug: "france-item", price: "24.90", currency: "EUR" },
    { id: 2, name: "Romania item", slug: "romania-item", price: 88, currency: null },
  ];

  const formatted = formatAIMarketCatalog(catalog, "RON");

  assert.match(formatted, /France item \| 24\.90 EUR \| ID: 1 \| Slug: france-item/);
  assert.match(formatted, /Romania item \| 88 RON \| ID: 2 \| Slug: romania-item/);
  assert.equal(formatted.includes("$"), false);
});

test("supports all configured markets and preserves a product currency when no overlay exists", () => {
  for (const market of ["ro", "fr", "com"]) {
    const catalog = buildAIMarketCatalog(
      [{ id: market, name: `${market} product`, status: "active", currency: "EUR" }],
      market,
      (product) => product,
    );

    assert.equal(catalog.length, 1);
    assert.equal(formatAIMarketCatalog(catalog, "RON").includes("EUR"), true);
  }
});