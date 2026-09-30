import assert from "node:assert/strict";
import express, { type Request } from "express";
import { readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";
import { createAdminProductListHandler } from "./admin-product-list";
import { getMarketFromRequest } from "./market-routing";
import { getActiveProductMarketRow } from "./product-market-availability";
import { createPublicProductSlugHandler } from "./public-product-detail";

interface JsonResponse {
  statusCode: number;
  body: any;
}

async function requestJson(
  server: http.Server,
  path: string,
): Promise<JsonResponse> {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise<JsonResponse>((resolve, reject) => {
    const request = http.get({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      headers: { host: "xhaccp.fr" },
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({
            statusCode: response.statusCode || 0,
            body: body ? JSON.parse(body) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

test("French Admin product codes match public detail and non-French products stay hidden", async () => {
  const frenchCategory = {
    id: 44,
    name: "Étiquettes",
    slug: "labels",
    marketCode: "fr",
  };
  const products = [
    {
      id: 501,
      name: "Étiquettes HACCP",
      slug: "haccp-labels",
      status: "active",
      productCode: "FR-LABEL-501",
      price: "12.00",
      currency: "EUR",
      categoryId: 4,
      category: { id: 4, name: "Labels", slug: "labels", marketCode: "ro" },
    },
    {
      id: 502,
      name: "Romanian-only product",
      slug: "only-romania",
      status: "active",
      productCode: "RO-ONLY-502",
      price: "10.00",
      currency: "RON",
      categoryId: 4,
      category: { id: 4, name: "Labels", slug: "labels", marketCode: "ro" },
    },
    {
      id: 503,
      name: "Disabled French product",
      slug: "disabled-french-product",
      status: "active",
      productCode: "FR-DISABLED-503",
      price: "15.00",
      currency: "EUR",
      categoryId: 4,
      category: { id: 4, name: "Labels", slug: "labels", marketCode: "ro" },
    },
  ];
  const productMarkets = [
    { productId: 501, market: "fr", isActive: true, categoryId: 44, price: "12.00", currency: "EUR" },
    { productId: 502, market: "ro", isActive: true, categoryId: 4, price: "10.00", currency: "RON" },
    { productId: 503, market: "fr", isActive: false, categoryId: 44, price: "15.00", currency: "EUR" },
  ];
  const marketRowsByProduct = new Map(
    productMarkets.map(row => [
      row.productId,
      new Map(productMarkets.filter(candidate => candidate.productId === row.productId)
        .map(candidate => [candidate.market, candidate])),
    ]),
  );

  const app = express();
  app.get("/admin/api/products", (req, _res, next) => {
    (req as Request & { adminMarkets?: string[] }).adminMarkets = [];
    next();
  }, createAdminProductListHandler({
    canAccessMarket: () => true,
    getMarketRows: async markets => productMarkets.filter(row => markets.includes(row.market)),
    getProducts: async () => products,
    getCategories: async market => market === "fr" ? [frenchCategory] : [],
    getMarketSettings: async () => [{ market: "fr", currency: "EUR" }],
    localizeCategories: async categories => categories,
    getCompositeRows: async ids => ids.map(id => ({ id, isComposite: false })),
  }));
  app.get("/api/products/slug/:slug", createPublicProductSlugHandler({
    getCachedProductBySlug: slug => products.find(product => product.slug === slug),
    getProductBySlug: async slug => slug === "etiquettes-haccp-fr"
      ? products.find(product => product.id === 501)
      : slug === "produit-uniquement-roumain"
        ? products.find(product => product.id === 502)
        : products.find(product => product.slug === slug),
    getActiveProducts: () => products,
    getMarket: getMarketFromRequest,
    applyMarketOverlay: (product, market) => {
      const marketRow = getActiveProductMarketRow(marketRowsByProduct, product.id, market);
      if (!marketRow) return null;
      return {
        ...product,
        price: marketRow.price ?? product.price,
        currency: marketRow.currency ?? product.currency,
      };
    },
    decorateCompositeProduct: async product => product,
  }));

  const adminRoutesSource = readFileSync("server/admin-routes.ts", "utf8");
  const publicRoutesSource = readFileSync("server/routes.ts", "utf8");
  assert.match(adminRoutesSource, /app\.get\("\/admin\/api\/products", authenticateAdmin, createAdminProductListHandler\(/);
  assert.match(publicRoutesSource, /app\.get\("\/api\/products\/slug\/:slug", createPublicProductSlugHandler\(\{[\s\S]{0,350}applyMarketOverlay,/);

  const server = await new Promise<http.Server>(resolve => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  try {
    const adminResponse = await requestJson(server, "/admin/api/products?market=fr");
    assert.equal(adminResponse.statusCode, 200);
    const adminFrenchProduct = adminResponse.body.find((product: any) => product.id === 501);
    assert.ok(adminFrenchProduct, "the French Admin list should include the FR product");
    assert.equal(adminFrenchProduct.productCode, "FR-LABEL-501");
    assert.equal(
      adminResponse.body.some((product: any) => product.id === 502),
      false,
      "the French Admin list should not include a Romanian-only product",
    );

    const publicFrenchDetail = await requestJson(server, "/api/products/slug/etiquettes-haccp-fr");
    assert.equal(publicFrenchDetail.statusCode, 200);
    assert.equal(publicFrenchDetail.body.productCode, "FR-LABEL-501");
    assert.equal(publicFrenchDetail.body.productCode, adminFrenchProduct.productCode);

    const unavailableTranslatedDetail = await requestJson(
      server,
      "/api/products/slug/produit-uniquement-roumain",
    );
    assert.equal(unavailableTranslatedDetail.statusCode, 404);
    const disabledFrenchDetail = await requestJson(server, "/api/products/slug/disabled-french-product");
    assert.equal(disabledFrenchDetail.statusCode, 404);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});