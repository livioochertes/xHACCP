import { type Express, type Request } from "express";
import fs from "fs";
import path from "path";
import type { IStorage } from "./storage";

export interface MarketHelpers {
  getMarket: (req: Request) => string;
  applyOverlay: (product: any, market: string) => any | null;
}

interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  robots?: string;
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

function injectMeta(html: string, meta: MetaTags, bodyHtml?: string): string {
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

  const robotsTag = meta.robots
    ? `\n  <meta name="robots" content="${meta.robots}" />`
    : "";

  const ogTags = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:site_name" content="xHACCP" />`,
  ].join("\n  ");

  result = result.replace("</head>", `  ${ogTags}${robotsTag}\n</head>`);

  if (bodyHtml) {
    result = result.replace(
      '<div id="root"></div>',
      `<div id="root">${bodyHtml}</div>`
    );
  }

  return result;
}

export function getBaseUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "xhaccp.ro";
  return `${proto}://${host}`;
}

/** Build a 404 HTML page to send to crawlers for unknown routes. */
export function build404Html(req: Request): string {
  const base = getBaseUrl(req);
  const canonical = base + req.path;
  const meta: MetaTags = {
    title: "Pagina nu a fost găsită | xHACCP",
    description: "Pagina căutată nu există pe xHACCP. Reveniți la pagina principală.",
    canonical,
    robots: "noindex,follow",
  };
  const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  <h1>404 – Pagina nu a fost găsită</h1>
  <p>Pagina pe care o cauți nu există sau a fost mutată.</p>
  <p><a href="${base}/">Înapoi la pagina principală</a> | <a href="${base}/products">Produse</a></p>
</main>`;
  return injectMeta(getIndexHtml(), meta, bodyHtml);
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
  "/ai-assistant": (base) => ({
    title: "Asistent AI HACCP – Întrebări despre siguranța alimentară | xHACCP",
    description:
      "Folosește asistentul nostru AI pentru a obține răspunsuri rapide despre produsele xHACCP, reglementările HACCP și siguranța alimentară în industria HORECA.",
    canonical: base + "/ai-assistant",
    ogType: "website",
  }),
};

function buildStaticBodyHtml(route: string, base: string): string {
  switch (route) {
    case "/":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>xHACCP – Echipamente și consumabile profesionale HACCP</h1>
  <p>Furnizor premium de etichete HACCP, termometre, detergenți și echipamente profesionale pentru bucătărie și industria HORECA. Livrare rapidă în toată România.</p>
  <nav aria-label="Categorii principale">
    <ul>
      <li><a href="${base}/products">Toate produsele HACCP</a></li>
      <li><a href="${base}/b2b">Soluții B2B pentru HORECA</a></li>
      <li><a href="${base}/blog">Blog HACCP &amp; Siguranță Alimentară</a></li>
      <li><a href="${base}/about">Despre xHACCP</a></li>
    </ul>
  </nav>
</main>`;
    case "/products":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Produse HACCP Profesionale</h1>
  <p>Descoperă gama completă de produse xHACCP: etichete rotație alimente, termometre digitale, detergenți profesionali, recipiente alimentare și accesorii HACCP pentru HORECA.</p>
  <p><a href="${base}/products">Vezi toate produsele</a></p>
</main>`;
    case "/blog":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Blog HACCP &amp; HoReCa</h1>
  <p>Articole și ghiduri despre HACCP, siguranța alimentară și industria HoReCa din România.</p>
  <p><a href="${base}/blog">Citește articolele noastre</a></p>
</main>`;
    case "/about":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Despre xHACCP</h1>
  <p>xHACCP este furnizorul tău de încredere pentru echipamente și consumabile HACCP. Suntem angajați față de siguranța alimentară în industria HORECA din România.</p>
  <p><a href="${base}/b2b">Parteneriate B2B</a> | <a href="${base}/products">Produsele noastre</a></p>
</main>`;
    case "/b2b":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Soluții B2B HACCP pentru HORECA</h1>
  <p>Parteneriate B2B pentru restaurante, hoteluri, catering și lanțuri de alimentație publică. Prețuri angro, facturare simplificată și suport dedicat pentru clienții business xHACCP.</p>
  <p><a href="${base}/products">Vezi produsele</a> | <a href="${base}/about">Despre noi</a></p>
</main>`;
    case "/ai-assistant":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Asistent AI HACCP</h1>
  <p>Folosește asistentul nostru AI pentru a obține răspunsuri rapide despre produsele xHACCP, reglementările HACCP și siguranța alimentară în industria HORECA.</p>
  <p><a href="${base}/products">Explorează produsele</a> | <a href="${base}/blog">Citește blogul</a></p>
</main>`;
    case "/terms":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Termeni și Condiții xHACCP</h1>
  <p>Acest document descrie termenii și condițiile de utilizare a platformei xHACCP, inclusiv informații despre achiziții, livrare, retur și garanții.</p>
</main>`;
    case "/privacy":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Politica de Confidențialitate xHACCP</h1>
  <p>Informații despre modul în care xHACCP colectează, utilizează și protejează datele personale ale utilizatorilor, în conformitate cu Regulamentul GDPR.</p>
</main>`;
    default:
      return "";
  }
}

/** Returns true when the Accept header indicates an HTML response is acceptable. */
function wantsHtml(req: Request): boolean {
  const accept = req.headers.accept || "";
  if (!accept) return true; // no preference → serve HTML
  if (accept.includes("text/html")) return true;
  if (accept.includes("*/*")) return true;
  return false;
}

export function registerSeoRoutes(
  app: Express,
  storage: IStorage,
  marketHelpers?: MarketHelpers
) {
  for (const [route, metaFn] of Object.entries(STATIC_META)) {
    app.get(route, (req, res, next) => {
      if (!wantsHtml(req)) return next();
      try {
        const base = getBaseUrl(req);
        const meta = metaFn(base);
        const bodyHtml = buildStaticBodyHtml(route, base);
        const html = injectMeta(getIndexHtml(), meta, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.get("/blog/:slug", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;

      let post: any = null;
      try {
        post = await storage.getBlogPostBySlug(slug);
      } catch (_) {}

      if (!post || !post.published) {
        const meta: MetaTags = {
          title: "Articol negăsit | xHACCP",
          description: "Articolul solicitat nu a fost găsit.",
          canonical: `${base}/blog/${slug}`,
          robots: "noindex,follow",
        };
        const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Articolul nu a fost găsit</h1>
  <p>Articolul solicitat nu există sau nu este publicat.</p>
  <p><a href="${base}/blog">Înapoi la blog</a></p>
</main>`;
        const html = injectMeta(getIndexHtml(), meta, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send(html);
      }

      const meta: MetaTags = {
        title: `${post.title} | Blog xHACCP`,
        description: post.excerpt
          ? post.excerpt.slice(0, 160)
          : "Articol despre siguranța alimentară și HACCP pentru industria HoReCa din România.",
        canonical: `${base}/blog/${slug}`,
        ogType: "article",
      };

      const bodyContent = post.content
        ? post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600)
        : "";
      const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    ${post.excerpt ? `<p><strong>${escapeHtml(post.excerpt.slice(0, 200))}</strong></p>` : ""}
    ${bodyContent ? `<p>${escapeHtml(bodyContent)}</p>` : ""}
    <p><a href="${base}/blog">Înapoi la blog</a></p>
  </article>
</main>`;

      const html = injectMeta(getIndexHtml(), meta, bodyHtml);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/products/:slug", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;

      let product: any = null;
      try {
        const allProducts = await storage.getProducts({ limit: 10000 });
        const match = allProducts.find(
          (p) => p.slug === slug && p.status?.toLowerCase() === "active"
        );
        if (match && marketHelpers) {
          const market = marketHelpers.getMarket(req);
          const overlaid = marketHelpers.applyOverlay(match, market);
          product = overlaid; // null if market-unavailable
        } else {
          product = match ?? null;
        }
      } catch (_) {}

      if (!product) {
        const meta: MetaTags = {
          title: "Produs negăsit | xHACCP",
          description: "Produsul solicitat nu a fost găsit.",
          canonical: `${base}/products/${slug}`,
          robots: "noindex,follow",
        };
        const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Produs negăsit</h1>
  <p>Produsul solicitat nu există sau nu este disponibil.</p>
  <p><a href="${base}/products">Înapoi la produse</a></p>
</main>`;
        const html = injectMeta(getIndexHtml(), meta, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send(html);
      }

      const descRaw =
        (product as any).shortDescription ||
        (product as any).description ||
        "";
      const descClean = descRaw
        ? descRaw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160)
        : "";
      const desc =
        descClean ||
        `Cumpără ${product.name} – produs profesional HACCP de la xHACCP. Calitate garantată pentru industria HORECA.`;

      const meta: MetaTags = {
        title: `${product.name} | xHACCP`,
        description: desc,
        canonical: `${base}/products/${slug}`,
        ogType: "product",
      };

      const bodyDescFull = descRaw
        ? descRaw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
        : "";
      const price = product.price
        ? `<p><strong>Preț: ${product.price} ${product.currency || "RON"}</strong></p>`
        : "";
      const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <article itemscope itemtype="https://schema.org/Product">
    <h1 itemprop="name">${escapeHtml(product.name)}</h1>
    ${price}
    ${bodyDescFull ? `<p itemprop="description">${escapeHtml(bodyDescFull)}</p>` : ""}
    <p><a href="${base}/products">Înapoi la produse</a></p>
  </article>
</main>`;

      const html = injectMeta(getIndexHtml(), meta, bodyHtml);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
    } catch (err) {
      next(err);
    }
  });
}
