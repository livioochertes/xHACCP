import { type Express } from "express";
import fs from "fs";
import path from "path";
import type { IStorage } from "./storage";

interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
}

function getIndexHtml(): string {
  const prodPath = path.resolve(process.cwd(), "dist", "public", "index.html");
  if (fs.existsSync(prodPath)) {
    return fs.readFileSync(prodPath, "utf-8");
  }
  const devPath = path.resolve(process.cwd(), "client", "index.html");
  return fs.readFileSync(devPath, "utf-8");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectMeta(html: string, meta: MetaTags): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = meta.canonical;
  const ogType = meta.ogType || "website";
  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  result = result.replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${description}" />`
  );

  result = result.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${canonical}" />`
  );

  const ogTags = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:site_name" content="xHACCP" />`,
  ].join("\n  ");

  result = result.replace("</head>", `  ${ogTags}\n</head>`);

  return result;
}

function getBaseUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "xhaccp.ro";
  return `${proto}://${host}`;
}

const STATIC_META: Record<string, (base: string) => MetaTags> = {
  "/": (base) => ({
    title: "xHACCP – Echipamente și consumabile profesionale HACCP",
    description:
      "Furnizor premium de etichete HACCP, termometre, detergenți și echipamente profesionale pentru bucătărie. Livrare rapidă în toată România. Soluții complete pentru restaurante, hoteluri și cafenele.",
    canonical: base + "/",
    ogType: "website",
  }),
  "/products": (base) => ({
    title: "Produse HACCP Profesionale – Etichete, Termometre, Detergenți | xHACCP",
    description:
      "Descoperă gama completă de produse xHACCP: etichete rotație alimente, termometre digitale, detergenți profesionali, recipiente alimentare și accesorii HACCP pentru HORECA.",
    canonical: base + "/products",
    ogType: "website",
  }),
  "/about": (base) => ({
    title: "Despre xHACCP – Furnizor de soluții HACCP pentru HORECA",
    description:
      "xHACCP este furnizorul tău de încredere pentru echipamente și consumabile HACCP. Descoperă povestea noastră, valorile și angajamentul față de siguranța alimentară în industria HORECA.",
    canonical: base + "/about",
  }),
  "/b2b": (base) => ({
    title: "Soluții B2B HACCP pentru HORECA – Comenzi angro și parteneriate | xHACCP",
    description:
      "Parteneriate B2B pentru restaurante, hoteluri, catering și lanțuri de alimentație publică. Prețuri angro, facturare simplificată și suport dedicat pentru clienții business xHACCP.",
    canonical: base + "/b2b",
  }),
  "/terms": (base) => ({
    title: "Termeni și Condiții | xHACCP",
    description:
      "Citește termenii și condițiile xHACCP privind achiziționarea produselor, livrarea, returul și garanțiile oferite clienților noștri.",
    canonical: base + "/terms",
  }),
  "/privacy": (base) => ({
    title: "Politica de Confidențialitate | xHACCP",
    description:
      "Informații despre modul în care xHACCP colectează, utilizează și protejează datele personale ale utilizatorilor, în conformitate cu GDPR.",
    canonical: base + "/privacy",
  }),
  "/blog": (base) => ({
    title: "Blog HACCP & HoReCa – Resurse pentru siguranța alimentară | xHACCP",
    description:
      "Articole și ghiduri despre HACCP, siguranța alimentară și industria HoReCa din România. Sfaturi practice pentru restaurante, catering și bucătării profesionale.",
    canonical: base + "/blog",
    ogType: "website",
  }),
};

export function registerSeoRoutes(app: Express, storage: IStorage) {
  for (const [route, metaFn] of Object.entries(STATIC_META)) {
    app.get(route, (req, res, next) => {
      if (req.headers.accept && !req.headers.accept.includes("text/html")) {
        return next();
      }
      try {
        const base = getBaseUrl(req);
        const meta = metaFn(base);
        const html = injectMeta(getIndexHtml(), meta);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.get("/blog/:slug", async (req, res, next) => {
    if (req.headers.accept && !req.headers.accept.includes("text/html")) {
      return next();
    }
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;

      let meta: MetaTags = {
        title: "Articol Blog HACCP | xHACCP",
        description: "Articol despre siguranța alimentară și HACCP pentru industria HoReCa din România.",
        canonical: `${base}/blog/${slug}`,
        ogType: "article",
      };

      try {
        const post = await storage.getBlogPostBySlug(slug);
        if (post && post.published) {
          meta = {
            title: `${post.title} | Blog xHACCP`,
            description: post.excerpt ? post.excerpt.slice(0, 160) : meta.description,
            canonical: `${base}/blog/${slug}`,
            ogType: "article",
          };
        }
      } catch (_) {}

      const html = injectMeta(getIndexHtml(), meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/products/:slug", async (req, res, next) => {
    if (req.headers.accept && !req.headers.accept.includes("text/html")) {
      return next();
    }
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;

      let meta: MetaTags = {
        title: "Produs HACCP Profesional | xHACCP",
        description:
          "Descoperă acest produs HACCP profesional de la xHACCP. Calitate superioară pentru bucătării comerciale și restaurante.",
        canonical: `${base}/products/${slug}`,
        ogType: "product",
      };

      try {
        const allProducts = await storage.getProducts({ limit: 10000 });
        const product = allProducts.find((p) => p.slug === slug);
        if (product) {
          const descRaw =
            (product as any).shortDescription ||
            (product as any).description ||
            "";
          const desc = descRaw
            ? descRaw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160)
            : `Cumpără ${product.name} – produs profesional HACCP de la xHACCP. Calitate garantată pentru industria HORECA.`;
          meta = {
            title: `${product.name} | xHACCP`,
            description: desc || `Cumpără ${product.name} de la xHACCP. Livrare rapidă în toată România.`,
            canonical: `${base}/products/${slug}`,
            ogType: "product",
          };
        }
      } catch (_) {}

      const html = injectMeta(getIndexHtml(), meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
    } catch (err) {
      next(err);
    }
  });
}
