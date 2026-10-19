import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { load } from "cheerio";
import { registerSeoRoutes } from "./seo-routes";
import { canonicalBaseUrl } from "@shared/canonical-url";
import { sanitizePublicHtml, renderArticleContent } from "./public-content";
import type { IStorage } from "./storage";
import { serveStatic } from "./vite";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const products = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1, slug: `product-${i + 1}`, name: `Product ${i + 1}`, status: "active",
  price: "15.00", currency: "EUR", inStock: true, categoryId: 1, priority: i + 1,
  category: { id: 1, slug: "food-labels", name: "Étiquettes" },
  description: "<h2>Instructions</h2><ul><li>Keep refrigerated</li></ul>" + "<p>Complete description.</p>".repeat(70),
  specs: [{ label: "Température", value: "-18 °C" }], weight: "0.5",
}));
const posts = [
  { id: 1, slug: "fr-guide", title: "Guide français", excerpt: "Conseils HACCP", language: "fr", marketCode: "fr", published: true,
    content: "<h2>Instructions complètes</h2>" + "<p>Contenu intégral.</p>".repeat(100) + '<ul><li>Dernier conseil</li></ul><a href="/products">Nos produits</a>' },
  { id: 2, slug: "ro-guide", title: "Ghid românesc", language: "ro", marketCode: "ro", published: true, content: "Romanian content" },
];
const storage = {
  getProducts: async () => products,
  getCategories: async () => [{ id: 1, slug: "food-labels", name: "Étiquettes", description: "Étiquettes alimentaires", showOnMainShop: true }],
  getProductTranslation: async (id: number, language: string) => language === "fr" ? { name: `Produit ${id}`, slug: `produit-${id}` } : null,
  getCompanySettingsByMarket: async (market: string) => market === "fr" ? {
    name: "French company from settings",
    address: "1 Rue Example",
    zipCode: "75001",
    city: "Paris",
    country: "France",
    registrationNumber: "108 196 536 00016",
    vatNumber: "FR72108196536",
  } as any : undefined,
  getBlogPosts: async (options: any) => posts.filter(p => p.marketCode === options.marketCode && p.published),
  getBlogPostBySlug: async (slug: string, market: string) => posts.find(p => p.slug === slug && p.marketCode === market),
  getBlogPostTranslations: async () => [],
} as unknown as IStorage;

test("canonical host policy is shared and header-safe", () => {
  assert.equal(canonicalBaseUrl({ headers: { host: "www.xhaccp.fr" } }), "https://xhaccp.fr");
  assert.equal(canonicalBaseUrl({ headers: { host: "localhost:5000", "x-forwarded-host": "www.xhaccp.com, proxy" } }), "https://xhaccp.com");
  assert.equal(canonicalBaseUrl({ headers: { host: 'evil"><script>' } }), "https://xhaccp.ro");
});

test("static resources are served first and unmatched fallback paths are real 404s", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "public-static-"));
  await writeFile(path.join(directory, "index.html"), "<html>SPA entrypoint</html>");
  await writeFile(path.join(directory, "real.txt"), "Real resource");
  await writeFile(path.join(directory, "extensionless"), "Extensionless resource");
  const app = express();
  serveStatic(app, directory);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const get = (pathname: string) => fetch(`http://127.0.0.1:${address.port}${pathname}`);
  try {
    for (const pathname of ["/real.txt", "/extensionless", "/account", "/admin/orders", "/invoice/123"]) {
      assert.equal((await get(pathname)).status, 200, pathname);
    }
    for (const pathname of ["/products/x/y", "/blog/x/y", "/about-extra", "/chef-event-extra", "/missing.txt", "/assets/missing.js", "/unknown/route"]) {
      const response = await get(pathname);
      assert.equal(response.status, 404, pathname);
      assert.doesNotMatch(await response.text(), /SPA entrypoint/, pathname);
    }
    const response = await get("/about-extra");
    const html = await response.text();
    assert.match(html, /canonical" href="https:\/\/127.0.0.1:\d+\/about-extra"/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("complete semantic content is retained and executable HTML removed", () => {
  const html = sanitizePublicHtml('<h2>Title</h2><ul><li>Step</li></ul><a href="/products">Catalog</a><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)">');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /href="\/products"/);
  assert.doesNotMatch(html, /script|onerror|javascript/);
  const markdown = renderArticleContent("## Heading\n\n- Step one\n- Step two\n\n[Catalog](/products)\n" + "Final paragraph ".repeat(200));
  assert.match(markdown, /<h2>Heading/);
  assert.match(markdown, /<li>Step two/);
  assert.match(markdown, /href="\/products"/);
  assert.ok(markdown.length > 2000);
});

test("French legal SEO pages render seller registration details from French company settings only", async () => {
  const app = express();
  app.use((req: any, _res, next) => { req.market = req.headers["x-market"] || "fr"; next(); });
  registerSeoRoutes(app, storage);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const get = async (pathname: string, market = "fr") => {
    const response = await fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      headers: { Accept: "text/html", "X-Market": market, "X-Forwarded-Host": `xhaccp.${market === "com" ? "com" : market}` },
    });
    return load(await response.text());
  };

  try {
    for (const pathname of ["/returns", "/privacy", "/terms"]) {
      const $ = await get(pathname);
      assert.match($("#public-root").text(), /108 196 536 00016/, pathname);
      assert.match($("#public-root").text(), /French company from settings/, pathname);
    }

    const romanianReturns = await get("/returns", "ro");
    assert.doesNotMatch(romanianReturns("#public-root").text(), /108 196 536 00016/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("French legal notice is prerendered with French data and unavailable on other markets", async () => {
  const app = express();
  app.use((req: any, _res, next) => { req.market = req.headers["x-market"] || "fr"; next(); });
  registerSeoRoutes(app, storage);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const get = async (market: "fr" | "ro" | "com") => {
    const response = await fetch(`http://127.0.0.1:${address.port}/mentions-legales`, {
      headers: {
        Accept: "text/html",
        "X-Market": market,
        "X-Forwarded-Host": `xhaccp.${market}`,
      },
    });
    return { response, html: await response.text() };
  };

  try {
    const french = await get("fr");
    const $ = load(french.html);
    assert.equal(french.response.status, 200);
    assert.equal($("html").attr("lang"), "fr");
    assert.equal($("title").text(), "Mentions légales | xHACCP France");
    assert.equal($('link[rel="canonical"]').attr("href"), "https://xhaccp.fr/mentions-legales");
    assert.match($('meta[name="description"]').attr("content") || "", /identité de l’éditeur/);
    assert.match($("#public-root h1").text(), /Mentions légales/);
    assert.match($("#public-root").text(), /108 196 536/);
    assert.match($("#public-root").text(), /108 196 536 00016/);
    assert.match($("#public-root").text(), /108 196 536 R\.C\.S\. Paris/);
    assert.match($("#public-root").text(), /1 000 EUR/);
    assert.match($("#public-root").text(), /Jerome Clement/);
    assert.match($("#public-root").text(), /Google Cloud Platform/);
    assert.match($("#public-root").text(), /Union européenne/);
    assert.match($("#public-root").text(), /French company from settings/);
    assert.equal($("#public-root a[href$='/terms']").length, 1);
    assert.equal($("#public-root a[href$='/privacy']").length, 1);
    assert.equal($("#public-root a[href$='/returns']").length, 1);

    for (const otherMarket of ["ro", "com"] as const) {
      const nonFrench = await get(otherMarket);
      assert.equal(nonFrench.response.status, 404, otherMarket);
      assert.match(nonFrench.html, /noindex,follow/);
      assert.doesNotMatch(
        nonFrench.html,
        /French company from settings|108 196 536 00016|Jerome Clement/,
        otherMarket,
      );
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("public HTML includes real localized content, pagination and metadata", async () => {
  const app = express();
  app.use((req: any, _res, next) => { req.market = req.headers["x-market"] || "fr"; next(); });
  registerSeoRoutes(app, storage, {
    getMarket: req => String(req.headers["x-market"] || "fr"),
    applyOverlay: product => product.id === 42 ? null : product,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const get = async (pathname: string, market = "fr") => {
    const response = await fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      headers: { Accept: "text/html", "X-Market": market, "X-Forwarded-Host": "www.xhaccp.fr" },
    });
    return { response, html: await response.text() };
  };
  try {
    const event = await get("/chef-event?success=true&email=private@example.test");
    let $ = load(event.html);
    assert.equal(event.response.status, 200);
    assert.equal($("html").attr("lang"), "fr");
    assert.match($("title").text(), /20 %/);
    assert.equal($('link[rel="canonical"]').attr("href"), "https://xhaccp.fr/chef-event");
    assert.match($("#public-root").text(), /20 %/);
    assert.match($('meta[property="og:image"]').attr("content")!, /attached_assets\/logo_xHACCP/);
    assert.doesNotMatch(event.html, /private@example|Merci pour votre inscription/);
    assert.equal($("#public-root [aria-hidden]").length, 0);
    const roEvent = await get("/chef-event", "ro");
    assert.match(roEvent.html, /name="robots" content="noindex,follow"/);
    const listing = await get("/products?category=etiquettes-alimentaires&page=2");
    $ = load(listing.html);
    assert.ok($("#public-root").attr("data-prerender-fallback"));
    assert.match($("head style").text(), /#public-root\[data-prerender-fallback\]\{display:none\}/);
    assert.match(listing.html, /<noscript><style>#public-root\[data-prerender-fallback\]\{display:block\}<\/style><\/noscript>/);
    assert.equal($("#public-root a[href^='/products/']").length, 20);
    assert.equal($("#public-root a[href='/products/produit-21']").length, 1);
    assert.equal($("#public-root a[rel='next']").attr("href"), "/products?category=etiquettes-alimentaires&page=3");
    assert.equal($('link[rel="canonical"]').attr("href"), "https://xhaccp.fr/products?category=etiquettes-alimentaires&page=2");
    const lastPage = await get("/products?page=3");
    $ = load(lastPage.html);
    assert.equal($("#public-root a[href^='/products/']").length, 1);
    assert.equal($("#public-root a[rel='next']").length, 0);
    const blog = await get("/blog");
    assert.match(blog.html, /href="\/blog\/fr-guide"/);
    assert.doesNotMatch(blog.html, /ro-guide/);
    const article = await get("/blog/fr-guide");
    $ = load(article.html);
    assert.match($("#public-root").text(), /Dernier conseil/);
    assert.equal($("#public-root h2").text(), "Instructions complètes");
    assert.equal($("#public-root a[href='/products']").length, 1);
    assert.ok($("#public-root").text().length > 1500);
    assert.equal((await get("/blog/ro-guide")).response.status, 404);
    assert.equal((await get("/blog/missing")).response.status, 404);
    const product = await get("/products/produit-1");
    $ = load(product.html);
    assert.equal($("#public-root h1").text(), "Produit 1");
    assert.equal($("#public-root li").text(), "Keep refrigerated");
    assert.ok($("#public-root").text().length > 1000);
    assert.match($("#public-root").text(), /Température.*-18 °C/s);
    assert.equal($('link[rel="canonical"]').attr("href"), "https://xhaccp.fr/products/produit-1");
    const home = await get("/");
    $ = load(home.html);
    assert.ok($("#public-root").attr("data-prerender-fallback"));
    assert.match($("#public-root").text(), /Équipements et consommables professionnels HACCP/);
    assert.match($("head style").text(), /#public-root\[data-prerender-fallback\]\{display:none\}/);
    assert.match(home.html, /<noscript><style>#public-root\[data-prerender-fallback\]\{display:block\}<\/style><\/noscript>/);
    assert.equal($("#root").attr("hidden"), "hidden");
    assert.equal((await get("/products/missing")).response.status, 404);
    assert.equal((await get("/products/produit-1/")).response.status, 404);
    assert.equal((await get("/about/")).response.status, 404);
    assert.equal((await get("/chef-event/")).response.status, 404);
    const alias = await get("/products/product-1");
    assert.match(alias.html, /canonical" href="https:\/\/xhaccp.fr\/products\/produit-1/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});