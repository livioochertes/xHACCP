import type { Request } from "express";
import type { IStorage } from "./storage";
import type { MarketHelpers } from "./seo-routes";
import { escapePublicText as esc } from "./public-content";

export async function buildCatalogBody(
  req: Request, storage: IStorage, helpers: MarketHelpers | undefined,
  base: string, market: string, lang: string,
) {
  const labels = lang === "fr"
    ? { title: "Produits HACCP Professionnels", categories: "Catégories", previous: "Précédent", next: "Suivant", empty: "Aucun produit trouvé." }
    : lang === "en"
      ? { title: "Professional HACCP Products", categories: "Categories", previous: "Previous", next: "Next", empty: "No products found." }
      : { title: "Produse HACCP Profesionale", categories: "Categorii", previous: "Anterior", next: "Următor", empty: "Nu au fost găsite produse." };
  const categories = await storage.getCategories(market);
  const publicCategory = (slug: string) => market === "fr" && slug === "food-labels" ? "etiquettes-alimentaires" : slug;
  const categorySlug = String(req.query.category || "");
  const category = categories.find(c => publicCategory(c.slug) === categorySlug || c.slug === categorySlug);
  const search = String(req.query.search || "").trim();
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", category ? publicCategory(category.slug) : categorySlug);
  if (search) params.set("search", search);
  const pageUrl = (n: number) => {
    const query = new URLSearchParams(params);
    if (n > 1) query.set("page", String(n));
    return `/products${query.size ? `?${query}` : ""}`;
  };
  const raw = await storage.getProducts({ limit: 10000 });
  const filtered = raw.filter(p => p.status?.toLowerCase() === "active")
    .map(p => helpers ? helpers.applyOverlay(p, market) : p)
    .filter(p => p && (!categorySlug || (category && p.categoryId === category.id))
      && (!search || p.name.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  const totalPages = Math.ceil(filtered.length / 20);
  const entries = await Promise.all(filtered.slice((page - 1) * 20, page * 20).map(async p => {
    const tr = lang !== "ro" ? await storage.getProductTranslation(p.id, lang) : null;
    const name = tr?.name || p.name;
    return `<li><article><h2><a href="/products/${encodeURIComponent(tr?.slug || p.slug)}">${esc(name)}</a></h2>
      ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(name)}" width="160" loading="lazy" />` : ""}
      <p>${esc(p.price)} ${esc(p.currency || (market === "ro" ? "RON" : "EUR"))}</p></article></li>`;
  }));
  const navigation = categories.filter(c => c.showOnMainShop).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(c => `<li><a href="/products?category=${encodeURIComponent(publicCategory(c.slug))}">${esc(c.name)}</a></li>`).join("");
  return {
    canonical: `${base}${pageUrl(page)}`,
    html: `<main><h1>${esc(labels.title)}${category ? ` – ${esc(category.name)}` : ""}</h1>
      ${category?.description ? `<p>${esc(category.description)}</p>` : ""}
      <nav aria-label="${esc(labels.categories)}"><ul>${navigation}</ul></nav>
      ${entries.length ? `<ul>${entries.join("")}</ul>` : `<p>${esc(labels.empty)}</p>`}
      <nav aria-label="Pagination">
        ${page > 1 ? `<a rel="prev" href="${esc(pageUrl(page - 1))}">${esc(labels.previous)}</a>` : ""}
        ${page < totalPages ? `<a rel="next" href="${esc(pageUrl(page + 1))}">${esc(labels.next)}</a>` : ""}
      </nav></main>`,
  };
}