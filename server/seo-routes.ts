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
  image?: string;
  imageAlt?: string;
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

const DEFAULT_OG_IMAGE = "https://xhaccp.ro/og-image.png";
const DEFAULT_OG_IMAGE_ALT = "xHACCP – Echipamente și consumabile profesionale HACCP";

function injectMeta(html: string, meta: MetaTags, lang: string, bodyHtml?: string, jsonLd?: object | object[]): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = meta.canonical;
  const ogType = meta.ogType || "website";
  const ogLocale = getOgLocale(lang);
  const imageUrl = meta.image || DEFAULT_OG_IMAGE;
  const imageAlt = escapeHtml(meta.imageAlt || meta.title || DEFAULT_OG_IMAGE_ALT);
  let result = html;

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
    result = result.replace(
      '<div id="root"></div>',
      `<div aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">${bodyHtml}</div><div id="root"></div>`
    );
  }

  return result;
}

export function getBaseUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "xhaccp.ro";
  return `${proto}://${host}`;
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

function buildStaticBodyHtml(route: string, base: string, lang: string): string {
  if (lang === "fr") {
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
</main>`;
      case "/privacy":
        return `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <h1>Politique de Confidentialité xHACCP</h1>
  <p>Informations sur la façon dont xHACCP collecte, utilise et protège les données personnelles des utilisateurs, conformément au Règlement RGPD.</p>
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
    default:
      return "";
  }
}

/** Returns true when the Accept header indicates an HTML response is acceptable. */
function wantsHtml(req: Request): boolean {
  const accept = req.headers.accept || "";
  if (!accept) return true;
  if (accept.includes("text/html")) return true;
  if (accept.includes("*/*")) return true;
  return false;
}

/** Build a 404 HTML page to send to crawlers for unknown routes. */
export function build404Html(req: Request): string {
  const base = getBaseUrl(req);
  const canonical = base + req.path;
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
  const routes = ["/", "/products", "/about", "/b2b", "/terms", "/privacy", "/ai-assistant"];

  for (const route of routes) {
    app.get(route, (req, res, next) => {
      if (!wantsHtml(req)) return next();
      try {
        const base = getBaseUrl(req);
        const market = (req as any).market ?? "ro";
        const lang = getLangFromMarket(market);
        const metaFn = getStaticMeta(route, base, lang);
        if (!metaFn) return next();
        const meta = metaFn(base);
        const bodyHtml = buildStaticBodyHtml(route, base, lang);
        const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(html);
      } catch (err) {
        next(err);
      }
    });
  }

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

      let publishedPosts: any[] = [];
      try {
        publishedPosts = await storage.getBlogPosts({ published: true, limit: 100 });
      } catch (_) {}

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

      const bodyHtml = buildStaticBodyHtml("/blog", base, lang);
      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, blogJsonLd);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
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

      let post: any = null;
      try {
        post = await storage.getBlogPostBySlug(slug);
      } catch (_) {}

      if (!post || !post.published) {
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
        return res.status(404).send(html);
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
        image: post.imageUrl
          ? post.imageUrl.startsWith("http")
            ? post.imageUrl
            : `${base}${post.imageUrl.startsWith("/") ? "" : "/"}${post.imageUrl}`
          : undefined,
        imageAlt: post.title,
      };

      const backLabels: Record<string, string> = { ro: "Înapoi la blog", fr: "Retour au blog", en: "Back to blog" };
      const backLabel = backLabels[lang] ?? backLabels["ro"];

      const bodyContent = post.content
        ? post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600)
        : "";
      const bodyHtml = `
<main style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:1rem">
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    ${post.excerpt ? `<p><strong>${escapeHtml(post.excerpt.slice(0, 200))}</strong></p>` : ""}
    ${bodyContent ? `<p>${escapeHtml(bodyContent)}</p>` : ""}
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
      if (post.imageUrl) blogPostingSchema["image"] = post.imageUrl;
      if (post.publishedAt) blogPostingSchema["datePublished"] = new Date(post.publishedAt).toISOString();
      if (post.updatedAt) blogPostingSchema["dateModified"] = new Date(post.updatedAt).toISOString();
      if (post.tags?.length) blogPostingSchema["keywords"] = post.tags.join(", ");

      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, blogPostingSchema);
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
      const market = (req as any).market ?? "ro";
      const lang = getLangFromMarket(market);

      let product: any = null;
      try {
        const allProducts = await storage.getProducts({ limit: 10000 });
        const match = allProducts.find(
          (p) => p.slug === slug && p.status?.toLowerCase() === "active"
        );
        if (match && marketHelpers) {
          const overlaid = marketHelpers.applyOverlay(match, market);
          product = overlaid;
        } else {
          product = match ?? null;
        }
      } catch (_) {}

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
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send(html);
      }

      // Attempt to fetch a server-side translation for non-English markets
      let translatedName: string = product.name;
      let translatedDesc: string =
        (product as any).shortDescription || (product as any).description || "";

      if (lang !== "en" && product.id) {
        try {
          const translation = await storage.getProductTranslation(product.id, lang);
          if (translation) {
            if (translation.name) translatedName = translation.name;
            if (translation.description) translatedDesc = translation.description;
          }
        } catch (_) {}
      }

      const descClean = translatedDesc
        ? translatedDesc.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160)
        : "";

      const fallbackDesc: Record<string, string> = {
        ro: `Cumpără ${translatedName} – produs profesional HACCP de la xHACCP. Calitate garantată pentru industria HORECA.`,
        fr: `Achetez ${translatedName} – produit professionnel HACCP de xHACCP. Qualité garantie pour la restauration.`,
        en: `Buy ${translatedName} – professional HACCP product from xHACCP. Guaranteed quality for foodservice.`,
      };
      const desc = descClean || (fallbackDesc[lang] ?? fallbackDesc["en"]);

      const rawProductImage: string | undefined =
        product.imageUrl || (Array.isArray(product.images) && product.images[0]) || undefined;
      const productImage = rawProductImage
        ? rawProductImage.startsWith("http")
          ? rawProductImage
          : `${base}${rawProductImage.startsWith("/") ? "" : "/"}${rawProductImage}`
        : undefined;

      const meta: MetaTags = {
        title: `${translatedName} | xHACCP`,
        description: desc,
        canonical: `${base}/products/${slug}`,
        ogType: "product",
        image: productImage,
        imageAlt: translatedName,
      };

      const descFull = translatedDesc
        ? translatedDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
        : "";
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
        breadcrumbItems.push({ "@type": "ListItem", "position": 4, "name": translatedName, "item": `${base}/products/${slug}` });
      } else {
        breadcrumbItems.push({ "@type": "ListItem", "position": 3, "name": translatedName, "item": `${base}/products/${slug}` });
      }
      const productObj: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": translatedName,
        "sku": `KP-${product.id}`,
        "url": `${base}/products/${slug}`,
        "brand": { "@type": "Brand", "name": "xHACCP" },
        "offers": {
          "@type": "Offer",
          "price": product.price,
          "priceCurrency": product.currency || "RON",
          "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "url": `${base}/products/${slug}`,
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
    ${descFull ? `<p itemprop="description">${escapeHtml(descFull)}</p>` : ""}
    <p><a href="${base}/products">${backLabel}</a></p>
  </article>
</main>`;

      const html = injectMeta(getIndexHtml(), meta, lang, bodyHtml, productJsonLd);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(html);
    } catch (err) {
      next(err);
    }
  });
}
