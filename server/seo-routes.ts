import { type Express, type Request, type Response } from "express";
import React from "react";
import { renderToString } from "react-dom/server";
import { PublicPage } from "@shared/public-page";
import { canonicalBaseUrl } from "@shared/canonical-url";
import { isPublicSpaPath } from "@shared/public-routing";
import { renderArticleContent, renderProductContent } from "./public-content";
import { buildCatalogBody } from "./public-catalog";
import fs from "fs";
import path from "path";
import { getProductSku } from "@shared/product-sku";
import type { CompanySettings } from "@shared/schema";
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
  image?: string;
  imageAlt?: string;
}

function setMarketAwareCacheHeaders(res: { setHeader(name: string, value: string): void }, cacheControl: string) {
  res.setHeader("Vary", "Host, X-Market");
  res.setHeader("Cache-Control", cacheControl);
}

function getIndexHtml(): string {
  // In development, always use client/index.html so Vite can process it
  // (dist/public/index.html contains production bundle hashes that Vite dev doesn't serve)
  if (process.env.NODE_ENV !== "production") {
    const devPath = path.resolve(process.cwd(), "client", "index.html");
    return fs.readFileSync(devPath, "utf-8");
  }
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

function buildFrenchCompanyInfoHtml(company: CompanySettings | undefined): string {
  if (!company) return "";

  const addressLines = [
    company.address,
    [company.zipCode, company.city].filter(Boolean).join(" "),
    company.country,
  ].filter((line): line is string => Boolean(line));
  const details = [
    company.name ? `<p>${escapeHtml(company.name)}</p>` : "",
    ...addressLines.map((line) => `<p>${escapeHtml(line)}</p>`),
    company.registrationNumber
      ? `<p>SIRET : ${escapeHtml(company.registrationNumber)}</p>`
      : "",
    company.vatNumber ? `<p>TVA : ${escapeHtml(company.vatNumber)}</p>` : "",
  ].filter(Boolean);

  return details.join("\n");
}

/**
 * Removes the leading "x" from "xHACCP" in SEO keyword text so product-type
 * references like "etichete xHACCP" become "etichete HACCP".
 * The brand suffix "| xHACCP" and brand-identity headings are left intact by
 * applying this only to descriptions and body copy, not to page titles.
 */
function seoNormalize(text: string): string {
  return text.replace(/xHACCP/gi, "HACCP");
}

/**
 * Serialize an object to a JSON string safe for embedding inside
 * <script type="application/ld+json">…</script>.
 * Escapes <, >, &, and the Unicode line-separator chars U+2028/U+2029
 * so that malicious content (e.g. "</script>") cannot break out of the
 * script block (stored-XSS mitigation).
 */
function serializeJsonLd(obj: object | object[]): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Maps a market slug to a BCP-47 language code. */
function getLangFromMarket(market: string): string {
  if (market === "fr") return "fr";
  if (market === "com") return "en";
  return "ro"; // default / .ro
}

/** Maps a language code to an Open Graph locale string (language_REGION). */
function getOgLocale(lang: string): string {
  const map: Record<string, string> = {
    ro: "ro_RO",
    fr: "fr_FR",
    en: "en_US",
    de: "de_DE",
    es: "es_ES",
    it: "it_IT",
    pt: "pt_PT",
  };
  return map[lang] ?? "en_US";
}

const DEFAULT_OG_IMAGE = "/og-image.jpg";
const DEFAULT_OG_IMAGE_ALT = "xHACCP – Echipamente și consumabile profesionale HACCP";

/** Resolve local, protocol-relative and remote images to crawler-safe URLs. */
function publicImageUrl(image: string | undefined, canonical: string): string | undefined {
  if (!image?.trim()) return undefined;
  try {
    const url = new URL(image, new URL(canonical).origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function injectMeta(
  html: string,
  meta: MetaTags,
  lang: string,
  bodyHtml?: string,
  jsonLd?: object | object[],
  options?: { homeFallback?: boolean },
): string {
  const title = escapeHtml(meta.title);
  // Apply keyword normalization to description and body copy (not to page title/brand identifiers)
  const description = escapeHtml(seoNormalize(meta.description));
  const canonical = escapeHtml(meta.canonical);
  const ogType = meta.ogType || "website";
  const ogLocale = getOgLocale(lang);
  const routeImage = publicImageUrl(meta.image, meta.canonical);
  const imageUrl = escapeHtml(routeImage || new URL(DEFAULT_OG_IMAGE, meta.canonical).href);
  const imageAlt = escapeHtml(meta.imageAlt || meta.title || DEFAULT_OG_IMAGE_ALT);
  // Replace template social tags instead of leaving duplicate, conflicting tags.
  let result = html.replace(/<meta\b[^>]*(?:property="og:[^"]+"|name="twitter:(?:card|title|description|image(?::alt)?)")[^>]*>/gi, "");

  // Set the correct lang attribute on <html>
  result = result.replace(/(<html\b[^>]*)\blang="[^"]*"/, `$1lang="${lang}"`);
  // If no lang attribute exists, add one
  if (!result.includes(`lang="${lang}"`)) {
    result = result.replace(/(<html\b)/, `$1 lang="${lang}"`);
  }

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
    `<meta property="og:locale" content="${ogLocale}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:alt" content="${imageAlt}" />`,
    ...(!routeImage ? [
      `<meta property="og:image:type" content="image/jpeg" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
    ] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    `<meta name="twitter:image:alt" content="${imageAlt}" />`,
  ].join("\n  ");

  const ldTag = jsonLd
    ? `\n  <script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>`
    : "";

  result = result.replace("</head>", `  ${ogTags}${robotsTag}${ldTag}\n</head>`);

  if (bodyHtml) {
    const homeFallbackAttribute = options?.homeFallback ? ' data-home-fallback="true"' : "";
    result = result.replace(
      '<div id="root"></div>',
      `<div id="public-root"${homeFallbackAttribute}>${renderToString(React.createElement(PublicPage, { html: bodyHtml }))}</div><div id="root" hidden></div>`
    );
    result = result.replace("</head>", `<style>
      .public-content{font-family:system-ui,sans-serif;max-width:1100px;margin:auto;padding:2rem;line-height:1.65}
      .public-content h1{font-size:2rem;font-weight:700}.public-content h2{font-size:1.5rem;font-weight:600}
      .public-content a{color:#075985;text-decoration:underline}.public-content ul{list-style:disc;padding-left:1.5rem}
      .public-content ol{list-style:decimal;padding-left:1.5rem}.public-content p{margin:1rem 0}
      .public-content img{max-width:100%;height:auto}.public-content th,.public-content td{padding:.5rem;border:1px solid #ddd}
      #public-root[data-home-fallback]{display:none}
      #root[hidden]{display:none}
    </style></head>`);
    if (options?.homeFallback) {
      result = result.replace(
        "</body>",
        '<noscript><style>#public-root[data-home-fallback]{display:block}</style></noscript></body>'
      );
    }
  }

  return result;
}

export function getBaseUrl(req: any): string {
  return canonicalBaseUrl(req);
}

async function sendPublicHtml(req: Request, res: Response, html: string) {
  const transform = req.app.locals.transformPublicHtml;
  return res.send(transform ? await transform(req.originalUrl, html) : html);
}

// ---------------------------------------------------------------------------
// Localised static metadata
// ---------------------------------------------------------------------------

type StaticMetaFn = (base: string) => MetaTags;

const STATIC_META_BY_LANG: Record<string, Record<string, StaticMetaFn>> = {
  ro: {
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
    "/returns": (base) => ({
      title: "Politica de retur și rambursare | xHACCP",
      description:
        "Drepturile consumatorilor din România privind retragerea, retururile și rambursările, potrivit legislației române și normelor UE aplicabile.",
      canonical: base + "/returns",
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
  },

  fr: {
    "/": (base) => ({
      title: "xHACCP – Équipements et consommables professionnels HACCP",
      description:
        "Fournisseur premium d'étiquettes HACCP, thermomètres, détergents et équipements professionnels pour cuisine. Livraison rapide. Solutions complètes pour restaurants, hôtels et cafés.",
      canonical: base + "/",
      ogType: "website",
    }),
    "/products": (base) => ({
      title: "Produits HACCP Professionnels – Étiquettes, Thermomètres, Détergents | xHACCP",
      description:
        "Découvrez la gamme complète de produits xHACCP : étiquettes rotation alimentaire, thermomètres numériques, détergents professionnels, contenants alimentaires et accessoires HACCP pour la restauration.",
      canonical: base + "/products",
      ogType: "website",
    }),
    "/about": (base) => ({
      title: "À propos de xHACCP – Fournisseur de solutions HACCP pour la restauration",
      description:
        "xHACCP est votre fournisseur de confiance pour les équipements et consommables HACCP. Découvrez notre histoire, nos valeurs et notre engagement envers la sécurité alimentaire.",
      canonical: base + "/about",
    }),
    "/b2b": (base) => ({
      title: "Solutions B2B HACCP pour la Restauration – Commandes en gros et partenariats | xHACCP",
      description:
        "Partenariats B2B pour restaurants, hôtels, traiteurs et chaînes de restauration. Prix de gros, facturation simplifiée et assistance dédiée pour les clients professionnels xHACCP.",
      canonical: base + "/b2b",
    }),
    "/terms": (base) => ({
      title: "Conditions Générales d'Utilisation | xHACCP",
      description:
        "Consultez les conditions générales d'utilisation xHACCP concernant l'achat de produits, la livraison, les retours et les garanties offerts à nos clients.",
      canonical: base + "/terms",
    }),
    "/privacy": (base) => ({
      title: "Politique de Confidentialité | xHACCP",
      description:
        "Informations sur la façon dont xHACCP collecte, utilise et protège les données personnelles des utilisateurs, conformément au RGPD.",
      canonical: base + "/privacy",
    }),
    "/returns": (base) => ({
      title: "Politique de retour et de remboursement | xHACCP",
      description:
        "Droit de rétractation et retours des consommateurs en France. Formulaire en ligne gratuit conformément aux règles applicables depuis le 19 juin 2026.",
      canonical: base + "/returns",
    }),
    "/blog": (base) => ({
      title: "Blog HACCP & Restauration – Ressources pour la sécurité alimentaire | xHACCP",
      description:
        "Articles et guides sur le HACCP, la sécurité alimentaire et l'industrie de la restauration. Conseils pratiques pour restaurants, traiteurs et cuisines professionnelles.",
      canonical: base + "/blog",
      ogType: "website",
    }),
    "/ai-assistant": (base) => ({
      title: "Assistant IA HACCP – Questions sur la sécurité alimentaire | xHACCP",
      description:
        "Utilisez notre assistant IA pour obtenir des réponses rapides sur les produits xHACCP, les réglementations HACCP et la sécurité alimentaire dans la restauration.",
      canonical: base + "/ai-assistant",
      ogType: "website",
    }),
  },

  en: {
    "/": (base) => ({
      title: "xHACCP – Professional HACCP Equipment & Supplies",
      description:
        "Premium supplier of HACCP labels, thermometers, detergents and professional kitchen equipment. Fast delivery. Complete solutions for restaurants, hotels and cafes.",
      canonical: base + "/",
      ogType: "website",
    }),
    "/products": (base) => ({
      title: "Professional HACCP Products – Labels, Thermometers, Detergents | xHACCP",
      description:
        "Discover the full xHACCP product range: food rotation labels, digital thermometers, professional detergents, food containers and HACCP accessories for foodservice.",
      canonical: base + "/products",
      ogType: "website",
    }),
    "/about": (base) => ({
      title: "About xHACCP – HACCP Solution Provider for Foodservice",
      description:
        "xHACCP is your trusted supplier of HACCP equipment and consumables. Learn about our story, values and commitment to food safety in the foodservice industry.",
      canonical: base + "/about",
    }),
    "/b2b": (base) => ({
      title: "B2B HACCP Solutions for Foodservice – Bulk Orders & Partnerships | xHACCP",
      description:
        "B2B partnerships for restaurants, hotels, catering and food chains. Wholesale pricing, simplified invoicing and dedicated support for xHACCP business clients.",
      canonical: base + "/b2b",
    }),
    "/terms": (base) => ({
      title: "Terms & Conditions | xHACCP",
      description:
        "Read the xHACCP terms and conditions covering product purchases, delivery, returns and warranties offered to our customers.",
      canonical: base + "/terms",
    }),
    "/privacy": (base) => ({
      title: "Privacy Policy | xHACCP",
      description:
        "Information on how xHACCP collects, uses and protects users' personal data in accordance with GDPR.",
      canonical: base + "/privacy",
    }),
    "/returns": (base) => ({
      title: "Return and Refund Policy | xHACCP",
      description:
        "Consumer withdrawal and refund information for the .com storefront, with EU protections where applicable and mandatory local rights preserved.",
      canonical: base + "/returns",
    }),
    "/blog": (base) => ({
      title: "HACCP & Foodservice Blog – Food Safety Resources | xHACCP",
      description:
        "Articles and guides on HACCP, food safety and the foodservice industry. Practical tips for restaurants, catering companies and professional kitchens.",
      canonical: base + "/blog",
      ogType: "website",
    }),
    "/ai-assistant": (base) => ({
      title: "HACCP AI Assistant – Food Safety Questions | xHACCP",
      description:
        "Use our AI assistant to get quick answers about xHACCP products, HACCP regulations and food safety in the foodservice industry.",
      canonical: base + "/ai-assistant",
      ogType: "website",
    }),
  },
};

function getStaticMeta(route: string, base: string, lang: string): StaticMetaFn | undefined {
  const langMeta = STATIC_META_BY_LANG[lang] ?? STATIC_META_BY_LANG["ro"];
  return langMeta[route] ?? STATIC_META_BY_LANG["ro"][route];
}

// ---------------------------------------------------------------------------
// Localised static body HTML (crawler-visible content)
// ---------------------------------------------------------------------------

function buildStaticBodyHtml(
  route: string,
  base: string,
  lang: string,
  companySettings?: CompanySettings,
): string {
  if (lang === "fr") {
    const companyInfoHtml = buildFrenchCompanyInfoHtml(companySettings);
    switch (route) {
      case "/":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>xHACCP – Équipements et consommables professionnels HACCP</h1>
  <p>Fournisseur premium d'étiquettes HACCP, thermomètres, détergents et équipements professionnels pour cuisine et restauration. Livraison rapide.</p>
  <nav aria-label="Catégories principales">
    <ul>
      <li><a href="${base}/products">Tous les produits HACCP</a></li>
      <li><a href="${base}/b2b">Solutions B2B pour la restauration</a></li>
      <li><a href="${base}/blog">Blog HACCP &amp; Sécurité alimentaire</a></li>
      <li><a href="${base}/about">À propos de xHACCP</a></li>
    </ul>
  </nav>
</main>`;
      case "/products":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Produits HACCP Professionnels</h1>
  <p>Découvrez la gamme complète de produits xHACCP : étiquettes rotation alimentaire, thermomètres numériques, détergents professionnels, contenants alimentaires et accessoires HACCP.</p>
  <p><a href="${base}/products">Voir tous les produits</a></p>
</main>`;
      case "/blog":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Blog HACCP &amp; Restauration</h1>
  <p>Articles et guides sur le HACCP, la sécurité alimentaire et l'industrie de la restauration.</p>
  <p><a href="${base}/blog">Lire nos articles</a></p>
</main>`;
      case "/about":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>À propos de xHACCP</h1>
  <p>xHACCP est votre fournisseur de confiance pour les équipements et consommables HACCP. Nous sommes engagés envers la sécurité alimentaire dans la restauration.</p>
  <p><a href="${base}/b2b">Partenariats B2B</a> | <a href="${base}/products">Nos produits</a></p>
</main>`;
      case "/b2b":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Solutions B2B HACCP pour la Restauration</h1>
  <p>Partenariats B2B pour restaurants, hôtels, traiteurs et chaînes de restauration. Prix de gros, facturation simplifiée et assistance dédiée.</p>
  <p><a href="${base}/products">Voir les produits</a> | <a href="${base}/about">À propos</a></p>
</main>`;
      case "/ai-assistant":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Assistant IA HACCP</h1>
  <p>Utilisez notre assistant IA pour obtenir des réponses rapides sur les produits xHACCP, les réglementations HACCP et la sécurité alimentaire.</p>
  <p><a href="${base}/products">Explorer les produits</a> | <a href="${base}/blog">Lire le blog</a></p>
</main>`;
      case "/terms":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Conditions Générales d'Utilisation xHACCP</h1>
  <p>Ce document décrit les conditions générales d'utilisation de la plateforme xHACCP, y compris les informations sur les achats, la livraison, les retours et les garanties.</p>
  ${companyInfoHtml ? `<h2>Informations sur la société</h2>${companyInfoHtml}` : ""}
</main>`;
      case "/privacy":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Politique de Confidentialité xHACCP</h1>
  <p>Informations sur la façon dont xHACCP collecte, utilise et protège les données personnelles des utilisateurs, conformément au Règlement RGPD.</p>
  ${companyInfoHtml ? `<h2>Informations sur la société</h2>${companyInfoHtml}` : ""}
</main>`;
      case "/returns":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Politique de retour et de remboursement</h1>
  <p>Cette version s’applique aux commandes passées sur le domaine français. Les consommateurs peuvent notifier leur rétractation dans le délai légal de 14 jours et doivent ensuite renvoyer les biens dans les 14 jours suivant leur notification.</p>
  <p>Depuis le 19 juin 2026, le droit français impose une fonctionnalité gratuite de rétractation en ligne pour les contrats conclus au moyen d’une interface en ligne. Le formulaire de cette page permet de transmettre votre déclaration.</p>
  ${companyInfoHtml ? `<h2>Vendeur</h2>${companyInfoHtml}` : ""}
  <h2>Adresse de retour</h2><p>Saint Laurent Logistic, ZI SECTEUR D, 30 ALLEE DES GEOMETRES, 06700 SAINT-LAURENT-DU-VAR, France</p>
  <p><a href="${base}/returns">Consulter la politique et confirmer la rétractation</a></p>
</main>`;
    }
  }

  if (lang === "en") {
    switch (route) {
      case "/":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>xHACCP – Professional HACCP Equipment & Supplies</h1>
  <p>Premium supplier of HACCP labels, thermometers, detergents and professional kitchen equipment for foodservice. Fast delivery.</p>
  <nav aria-label="Main categories">
    <ul>
      <li><a href="${base}/products">All HACCP products</a></li>
      <li><a href="${base}/b2b">B2B solutions for foodservice</a></li>
      <li><a href="${base}/blog">HACCP &amp; Food Safety blog</a></li>
      <li><a href="${base}/about">About xHACCP</a></li>
    </ul>
  </nav>
</main>`;
      case "/products":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Professional HACCP Products</h1>
  <p>Discover the full xHACCP range: food rotation labels, digital thermometers, professional detergents, food containers and HACCP accessories for foodservice.</p>
  <p><a href="${base}/products">View all products</a></p>
</main>`;
      case "/blog":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>HACCP &amp; Foodservice Blog</h1>
  <p>Articles and guides on HACCP, food safety and the foodservice industry.</p>
  <p><a href="${base}/blog">Read our articles</a></p>
</main>`;
      case "/about":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>About xHACCP</h1>
  <p>xHACCP is your trusted supplier of HACCP equipment and consumables. We are committed to food safety in the foodservice industry.</p>
  <p><a href="${base}/b2b">B2B partnerships</a> | <a href="${base}/products">Our products</a></p>
</main>`;
      case "/b2b":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>B2B HACCP Solutions for Foodservice</h1>
  <p>B2B partnerships for restaurants, hotels, catering companies and food chains. Wholesale pricing, simplified invoicing and dedicated support.</p>
  <p><a href="${base}/products">View products</a> | <a href="${base}/about">About us</a></p>
</main>`;
      case "/ai-assistant":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>HACCP AI Assistant</h1>
  <p>Use our AI assistant to get quick answers about xHACCP products, HACCP regulations and food safety in the foodservice industry.</p>
  <p><a href="${base}/products">Explore products</a> | <a href="${base}/blog">Read the blog</a></p>
</main>`;
      case "/terms":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>xHACCP Terms & Conditions</h1>
  <p>This document describes the terms and conditions for using the xHACCP platform, including information about purchases, delivery, returns and warranties.</p>
</main>`;
      case "/privacy":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>xHACCP Privacy Policy</h1>
  <p>Information on how xHACCP collects, uses and protects users' personal data in accordance with the GDPR Regulation.</p>
</main>`;
      case "/returns":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Return and Refund Policy</h1>
  <p>This version applies to orders placed through the .com storefront. It summarizes EU consumer protections where they apply and does not limit mandatory consumer rights under the law of your country of residence.</p>
  <p>Where applicable, consumers may notify us of withdrawal within the statutory 14-day period and must then send goods back within 14 days after notice. Refunds follow the applicable statutory deadlines and conditions.</p>
  <p>You may use the online form on this page to submit your withdrawal declaration.</p>
  <p><a href="${base}/returns">Read the policy and confirm your withdrawal</a></p>
</main>`;
    }
  }

  // Default: Romanian
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
    case "/returns":
      return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Politica de retur și rambursare</h1>
  <p>Această versiune se aplică comenzilor plasate pe domeniul românesc. Dreptul de retragere pentru contractele la distanță este reglementat de OUG nr. 34/2014. Consumatorii pot notifica retragerea în termenul legal de 14 zile, iar bunurile trebuie trimise înapoi în următoarele 14 zile de la notificare.</p>
  <p>Garanția legală de conformitate pentru bunurile de consum este reglementată în România, între altele, de OUG nr. 140/2021.</p>
  <p>Pentru contractele încheiate online, folosiți formularul de retragere disponibil pe această pagină.</p>
  <p><a href="${base}/returns">Consultați politica și confirmați retragerea</a></p>
</main>`;
    default:
      return "";
  }
}

/** Returns true when the Accept header indicates an HTML response is acceptable. */
function wantsHtml(req: Request): boolean {
  if (!isPublicSpaPath(req.path)) return false;
  const accept = req.headers.accept || "";
  if (!accept) return true;
  if (accept.includes("text/html")) return true;
  if (accept.includes("*/*")) return true;
  return false;
}

/** Build a 404 HTML page to send to crawlers for unknown routes. */
export function build404Html(req: Request): string {
  const base = getBaseUrl(req);
  const canonical = base + new URL(req.originalUrl || req.url, "http://local").pathname;
  const market = (req as any).market ?? "ro";
  const lang = getLangFromMarket(market);

  const titles: Record<string, string> = {
    ro: "Pagina nu a fost găsită | xHACCP",
    fr: "Page non trouvée | xHACCP",
    en: "Page not found | xHACCP",
  };
  const descs: Record<string, string> = {
    ro: "Pagina căutată nu există pe xHACCP. Reveniți la pagina principală.",
    fr: "La page que vous cherchez n'existe pas sur xHACCP. Retournez à la page d'accueil.",
    en: "The page you are looking for does not exist on xHACCP. Return to the homepage.",
  };
  const bodyTexts: Record<string, { h1: string; p: string; back: string; products: string }> = {
    ro: { h1: "404 – Pagina nu a fost găsită", p: "Pagina pe care o cauți nu există sau a fost mutată.", back: "Înapoi la pagina principală", products: "Produse" },
    fr: { h1: "404 – Page non trouvée", p: "La page que vous cherchez n'existe pas ou a été déplacée.", back: "Retour à l'accueil", products: "Produits" },
    en: { h1: "404 – Page not found", p: "The page you are looking for does not exist or has been moved.", back: "Back to homepage", products: "Products" },
  };
  const t = bodyTexts[lang] ?? bodyTexts["ro"];

  const meta: MetaTags = {
    title: titles[lang] ?? titles["ro"],
    description: descs[lang] ?? descs["ro"],
    canonical,
    robots: "noindex,follow",
  };
  const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:2rem">
  <h1>${t.h1}</h1>
  <p>${t.p}</p>
  <p><a href="${base}/">${t.back}</a> | <a href="${base}/products">${t.products}</a></p>
</main>`;
  return injectMeta(getIndexHtml(), meta, lang, bodyHtml);
}

export function registerSeoRoutes(
  app: Express,
  storage: IStorage,
  marketHelpers?: MarketHelpers
) {
  const routes = ["/", "/products", "/about", "/b2b", "/terms", "/privacy", "/returns", "/ai-assistant"];

  for (const route of routes) {
    app.get(route, async (req, res, next) => {
      if (!wantsHtml(req)) return next();
      try {
        const base = getBaseUrl(req);
        const market = (req as any).market ?? "ro";
        const lang = getLangFromMarket(market);
        const metaFn = getStaticMeta(route, base, lang);
        if (!metaFn) return next();
        const meta = metaFn(base);
        const catalog = route === "/products" ? await buildCatalogBody(req, storage, marketHelpers, base, market, lang) : null;
        const isFrenchLegalPage = lang === "fr" && ["/returns", "/privacy", "/terms"].includes(route);
        const companySettings = isFrenchLegalPage
          ? await storage.getCompanySettingsByMarket(market)
          : undefined;
        const bodyHtml = catalog?.html ?? buildStaticBodyHtml(route, base, lang, companySettings);
        if (catalog) meta.canonical = catalog.canonical;
        const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, undefined, {
          homeFallback: route === "/",
        });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        setMarketAwareCacheHeaders(res, "public, max-age=300");
        await sendPublicHtml(req, res, html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.get("/chef-event", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const market = marketHelpers?.getMarket(req) ?? (req as any).market ?? "ro";
      const meta: MetaTags = {
        title: "Offre spéciale chefs : 20 % de réduction | xHACCP France",
        description: "Inscrivez-vous et recevez par email votre code personnel de réduction de 20 % sur xHACCP France. Offre valable 12 mois, à activer sous 30 jours.",
        canonical: `${base}/chef-event`,
        image: `${base}/attached_assets/logo_xHACCP-S1_1772812623761.png`,
        imageAlt: "xHACCP France – Équipements et consommables HACCP",
        ...(market !== "fr" ? { robots: "noindex,follow" } : {}),
      };
      const body = `<main><h1>L'équipement HACCP pensé pour votre cuisine.</h1>
        <p>Offre spéciale événement</p><p>Inscrivez-vous et recevez par email votre code personnel de réduction de 20 % sur xHACCP France.</p>
        <ul><li>20 % de réduction</li><li>Code envoyé par email</li><li>Offre valable 12 mois</li></ul>
        <h2>Activez votre offre sous 30 jours</h2>
        <p>Effectuez votre première commande dans les 30 jours pour conserver votre réduction pendant les 12 mois de validité.</p>
        <p><a href="/products">Découvrez les produits HACCP</a></p></main>`;
      res.type("html");
      setMarketAwareCacheHeaders(res, "public, max-age=300");
      await sendPublicHtml(req, res, injectMeta(getIndexHtml(), meta, "fr", body));
    } catch (error) { next(error); }
  });

  app.get("/blog", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const market = (req as any).market ?? "ro";
      const lang = getLangFromMarket(market);
      const metaFn = getStaticMeta("/blog", base, lang);
      const meta: MetaTags = metaFn
        ? metaFn(base)
        : {
            title: "Blog HACCP & HoReCa – Resurse pentru siguranța alimentară | xHACCP",
            description:
              "Articole și ghiduri despre HACCP, siguranța alimentară și industria HoReCa din România. Sfaturi practice pentru restaurante, catering și bucătării profesionale.",
            canonical: `${base}/blog`,
            ogType: "website",
          };

      const publishedPosts = await storage.getBlogPosts({ published: true, marketCode: market });

      const blogJsonLd: object[] = [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Blog xHACCP",
          "description": meta.description,
          "url": `${base}/blog`,
          "publisher": { "@type": "Organization", "name": "xHACCP", "url": base },
        },
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": meta.title,
          "url": `${base}/blog`,
          "itemListElement": publishedPosts.map((post, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": post.title,
            "url": `${base}/blog/${post.slug}`,
          })),
        },
      ];

      const entries = publishedPosts.map(post => `<li><article>
        <h2><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
        ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
        </article></li>`).join("");
      const bodyHtml = buildStaticBodyHtml("/blog", base, lang).replace("</main>", `<ul>${entries}</ul></main>`);
      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, blogJsonLd);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      setMarketAwareCacheHeaders(res, "public, max-age=300");
      await sendPublicHtml(req, res, html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/blog/:slug", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;
      const market = (req as any).market ?? "ro";
      const lang = getLangFromMarket(market);

      let post = await storage.getBlogPostBySlug(slug, market);

      if (!post || !post.published || (post.marketCode ?? "ro") !== market) {
        const notFoundTitles: Record<string, string> = {
          ro: "Articol negăsit | xHACCP",
          fr: "Article non trouvé | xHACCP",
          en: "Article not found | xHACCP",
        };
        const notFoundDescs: Record<string, string> = {
          ro: "Articolul solicitat nu a fost găsit.",
          fr: "L'article demandé n'a pas été trouvé.",
          en: "The requested article was not found.",
        };
        const notFoundBody: Record<string, { h1: string; p: string; back: string }> = {
          ro: { h1: "Articolul nu a fost găsit", p: "Articolul solicitat nu există sau nu este publicat.", back: "Înapoi la blog" },
          fr: { h1: "Article non trouvé", p: "L'article demandé n'existe pas ou n'est pas publié.", back: "Retour au blog" },
          en: { h1: "Article not found", p: "The requested article does not exist or is not published.", back: "Back to blog" },
        };
        const t = notFoundBody[lang] ?? notFoundBody["ro"];
        const meta: MetaTags = {
          title: notFoundTitles[lang] ?? notFoundTitles["ro"],
          description: notFoundDescs[lang] ?? notFoundDescs["ro"],
          canonical: `${base}/blog/${slug}`,
          robots: "noindex,follow",
        };
        const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>${t.h1}</h1>
  <p>${t.p}</p>
  <p><a href="${base}/blog">${t.back}</a></p>
</main>`;
        const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.status(404);
        return await sendPublicHtml(req, res, html);
      }

      if ((post.language || "ro") !== lang) {
        const translations = await storage.getBlogPostTranslations(post.id);
        const translation = translations.find(t => t.language === lang);
        if (translation) post = { ...post, title: translation.title, excerpt: translation.excerpt, content: translation.content };
      }

      const meta: MetaTags = {
        title: `${post.title} | Blog xHACCP`,
        description: post.excerpt
          ? post.excerpt.slice(0, 160)
          : lang === "fr"
            ? "Article sur la sécurité alimentaire et le HACCP pour la restauration."
            : lang === "en"
              ? "Article on food safety and HACCP for the foodservice industry."
              : "Articol despre siguranța alimentară și HACCP pentru industria HoReCa din România.",
        canonical: `${base}/blog/${slug}`,
        ogType: "article",
        image: post.imageUrl || undefined,
        imageAlt: post.title,
      };

      const backLabels: Record<string, string> = { ro: "Înapoi la blog", fr: "Retour au blog", en: "Back to blog" };
      const backLabel = backLabels[lang] ?? backLabels["ro"];

      const bodyContent = renderArticleContent(post.content || "");
      const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    ${post.excerpt ? `<p><strong>${escapeHtml(post.excerpt)}</strong></p>` : ""}
    ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}" />` : ""}
    ${bodyContent}
    <p><a href="${base}/blog">${backLabel}</a></p>
  </article>
</main>`;

      const blogPostingSchema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${base}/blog/${slug}` },
        "url": `${base}/blog/${slug}`,
        "author": { "@type": "Person", "name": post.author || "xHACCP" },
        "publisher": { "@type": "Organization", "name": "xHACCP", "url": base },
        "articleSection": post.category,
      };
      if (post.excerpt) blogPostingSchema["description"] = post.excerpt.slice(0, 300);
      const articleImage = publicImageUrl(post.imageUrl ?? undefined, base);
      if (articleImage) blogPostingSchema["image"] = articleImage;
      if (post.publishedAt) blogPostingSchema["datePublished"] = new Date(post.publishedAt).toISOString();
      if (post.updatedAt) blogPostingSchema["dateModified"] = new Date(post.updatedAt).toISOString();
      if (post.tags?.length) blogPostingSchema["keywords"] = post.tags.join(", ");

      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, blogPostingSchema);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      setMarketAwareCacheHeaders(res, "public, max-age=300");
      await sendPublicHtml(req, res, html);
    } catch (err) {
      next(err);
    }
  });

  app.get("/products/:slug", async (req, res, next) => {
    if (!wantsHtml(req)) return next();
    try {
      const base = getBaseUrl(req);
      const { slug } = req.params;
      const market = (req as any).market ?? "ro";
      const lang = getLangFromMarket(market);

      let product: any = null;
        const allProducts = await storage.getProducts({ limit: 10000 });
        for (const candidate of allProducts) {
          if (candidate.status?.toLowerCase() !== "active") continue;
          const translation = candidate.slug === slug ? null
            : await storage.getProductTranslation(candidate.id, lang);
          if (candidate.slug !== slug && translation?.slug !== slug) continue;
          const overlaid = marketHelpers
            ? marketHelpers.applyOverlay(candidate, market)
            : candidate;
          if (overlaid) {
            product = overlaid;
            break;
          }
        }

      if (!product) {
        const notFoundTitles: Record<string, string> = {
          ro: "Produs negăsit | xHACCP",
          fr: "Produit non trouvé | xHACCP",
          en: "Product not found | xHACCP",
        };
        const notFoundDescs: Record<string, string> = {
          ro: "Produsul solicitat nu a fost găsit.",
          fr: "Le produit demandé n'a pas été trouvé.",
          en: "The requested product was not found.",
        };
        const notFoundBody: Record<string, { h1: string; p: string; back: string }> = {
          ro: { h1: "Produs negăsit", p: "Produsul solicitat nu există sau nu este disponibil.", back: "Înapoi la produse" },
          fr: { h1: "Produit non trouvé", p: "Le produit demandé n'existe pas ou n'est pas disponible.", back: "Retour aux produits" },
          en: { h1: "Product not found", p: "The requested product does not exist or is not available.", back: "Back to products" },
        };
        const t = notFoundBody[lang] ?? notFoundBody["ro"];
        const meta: MetaTags = {
          title: notFoundTitles[lang] ?? notFoundTitles["ro"],
          description: notFoundDescs[lang] ?? notFoundDescs["ro"],
          canonical: `${base}/products/${slug}`,
          robots: "noindex,follow",
        };
        const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>${t.h1}</h1>
  <p>${t.p}</p>
  <p><a href="${base}/products">${t.back}</a></p>
</main>`;
        const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        setMarketAwareCacheHeaders(res, "no-store");
        res.status(404);
        return await sendPublicHtml(req, res, html);
      }

      // Use the same localized description and slug as the public product page.
      let translatedName: string = product.name;
      let translatedDesc: string =
        product.descriptionHtml || product.description || "";
      let canonicalSlug = product.slug;

      if (product.id) {
        const translation = await storage.getProductTranslation(product.id, lang);
        if (translation) {
          if (translation.name) translatedName = translation.name;
          if (translation.description) translatedDesc = translation.description;
          if (translation.slug) canonicalSlug = translation.slug;
        }
      }

      // Strip the leading "x" from "xHACCP" in product names for SEO keywords
      // e.g. "Etichete xHACCP" → "Etichete HACCP" (brand suffix "| xHACCP" kept intact)
      const seoName = translatedName.replace(/xHACCP/gi, "HACCP");

      const descClean = translatedDesc
        ? translatedDesc.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").replace(/xHACCP/gi, "HACCP").trim().slice(0, 160)
        : "";

      const fallbackDesc: Record<string, string> = {
        ro: `Cumpără ${seoName} – produs profesional HACCP de la xHACCP. Calitate garantată pentru industria HORECA.`,
        fr: `Achetez ${seoName} – produit professionnel HACCP de xHACCP. Qualité garantie pour la restauration.`,
        en: `Buy ${seoName} – professional HACCP product from xHACCP. Guaranteed quality for foodservice.`,
      };
      const desc = descClean || (fallbackDesc[lang] ?? fallbackDesc["en"]);

      const rawProductImage: string | undefined =
        product.imageUrl || (Array.isArray(product.images) && product.images[0]) || undefined;
      const productImage = publicImageUrl(rawProductImage, base);

      const meta: MetaTags = {
        title: `${seoName} | xHACCP`,
        description: desc,
        canonical: `${base}/products/${encodeURIComponent(canonicalSlug)}`,
        ogType: "product",
        image: productImage,
        imageAlt: seoName,
      };
      const productUrl = meta.canonical;

      const descFull = renderProductContent(translatedDesc, translatedName);
      const price = product.price
        ? `<p><strong>${lang === "fr" ? "Prix" : lang === "en" ? "Price" : "Preț"}: ${product.price} ${product.currency || "RON"}</strong></p>`
        : "";
      const backLabel = lang === "fr" ? "Retour aux produits" : lang === "en" ? "Back to products" : "Înapoi la produse";
      const breadcrumbItems: object[] = [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
        { "@type": "ListItem", "position": 2, "name": "Products", "item": `${base}/products` },
      ];
      if (product.category?.slug) {
        breadcrumbItems.push({ "@type": "ListItem", "position": 3, "name": product.category.name, "item": `${base}/products?category=${product.category.slug}` });
        breadcrumbItems.push({ "@type": "ListItem", "position": 4, "name": seoName, "item": productUrl });
      } else {
        breadcrumbItems.push({ "@type": "ListItem", "position": 3, "name": seoName, "item": productUrl });
      }
      const productObj: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": seoName,
        "sku": getProductSku(product),
        "url": productUrl,
        "brand": { "@type": "Brand", "name": "xHACCP" },
        "offers": {
          "@type": "Offer",
          "price": product.price,
          "priceCurrency": product.currency || "RON",
          "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "url": productUrl,
        },
      };
      if (desc) productObj["description"] = desc;
      if (productImage) productObj["image"] = productImage;
      if ((product.reviewCount || 0) > 0 && product.rating) {
        productObj["aggregateRating"] = {
          "@type": "AggregateRating",
          "ratingValue": product.rating,
          "reviewCount": product.reviewCount,
        };
      }
      const productJsonLd = [
        productObj,
        { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": breadcrumbItems },
      ];
      const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <article itemscope itemtype="https://schema.org/Product">
    <h1 itemprop="name">${escapeHtml(translatedName)}</h1>
    ${price}
    ${productImage ? `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(translatedName)}" />` : ""}
    <div itemprop="description">${descFull}</div>
    ${Array.isArray(product.specs) ? `<dl>${product.specs.filter((s: any) => s.label && s.value).map((s: any) => `<dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}</dd>`).join("")}</dl>` : ""}
    <dl>${["weight", "length", "width", "height", "piecesPerPackage", "productQuantity"].filter(key => product[key]).map(key => {
      const labels: Record<string, string[]> = {
        weight: ["Greutate (kg)", "Poids (kg)", "Weight (kg)"], length: ["Lungime (cm)", "Longueur (cm)", "Length (cm)"],
        width: ["Lățime (cm)", "Largeur (cm)", "Width (cm)"], height: ["Înălțime (cm)", "Hauteur (cm)", "Height (cm)"],
        piecesPerPackage: ["Bucăți per pachet", "Pièces par colis", "Pieces per package"], productQuantity: ["Conținut net", "Contenu net", "Net content"],
      };
      return `<dt>${escapeHtml(labels[key][lang === "fr" ? 1 : lang === "en" ? 2 : 0])}</dt><dd>${escapeHtml(String(product[key]))}</dd>`;
    }).join("")}</dl>
    ${product.category?.slug ? `<p><a href="/products?category=${encodeURIComponent(market === "fr" && product.category.slug === "food-labels" ? "etiquettes-alimentaires" : product.category.slug)}">${escapeHtml(product.category.name)}</a></p>` : ""}
    <p><a href="${base}/products">${backLabel}</a></p>
  </article>
</main>`;

      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, productJsonLd);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      setMarketAwareCacheHeaders(res, "public, max-age=300");
      await sendPublicHtml(req, res, html);
    } catch (err) {
      next(err);
    }
  });
}
