import cron, { type ScheduledTask } from "node-cron";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  categories,
  googleMerchantFeedCategories,
  googleMerchantFeedProducts,
  googleMerchantFeeds,
  marketSettings,
  productMarkets,
  productTranslations,
  products,
  type GoogleMerchantFeed,
} from "@shared/schema";

export type MerchantMarket = "ro" | "fr" | "com";

const SUPPORTED_MARKETS: MerchantMarket[] = ["ro", "fr", "com"];
const LANGUAGE_BY_MARKET: Record<MerchantMarket, string> = { ro: "ro", fr: "fr", com: "en" };
const CANONICAL_BASE_BY_MARKET: Record<MerchantMarket, string> = {
  ro: "https://xhaccp.ro",
  fr: "https://xhaccp.fr",
  com: "https://xhaccp.com",
};

type FeedCacheEntry = {
  xml: string;
  generatedAt: Date;
  itemCount: number;
};

const feedCache = new Map<MerchantMarket, FeedCacheEntry>();
let scheduledTask: ScheduledTask | null = null;

function isSupportedMarket(value: unknown): value is MerchantMarket {
  return typeof value === "string" && SUPPORTED_MARKETS.includes(value as MerchantMarket);
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0))];
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: unknown, baseUrl: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function imageUrlFromProduct(product: any, baseUrl: string): string | null {
  const candidates = [
    product.imageUrl,
    ...(Array.isArray(product.images)
      ? product.images.map((image: any) => typeof image === "string" ? image : image?.url || image?.thumbnailUrl)
      : []),
  ];
  return candidates.map(image => absoluteUrl(image, baseUrl)).find(Boolean) || null;
}

function formatPrice(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function getAvailability(product: any, marketRow: any): "in stock" | "out of stock" {
  const inStock = marketRow.inStock ?? product.inStock;
  const stockQuantity = marketRow.stockQuantity ?? product.stockQuantity;
  if (inStock === false || (stockQuantity != null && Number(stockQuantity) <= 0)) {
    return "out of stock";
  }
  return "in stock";
}

async function getFeedWithSelections(market: MerchantMarket) {
  const [feed] = await db.select().from(googleMerchantFeeds)
    .where(eq(googleMerchantFeeds.market, market));

  if (!feed) {
    return {
      feed: null as GoogleMerchantFeed | null,
      categoryIds: [] as number[],
      productIds: [] as number[],
    };
  }

  const [categoryRows, productRows] = await Promise.all([
    db.select({ categoryId: googleMerchantFeedCategories.categoryId })
      .from(googleMerchantFeedCategories)
      .where(eq(googleMerchantFeedCategories.feedId, feed.id)),
    db.select({ productId: googleMerchantFeedProducts.productId })
      .from(googleMerchantFeedProducts)
      .where(eq(googleMerchantFeedProducts.feedId, feed.id)),
  ]);

  return {
    feed,
    categoryIds: categoryRows.map(row => row.categoryId),
    productIds: productRows.map(row => row.productId),
  };
}

async function getMarketProductRows(market: MerchantMarket) {
  return db.select({
    product: products,
    marketRow: productMarkets,
  })
    .from(productMarkets)
    .innerJoin(products, eq(productMarkets.productId, products.id))
    .where(and(
      eq(productMarkets.market, market),
      eq(productMarkets.isActive, true),
    ));
}

async function getTranslations(productIds: number[], language: string) {
  if (productIds.length === 0) return new Map<number, any>();
  const rows = await db.select().from(productTranslations)
    .where(and(
      inArray(productTranslations.productId, productIds),
      eq(productTranslations.language, language),
    ));
  return new Map(rows.map(row => [row.productId, row]));
}

async function getCategoriesForMarket(market: MerchantMarket, productRows: any[]) {
  const marketCategories = await db.select().from(categories)
    .where(eq(categories.marketCode, market));
  const marketById = new Map(marketCategories.map(category => [category.id, category]));

  const baseCategoryIds = [...new Set(productRows
    .map(row => row.product.categoryId)
    .filter((id: unknown): id is number => Number.isInteger(id)))];
  const baseCategories = baseCategoryIds.length > 0
    ? await db.select().from(categories).where(inArray(categories.id, baseCategoryIds))
    : [];
  const baseById = new Map(baseCategories.map(category => [category.id, category]));

  return {
    all: marketCategories,
    byId: marketById,
    resolve: (row: any) => {
      if (row.marketRow.categoryId != null) {
        return marketById.get(row.marketRow.categoryId) || null;
      }
      const baseCategory = baseById.get(row.product.categoryId);
      return baseCategory
        ? marketCategories.find(category => category.slug === baseCategory.slug) || null
        : null;
    },
  };
}

export async function getGoogleMerchantFeedAdminData(market: MerchantMarket) {
  const [{ feed, categoryIds, productIds }, productRows] = await Promise.all([
    getFeedWithSelections(market),
    getMarketProductRows(market),
  ]);
  const categoriesForMarket = await getCategoriesForMarket(market, productRows);
  const translations = await getTranslations(
    productRows.map(row => row.product.id),
    LANGUAGE_BY_MARKET[market],
  );

  return {
    feed: feed
      ? {
          ...feed,
          categoryIds,
          productIds,
          lastGeneratedAt: feedCache.get(market)?.generatedAt?.toISOString() || null,
          lastItemCount: feedCache.get(market)?.itemCount ?? null,
        }
      : {
          market,
          enabled: false,
          includeOutOfStock: true,
          categoryIds,
          productIds,
          lastGeneratedAt: feedCache.get(market)?.generatedAt?.toISOString() || null,
          lastItemCount: feedCache.get(market)?.itemCount ?? null,
        },
    categories: categoriesForMarket.all.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    products: productRows
      .map(row => {
        const category = categoriesForMarket.resolve(row);
        const translation = translations.get(row.product.id);
        return {
          id: row.product.id,
          name: translation?.name || row.product.name,
          productCode: row.product.productCode,
          categoryId: category?.id ?? null,
          categoryName: category?.name || "Fără categorie",
          status: row.product.status || "active",
          isActive: row.marketRow.isActive !== false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function saveGoogleMerchantFeed(
  market: MerchantMarket,
  input: { enabled?: unknown; includeOutOfStock?: unknown; categoryIds?: unknown; productIds?: unknown },
) {
  const categoryIds = normalizeIds(input.categoryIds);
  const productIds = normalizeIds(input.productIds);

  const validCategoryRows = categoryIds.length > 0
    ? await db.select({ id: categories.id }).from(categories).where(and(
        eq(categories.marketCode, market),
        inArray(categories.id, categoryIds),
      ))
    : [];
  if (validCategoryRows.length !== categoryIds.length) {
    throw new Error("Una sau mai multe categorii nu aparțin marketplace-ului selectat.");
  }

  const validProductRows = productIds.length > 0
    ? await db.select({ productId: productMarkets.productId }).from(productMarkets).where(and(
        eq(productMarkets.market, market),
        eq(productMarkets.isActive, true),
        inArray(productMarkets.productId, productIds),
      ))
    : [];
  if (validProductRows.length !== productIds.length) {
    throw new Error("Unul sau mai multe produse nu sunt active în marketplace-ul selectat.");
  }

  const savedFeed = await db.transaction(async tx => {
    const [existing] = await tx.select().from(googleMerchantFeeds)
      .where(eq(googleMerchantFeeds.market, market));
    const values = {
      market,
      enabled: input.enabled === true,
      includeOutOfStock: input.includeOutOfStock !== false,
      updatedAt: new Date(),
    };
    const [feed] = existing
      ? await tx.update(googleMerchantFeeds).set(values)
          .where(eq(googleMerchantFeeds.id, existing.id)).returning()
      : await tx.insert(googleMerchantFeeds).values(values).returning();

    await tx.delete(googleMerchantFeedCategories)
      .where(eq(googleMerchantFeedCategories.feedId, feed.id));
    await tx.delete(googleMerchantFeedProducts)
      .where(eq(googleMerchantFeedProducts.feedId, feed.id));
    if (categoryIds.length > 0) {
      await tx.insert(googleMerchantFeedCategories).values(
        categoryIds.map(categoryId => ({ feedId: feed.id, categoryId })),
      );
    }
    if (productIds.length > 0) {
      await tx.insert(googleMerchantFeedProducts).values(
        productIds.map(productId => ({ feedId: feed.id, productId })),
      );
    }
    return feed;
  });

  invalidateGoogleMerchantFeedCache(market);
  return savedFeed;
}

export function invalidateGoogleMerchantFeedCache(market?: MerchantMarket) {
  if (market) feedCache.delete(market);
  else feedCache.clear();
}

export function getGoogleMerchantFeedStatus(market: MerchantMarket) {
  const entry = feedCache.get(market);
  return entry
    ? { lastGeneratedAt: entry.generatedAt.toISOString(), itemCount: entry.itemCount }
    : { lastGeneratedAt: null, itemCount: null };
}

export async function generateGoogleMerchantFeedXml(market: MerchantMarket): Promise<FeedCacheEntry> {
  const [{ feed, categoryIds, productIds }, productRows, settingsRows] = await Promise.all([
    getFeedWithSelections(market),
    getMarketProductRows(market),
    db.select().from(marketSettings).where(eq(marketSettings.market, market)),
  ]);
  if (!feed || !feed.enabled) {
    throw new Error("Feedul Google Merchant nu este activat pentru acest marketplace.");
  }

  const categoriesForMarket = await getCategoriesForMarket(market, productRows);
  const selectedCategoryIds = new Set(categoryIds);
  const selectedProductIds = new Set(productIds);
  const selectedRows = productRows.filter(row => {
    const category = categoriesForMarket.resolve(row);
    return selectedProductIds.has(row.product.id) ||
      (category != null && selectedCategoryIds.has(category.id));
  });
  const translations = await getTranslations(
    selectedRows.map(row => row.product.id),
    LANGUAGE_BY_MARKET[market],
  );
  const currency = settingsRows[0]?.currency || "EUR";
  const baseUrl = CANONICAL_BASE_BY_MARKET[market];
  const items: string[] = [];

  for (const row of selectedRows) {
    const product = row.product;
    if (product.status && product.status !== "active") continue;
    if (product.isService) continue;

    const availability = getAvailability(product, row.marketRow);
    if (!feed.includeOutOfStock && availability === "out of stock") continue;
    const imageUrl = imageUrlFromProduct(product, baseUrl);
    if (!imageUrl) continue;

    const category = categoriesForMarket.resolve(row);
    const translation = translations.get(product.id);
    const title = translation?.name || product.name;
    const description = stripHtml(
      translation?.description || product.description || product.descriptionHtml || title,
    );
    const slug = translation?.slug || product.slug;
    const effectiveCurrency = row.marketRow.currency || currency || product.currency || "EUR";
    const price = row.marketRow.price ?? product.price;
    const link = `${baseUrl}/products/${encodeURIComponent(slug)}`;
    const productId = `${market}-${product.id}`;

    const attributes = [
      `<g:id>${xmlEscape(productId)}</g:id>`,
      `<title>${xmlEscape(title)}</title>`,
      `<description>${xmlEscape(description.slice(0, 5000))}</description>`,
      `<link>${xmlEscape(link)}</link>`,
      `<g:image_link>${xmlEscape(imageUrl)}</g:image_link>`,
      `<g:availability>${availability}</g:availability>`,
      `<g:price>${formatPrice(price)} ${xmlEscape(effectiveCurrency)}</g:price>`,
      `<g:condition>new</g:condition>`,
      `<g:brand>xHACCP</g:brand>`,
      `<g:identifier_exists>${product.productCode ? "true" : "false"}</g:identifier_exists>`,
      ...(product.productCode ? [`<g:mpn>${xmlEscape(product.productCode)}</g:mpn>`] : []),
      ...(category ? [
        `<g:product_type>${xmlEscape(category.name)}</g:product_type>`,
        `<g:custom_label_0>${xmlEscape(category.slug)}</g:custom_label_0>`,
      ] : []),
      ...(product.weight ? [`<g:shipping_weight>${xmlEscape(product.weight)} kg</g:shipping_weight>`] : []),
    ];
    items.push(`<item>${attributes.join("")}</item>`);
  }

  const generatedAt = new Date();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    `<title>xHACCP Google Merchant Center - ${market.toUpperCase()}</title>`,
    `<link>${baseUrl}</link>`,
    `<description>Catalogul de produse xHACCP pentru marketplace-ul ${market.toUpperCase()}</description>`,
    `<lastBuildDate>${generatedAt.toUTCString()}</lastBuildDate>`,
    ...items,
    "</channel>",
    "</rss>",
  ].join("");

  const entry = { xml, generatedAt, itemCount: items.length };
  feedCache.set(market, entry);
  return entry;
}

export async function getGoogleMerchantFeedXml(market: MerchantMarket): Promise<FeedCacheEntry> {
  const cached = feedCache.get(market);
  if (cached && Date.now() - cached.generatedAt.getTime() < 55 * 60 * 1000) {
    return cached;
  }
  return generateGoogleMerchantFeedXml(market);
}

export async function refreshGoogleMerchantFeeds() {
  for (const market of SUPPORTED_MARKETS) {
    try {
      const entry = await generateGoogleMerchantFeedXml(market);
      console.log(`[Google Merchant Feed] ${market.toUpperCase()} regenerat — ${entry.itemCount} produse.`);
    } catch (error) {
      console.warn(`[Google Merchant Feed] ${market.toUpperCase()} nu a fost regenerat:`, error instanceof Error ? error.message : error);
    }
  }
}

export function startGoogleMerchantFeedScheduler() {
  if (scheduledTask) return;
  scheduledTask = cron.schedule("0 * * * *", () => {
    refreshGoogleMerchantFeeds().catch(error => {
      console.error("[Google Merchant Feed] Eroare scheduler:", error);
    });
  }, { timezone: "Europe/Bucharest" });
  console.log("[Google Merchant Feed] Scheduler pornit — regenerare la începutul fiecărei ore (Europe/Bucharest).");
}

export function stopGoogleMerchantFeedScheduler() {
  scheduledTask?.stop();
  scheduledTask = null;
}
