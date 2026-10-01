import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { load } from "cheerio";
import sharp from "sharp";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { registerSeoRoutes } from "./seo-routes";
import { serveStatic } from "./vite";
import { featureImage, publicLogo } from "../client/src/lib/public-images";
import type { IStorage } from "./storage";

const publicDir = path.resolve("client/public");

test("social fallback and route images are absolute and unique across markets", async () => {
  const images: Record<string, string | undefined> = {
    relative: "/images/xhaccp-logo-300.webp",
    remote: "https://cdn.example.test/product.jpg",
    protocol: "//cdn.example.test/product.jpg",
    invalid: "data:image/png;base64,invalid",
    missing: undefined,
  };
  const storage = {
    getProducts: async () => Object.entries(images).map(([slug, imageUrl], index) => ({
      id: index + 1, slug, imageUrl, name: slug, status: "active", price: "10", inStock: true,
    })),
    getProductTranslation: async () => null,
    getBlogPostTranslations: async () => [],
    getBlogPostBySlug: async (slug: string, marketCode: string) => ({
      id: 1, slug, marketCode, published: true, title: "Guide",
      imageUrl: images[slug], content: "Food safety guide",
    }),
  } as unknown as IStorage;
  const app = express();
  app.use((req: any, _res, next) => { req.market = req.headers["x-market"]; next(); });
  registerSeoRoutes(app, storage);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try {
    for (const market of ["ro", "fr", "com"]) {
      const base = `https://xhaccp.${market}`;
      for (const route of ["/", "/about", "/privacy", ...Object.keys(images).flatMap(slug => [`/products/${slug}`, `/blog/${slug}`])]) {
        const response = await fetch(`http://127.0.0.1:${address.port}${route}`, {
          headers: { Accept: "text/html", "X-Market": market, "X-Forwarded-Host": `xhaccp.${market}` },
        });
        assert.equal(response.status, 200, route);
        const $ = load(await response.text());
        const slug = route.split("/").pop()!;
        const expected = slug === "relative" ? `${base}/images/xhaccp-logo-300.webp`
          : ["remote", "protocol"].includes(slug) ? "https://cdn.example.test/product.jpg"
          : `${base}/og-image.jpg`;
        for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
          assert.equal($(selector).length, 1, `${market} ${route}: unique ${selector}`);
          assert.equal($(selector).attr("content"), expected, `${market} ${route}`);
        }
        assert.equal($('meta[property="og:title"]').length, 1);
        assert.equal($('meta[name="twitter:card"]').attr("content"), "summary_large_image");
        if (expected.endsWith("/og-image.jpg")) {
          assert.equal($('meta[property="og:image:width"]').attr("content"), "1200");
          assert.equal($('meta[property="og:image:height"]').attr("content"), "630");
        }
      }
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("production static middleware serves actual, small image files, not HTML", async () => {
  const app = express();
  serveStatic(app, publicDir);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try {
    const files = ["og-image.jpg", ...(await readdir(path.join(publicDir, "images"))).map(file => `images/${file}`)];
    for (const file of files) {
      const response = await fetch(`http://127.0.0.1:${address.port}/${file}`);
      assert.equal(response.status, 200, file);
      assert.match(response.headers.get("content-type")!, file.endsWith(".jpg") ? /image\/jpeg/ : /image\/webp/);
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      assert.ok(metadata.width! <= 1200, file);
      assert.ok(bytes.length < 150_000, file);
      if (file === "og-image.jpg") {
        assert.equal(metadata.width, 1200);
        assert.equal(metadata.height, 630);
      }
    }
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/missing-image.jpg`)).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("feature cards are responsive, lazy and much smaller than the source PNGs", async () => {
  let oldBytes = 0;
  let newBytes = 0;
  for (const name of [
    "chef_checking_kitchen_inventory", "business_consulting_meeting_chef",
    "chef_using_tablet_management", "support_representative_video_call",
  ]) {
    const props = featureImage(name);
    assert.equal(props.loading, "lazy");
    assert.equal(props.decoding, "async");
    assert.match(props.srcSet, /320w.*640w.*960w/);
    assert.ok(props.sizes);
    oldBytes += (await stat(`attached_assets/generated_images/${name}.png`)).size;
    newBytes += (await stat(path.join(publicDir, `images/${name}-640.webp`))).size;
  }
  assert.ok(newBytes < oldBytes * 0.05, "at least 95% smaller at 640px");
  assert.ok((await stat(path.join(publicDir, publicLogo.src))).size < 5000);
  const header = await readFile("client/src/components/header.tsx", "utf8");
  const home = await readFile("client/src/pages/home.tsx", "utf8");
  assert.match(header, /\{\.\.\.publicLogo\}/);
  assert.equal((home.match(/\{\.\.\.featureImage\(/g) || []).length, 4);
  assert.doesNotMatch(header + home, /@assets\/(?:logo_xHACCP-S1|generated_images\/(?:chef_checking|business_consulting|chef_using|support_representative))/);
});