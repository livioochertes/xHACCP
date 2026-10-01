import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAIMarketCatalog,
  formatAIMarketCatalog,
  getActiveAIPromotionProducts,
  rankAIPromotionProducts,
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

test("ranks selected AI campaign products by featured flag, then display priority, then selection order", () => {
  const catalog: AIMarketProduct[] = [
    { id: 1, name: "Default selected first", featured: false, priority: 0 },
    { id: 2, name: "Priority 2", featured: false, priority: 2 },
    { id: 3, name: "Featured", featured: true, priority: 8 },
    { id: 4, name: "Priority 1", featured: false, priority: 1 },
    { id: 5, name: "Not selected", featured: true, priority: 1 },
  ];

  assert.deepEqual(
    rankAIPromotionProducts(catalog, [1, 2, 3, 4]).map((product) => product.id),
    [3, 4, 2],
  );
});

test("limits scheduled promotion output to three available campaign products", () => {
  const catalog: AIMarketProduct[] = [
    { id: 1, featured: false, priority: 1 },
    { id: 2, featured: false, priority: 2 },
    { id: 3, featured: true, priority: 3 },
    { id: 4, featured: true, priority: 1 },
  ];

  assert.deepEqual(
    rankAIPromotionProducts(catalog, [1, 2, 3, 4]).map((product) => product.id),
    [4, 3, 1],
  );
  assert.deepEqual(
    rankAIPromotionProducts(catalog.filter((product) => product.id !== 4), [1, 2, 3, 4])
      .map((product) => product.id),
    [3, 1, 2],
  );
});

test("promotion context uses only an active campaign for the request market and currently available products", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const activeProducts = [
    { id: 1, name: "Available item", status: "active" },
    { id: 3, name: "Also available", status: "active" },
  ];
  const campaign = {
    market: "fr",
    productIds: [1, 2, 3],
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-02T00:00:00.000Z",
  };

  assert.deepEqual(
    getActiveAIPromotionProducts(activeProducts, campaign, "fr", now).map((product) => product.id),
    [1, 3],
  );
  assert.deepEqual(getActiveAIPromotionProducts(activeProducts, campaign, "ro", now), []);
  assert.deepEqual(
    getActiveAIPromotionProducts(activeProducts, { ...campaign, startsAt: "2026-10-02T00:00:00.000Z" }, "fr", now),
    [],
  );
  assert.deepEqual(
    getActiveAIPromotionProducts(activeProducts, { ...campaign, endsAt: "2026-10-01T12:00:00.000Z" }, "fr", now),
    [],
  );
});