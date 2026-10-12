import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express, { type Request, type RequestHandler } from "express";
import test from "node:test";
import type { ProductSeoContext, ProductSeoDraft } from "./ai-product-seo";
import {
  registerProductSeoAdminRoutes,
  type ProductSeoAdminRouteDependencies,
} from "./product-seo-admin-routes";

type ProductFixture = {
  id: number;
  name: string;
  description?: string | null;
  categoryId?: number;
  status?: string;
};

type TranslationFixture = {
  id: number;
  productId: number;
  language: string;
  name: string;
  description: string | null;
  slug?: string | null;
  sourceUrl?: string | null;
  seoSources?: Array<{ title: string; url: string }>;
};

function createHarness(options: { generatorError?: Error } = {}) {
  const products = new Map<number, ProductFixture>([
    [100, { id: 100, name: "Base product", description: "Base description", categoryId: 5, status: "active" }],
    [101, { id: 101, name: "Other product", description: "<p>Other catalog description</p>", categoryId: 5, status: "active" }],
    [102, { id: 102, name: "Romanian-only product", description: "Not for France", categoryId: 5, status: "active" }],
    [103, { id: 103, name: "Inactive product", description: "Inactive copy", categoryId: 5, status: "inactive" }],
    [200, { id: 200, name: "Existing product", description: "Base description", categoryId: 5, status: "active" }],
    [900, { id: 900, name: "Newly created product", description: "Base description", categoryId: 5, status: "active" }],
  ]);
  const productMarkets = new Map<number, string[]>([
    [100, ["fr"]],
    [101, ["fr"]],
    [102, ["ro"]],
    [103, ["fr"]],
    [200, ["fr"]],
    [900, ["fr"]],
  ]);
  const translations = new Map<number, TranslationFixture>([
    [1, { id: 1, productId: 101, language: "fr", name: "Produit associé", description: "Description du catalogue" }],
    [2, { id: 2, productId: 200, language: "fr", name: "Produit existant FR", description: "Description française à conserver" }],
    [3, { id: 3, productId: 200, language: "en", name: "Existing product EN", description: "English description must remain unchanged" }],
  ]);
  let nextTranslationId = 4;
  const calls = {
    generated: [] as ProductSeoContext[],
    created: [] as TranslationFixture[],
    updatedIds: [] as number[],
    accessedProducts: [] as number[],
  };

  const authenticateAdmin: RequestHandler = (req, _res, next) => {
    const markets = (req.get("x-test-markets") || "").split(",").filter(Boolean);
    Object.assign(req, { adminMarkets: markets });
    next();
  };
  const dependencies: ProductSeoAdminRouteDependencies = {
    authenticateAdmin,
    isGeneratorConfigured: () => true,
    canAccessMarket: (req: Request, market) => {
      const markets = (req as Request & { adminMarkets?: string[] }).adminMarkets || [];
      return markets.length === 0 || markets.includes(market);
    },
    canAccessProductForMarket: async (req, productId, requestedMarket) => {
      calls.accessedProducts.push(productId);
      const adminMarkets = (req as Request & { adminMarkets?: string[] }).adminMarkets || [];
      if (requestedMarket && requestedMarket !== "all" && adminMarkets.length && !adminMarkets.includes(requestedMarket)) {
        return false;
      }
      if (!products.has(productId)) return false;
      if (!adminMarkets.length) return true;
      return (productMarkets.get(productId) || []).some(market => adminMarkets.includes(market));
    },
    getProduct: async (productId) => products.get(productId),
    getProducts: async ({ categoryId }) => [...products.values()].filter(product => product.categoryId === categoryId),
    getProductTranslation: async (productId, language) => [...translations.values()]
      .find(item => item.productId === productId && item.language === language),
    getActiveProductIdsForMarket: async market => ({
      fr: [100, 101, 103, 200, 900],
      ro: [102],
      com: [],
    })[market],
    getTranslationOwner: async translationId => {
      const translation = translations.get(translationId);
      return translation ? { productId: translation.productId } : undefined;
    },
    createProductTranslation: async input => {
      const translation = { id: nextTranslationId++, ...input } as TranslationFixture;
      translations.set(translation.id, translation);
      calls.created.push(translation);
      return translation;
    },
    updateProductTranslation: async (translationId, input) => {
      const translation = translations.get(translationId);
      if (!translation) throw new Error("Translation fixture not found");
      Object.assign(translation, input);
      calls.updatedIds.push(translationId);
      return translation;
    },
    generateProductSeoDraft: async context => {
      calls.generated.push(context);
      if (options.generatorError) throw options.generatorError;
      const result: ProductSeoDraft = {
        name: "Génération de test",
        description: "Description générée pour le test, fondée sur les informations confirmées du produit.",
        sources: [],
      };
      return result;
    },
  };

  const app = express();
  app.use(express.json());
  registerProductSeoAdminRoutes(app, dependencies);
  const server = app.listen(0);
  const ready = new Promise<string>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not bind to a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.once("error", reject);
  });

  return {
    calls,
    translations,
    ready,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
    request: async (method: string, path: string, markets: string, body?: unknown) => {
      const response = await fetch(`${await ready}${path}`, {
        method,
        headers: { "content-type": "application/json", "x-test-markets": markets },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: await response.json() as Record<string, any>,
      };
    },
  };
}

test("authorizes SEO generation and uses only active same-market catalog references", async t => {
  const harness = createHarness();
  t.after(() => harness.close());

  const denied = await harness.request("POST", "/admin/api/products/generate-seo", "ro", {
    productId: 100,
    market: "fr",
  });
  assert.equal(denied.status, 403);
  assert.equal(harness.calls.generated.length, 0);

  const generated = await harness.request("POST", "/admin/api/products/generate-seo", "fr", {
    productId: 100,
    market: "fr",
  });
  assert.equal(generated.status, 200);
  assert.equal(generated.body.language, "fr");
  assert.equal(generated.body.usedCatalogReferences, true);
  assert.deepEqual(harness.calls.generated[0].relatedProducts, [
    { name: "Produit associé", description: "Description du catalogue" },
    { name: "Produit existant FR", description: "Description française à conserver" },
    { name: "Newly created product", description: "Base description" },
  ]);
  assert.equal(
    harness.calls.generated[0].relatedProducts.some(product =>
      product.name === "Romanian-only product" || product.name === "Inactive product" || product.name === "Base product",
    ),
    false,
  );
  assert.equal(harness.calls.generated[0].useWebSearch, false);

  const foreignProduct = await harness.request("POST", "/admin/api/products/generate-seo", "fr", {
    productId: 102,
    market: "fr",
  });
  assert.equal(foreignProduct.status, 403);
  assert.equal(harness.calls.generated.length, 1);
});

test("activation creates an approved translation for a newly created product", async t => {
  const harness = createHarness();
  t.after(() => harness.close());

  const response = await harness.request("POST", "/admin/api/products/900/translations", "fr", {
    market: "fr",
    language: "fr",
    name: "Nom français approuvé",
    description: "Description française approuvée avant publication.",
    seoSources: [
      { title: "Source", url: "https://example.test/reference" },
      { title: "Duplicate", url: "https://example.test/reference" },
      { title: "Insecure", url: "http://example.test/unsafe" },
    ],
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.productId, 900);
  assert.equal(response.body.language, "fr");
  assert.equal(response.body.description, "Description française approuvée avant publication.");
  assert.deepEqual(response.body.seoSources, [{
    title: "Source",
    url: "https://example.test/reference",
  }]);
  assert.equal(harness.calls.created.length, 1);
});

test("activation updates only the selected language translation", async t => {
  const harness = createHarness();
  t.after(() => harness.close());

  const response = await harness.request("PUT", "/admin/api/products/translations/2", "fr", {
    market: "fr",
    language: "fr",
    name: "Produit existant FR",
    description: "Nouvelle description française activée.",
    seoSources: [{ title: "Source", url: "https://example.test/fr-seo" }],
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.description, "Nouvelle description française activée.");
  assert.equal(harness.translations.get(2)?.description, "Nouvelle description française activée.");
  assert.equal(harness.translations.get(3)?.description, "English description must remain unchanged");
  assert.deepEqual(harness.calls.updatedIds, [2]);
});

test("provider errors leave the current localized description unchanged", async t => {
  const harness = createHarness({ generatorError: new Error("Provider temporarily unavailable") });
  t.after(() => harness.close());

  const response = await harness.request("POST", "/admin/api/products/generate-seo", "fr", {
    productId: 200,
    market: "fr",
  });

  assert.equal(response.status, 500);
  assert.match(response.body.message, /Provider temporarily unavailable/);
  assert.equal(harness.translations.get(2)?.description, "Description française à conserver");
  assert.equal(harness.calls.created.length, 0);
  assert.equal(harness.calls.updatedIds.length, 0);
});

test("admin editor uses create for staged drafts and targets the selected existing translation", () => {
  const adminSource = readFileSync(new URL("../admin-src/AdminApp.jsx", import.meta.url), "utf8");

  assert.match(adminSource, /if \(seoDraft\?\.activated\) \{\s*const translationResponse = await fetch\(`\/admin\/api\/products\/\$\{result\.product\.id\}\/translations`, \{\s*method: 'POST'/);
  assert.match(adminSource, /const existing = productTranslations\.find\(item => item\.language === seoDraft\.language\);/);
  assert.match(adminSource, /`\/admin\/api\/products\/translations\/\$\{existing\.id\}`\s*:\s*`\/admin\/api\/products\/\$\{editingProduct\.id\}\/translations`, \{\s*method: existing \? 'PUT' : 'POST'/);
  assert.match(adminSource, /language: seoDraft\.language,\s*name: existing\?\.name \|\| seoDraft\.name,\s*description: seoDraft\.description,/);
});
