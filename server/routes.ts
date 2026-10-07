import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, VoucherReservationConflictError } from "./storage";
import {
  authenticateToken,
  JWT_SIGNING_SECRET,
  optionalAuth,
  type AuthRequest,
} from "./authentication";
import { insertUserSchema, insertCategorySchema, insertProductSchema, insertOrderSchema, insertCartItemSchema, insertReviewSchema, insertInvoiceSchema, insertInvoiceItemSchema, users, invoiceItems, invoices, orders, wmsOriginAddresses, aiRecommendationCampaigns, type CompositeConfiguration, type InsertCartItem } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import QRCode from "qrcode";
import path from "path";
import { createInvoiceService } from './invoice-service.js';
import { sendNotificationPreferencesEmail, sendContactFormEmails } from './email-service.js';
import { getMarketFromRequest, marketMatches } from "./market-routing.js";
import { getVoucherValidityError } from "./voucher-validity.js";
import { getVoucherOrderUserId, getVoucherOwnershipError } from "./voucher-ownership.js";
import { registerSeoRoutes } from './seo-routes.js';
import { canonicalBaseUrl } from "@shared/canonical-url";
import {
  buildAIMarketCatalog,
  formatAIMarketCatalog,
  getActiveAIPromotionProducts,
} from './ai-catalog';
import {
  calculateOrderTaxSnapshot,
  defaultPriceDisplayMode,
  moneyString,
  pricePairFromDisplayPrice,
  resolveMarketPricePair,
} from "@shared/market-pricing";
import { calculateShippingQuote } from "@shared/shipping-pricing";
import {
  collectContactRecipients,
  isValidEmailAddress,
  type ContactMarket,
} from './contact-email.js';
import { parseConsumerWithdrawalInput } from "./consumer-withdrawal.js";
import {
  buildVivaCheckoutPayload,
  getVivaCredentials,
  getVivaCurrency,
  type VivaMarket,
} from "./viva-config";
import {
  getGoogleMerchantFeedXml,
  type MerchantMarket,
} from "./google-merchant-feed";
import {
  calculateCompositeConfiguration,
  resolveCompositeStockQuantity,
  type CompositeComponentSource,
} from "./composite-products";
import { activateSubscriptionForOrder, cancelUserSubscription, listUserSubscriptions } from "./subscription-service";
import {
  createPayPalOrderWithRecovery,
  getPayPalOrder,
  capturePayPalOrder,
  paypalApprovalUrl,
  paypalCreateRequestId,
  isPayPalOrderForLocalOrder,
  reconcilePayPalPayment,
  expirePayPalOrderIfProviderConfirms,
  handlePayPalWebhook,
  PayPalApiError,
} from "./paypal";
import { isVivaPaymentOrderNonPayable } from "./viva-payment-status";
import { getRomanianSamedayShippingContext } from "./sameday-shipping";
import { sendFrenchOrderDocumentsEmail } from "./fr-order-notification.js";
import { sendFrenchOrderConfirmationEmails } from "./fr-order-confirmation.js";
import { buildPublicTrackingUrl, registerPublicTrackingRoute } from "./public-tracking.js";
import {
  createPublicProductDetailHandler,
  createPublicProductSlugHandler,
} from "./public-product-detail";
import { getActiveProductMarketRow } from "./product-market-availability";

const consumerWithdrawalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});
const paypalCreateOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `paypal:${getMarketFromRequest(req)}:${req.ip}`,
  handler: (_req, res) => res.status(429).json({ message: "Too many PayPal payment attempts. Please try again later." }),
});

async function invoiceMatchesRequestMarket(invoice: { market?: string | null; orderId?: number | null }, market: "ro" | "fr" | "com"): Promise<boolean> {
  if (!marketMatches(invoice.market, market)) return false;
  if (!invoice.orderId) return true;
  const order = await storage.getOrder(invoice.orderId);
  return !order || marketMatches(order.market, market);
}

const publicCategorySlugsByMarket: Record<string, Record<string, string>> = {
  fr: { "food-labels": "etiquettes-alimentaires" },
};

function getHeroLanguage(market: string): string {
  return market === "com" ? "en" : market;
}

function isSafeHeroDestinationUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.startsWith("//")) return false;
  if (value.startsWith("/")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLegacyHeroDestinationUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.startsWith("//")) return false;
  if (value.startsWith("/")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function resolveHomepageHeroDestination(slide: any, market: string): Promise<string | null> {
  const destinationType = slide.destinationType || "none";
  if (destinationType === "category") {
    const categoryId = Number(slide.destinationId);
    if (!Number.isInteger(categoryId)) return null;
    const category = (await storage.getCategories(market)).find((item) => item.id === categoryId);
    if (!category) return null;
    const publicSlug = publicCategorySlugsByMarket[market]?.[category.slug] || category.slug;
    return `/products?category=${encodeURIComponent(publicSlug)}`;
  }

  if (destinationType === "product") {
    const productId = Number(slide.destinationId);
    if (!Number.isInteger(productId)) return null;
    const product = await storage.getProduct(productId);
    if (!product || product.status?.toLowerCase() !== "active") return null;
    const marketRow = (await storage.getProductMarkets(productId))
      .find((row) => row.market === market && row.isActive !== false);
    if (!marketRow) return null;
    const translation = await storage.getProductTranslation(productId, getHeroLanguage(market));
    return `/products/${encodeURIComponent(translation?.slug || product.slug)}`;
  }

  if (destinationType === "custom") {
    return isSafeHeroDestinationUrl(slide.destinationUrl) ? slide.destinationUrl.trim() : null;
  }

  return isLegacyHeroDestinationUrl(slide.ctaUrl) ? slide.ctaUrl.trim() : null;
}

const appleOAuthStates = new Map<string, number>();
setInterval(() => {
  const tenMinutesAgo = Date.now() - 600000;
  for (const [key, timestamp] of appleOAuthStates) {
    if (timestamp < tenMinutesAgo) appleOAuthStates.delete(key);
  }
}, 60000);

function generateAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !keyId || !clientId || !privateKey) {
    throw new Error('Missing Apple OAuth configuration');
  }

  let formattedKey = privateKey;
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  formattedKey = formattedKey.replace(/-----BEGIN PRIVATE KEY-----\s*/, '-----BEGIN PRIVATE KEY-----\n');
  formattedKey = formattedKey.replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');

  return jwt.sign({}, formattedKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId,
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  });
}

// Volume discount: returns the effective unit price after applying quantity-based discount tiers
// Mirrors client/src/lib/volume-price.ts — must stay in sync
export function applyVolumeDiscount(basePrice: number, quantity: number, volumeDiscounts: unknown): number {
  if (!Array.isArray(volumeDiscounts) || volumeDiscounts.length === 0) return basePrice;
  let activeTierDiscount = 0;
  for (const tier of volumeDiscounts as Array<{ minQty: number; discountPercent: number }>) {
    if (tier && tier.minQty > 0 && tier.discountPercent > 0 && quantity >= tier.minQty) {
      activeTierDiscount = tier.discountPercent;
    }
  }
  if (activeTierDiscount === 0) return basePrice;
  return parseFloat((basePrice * (1 - activeTierDiscount / 100)).toFixed(2));
}

// Ultra-aggressive permanent in-memory cache
const cache = new Map<string, any>();
const CACHE_REFRESH_INTERVAL = 300000; // 5 minutes

// Initialize OpenAI client (optional - only if API key is provided)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.warn("Warning: OPENAI_API_KEY environment variable is not set. AI chat will be disabled.");
}

// Initialize Invoice Service with Smartbill enabled
process.env.ENABLE_SMARTBILL = 'true';
let invoiceService: any;

function getCachedData(key: string) {
  return cache.get(key) || null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, data);
}

// Permanent data storage - never expires, pre-compiled for ultra-fast access
let categoriesData: any[] = [];
let productsByCategory = new Map<string, any[]>();
let allProductsData: any[] = [];
let productsBySlug = new Map<string, any>();
let stringifiedProductsData: string = '';
let stringifiedCategoriesData: string = '';
let dataVersion = 0;

export function getAIMarketCatalogForMarket(market: string) {
  return buildAIMarketCatalog(allProductsData, market, applyMarketOverlay);
}

function bumpDataVersion() {
  dataVersion += 1;
}

// Market data in memory: productId → { market → ProductMarket row }
let productMarketsMap = new Map<number, Map<string, any>>();
let compositeStockByMarket = new Map<string, number>();
let categoriesById = new Map<number, any>();
// Market settings in memory: market → MarketSettings row
export let marketSettingsMap = new Map<string, any>();

async function refreshCompositeStockCache(validMarkets: string[]): Promise<void> {
  const nextStockByMarket = new Map<string, number>();
  const compositeProducts = allProductsData.filter(product => product.isComposite);

  await Promise.all(compositeProducts.flatMap(product =>
    validMarkets.map(async market => {
      const rows = await storage.getCompositeProductComponents(product.id, market);
      if (rows.length === 0) return;
      const sources: CompositeComponentSource[] = rows.map(row => ({
        product: row.product,
        marketPrice: row.marketPrice,
        marketCurrency: row.marketCurrency,
        marketStockQuantity: row.marketStockQuantity,
        sortOrder: row.sortOrder,
      }));
      nextStockByMarket.set(
        `${product.id}:${market}`,
        resolveCompositeStockQuantity(null, sources),
      );
    })
  ));

  compositeStockByMarket = nextStockByMarket;
}

// Refresh only market caches from DB (called after admin CRUD on market settings / product markets)
export async function refreshMarketCaches(): Promise<void> {
  try {
    const allMarketSettings = await storage.getMarketSettings();
    marketSettingsMap.clear();
    for (const ms of allMarketSettings) {
      marketSettingsMap.set(ms.market, ms);
    }
    // Product-market availability is valid independently of a settings row.
    // Always load every supported marketplace so an incomplete settings table
    // cannot turn market-specific products into globally available products.
    const validMarkets = ['ro', 'fr', 'com'];
    const allProductMarketsRows = (
      await Promise.all(validMarkets.map((market) => storage.getProductMarketsByMarket(market)))
    ).flat();
    productMarketsMap.clear();
    for (const pm of allProductMarketsRows) {
      if (!productMarketsMap.has(pm.productId)) {
        productMarketsMap.set(pm.productId, new Map());
      }
      productMarketsMap.get(pm.productId)!.set(pm.market, pm);
    }
    await refreshCompositeStockCache(validMarkets);
    // Product availability changed, so public product responses must not retain
    // an ETag generated for the previous marketplace catalog.
    bumpDataVersion();
  } catch (err) {
    console.error("Error refreshing market caches:", err);
    throw err;
  }
}

// Apply market-specific price/availability overlay to a product clone
export function applyMarketOverlay(product: any, market: string): any {
  // Marketplace availability is explicit. A product without any market row
  // belongs to no storefront and must not bypass Admin marketplace filters.
  // A missing or inactive market row must not expose an RO/COM-only product
  // on the French storefront.
  const marketRow = getActiveProductMarketRow(productMarketsMap, product.id, market);
  if (!marketRow) return null;
  const marketCategory = marketRow.categoryId != null
    ? categoriesById.get(marketRow.categoryId)
    : null;
  const legacyMarketCategory = marketRow.categoryId == null && product.category?.slug
    ? categoriesData.find((category: any) =>
        category.marketCode === market && category.slug === product.category.slug
      )
    : null;
  // Never expose a category row from another storefront. Legacy rows may use
  // the product's base category only when that category already belongs to the
  // requested marketplace.
  const effectiveCategory = marketCategory?.marketCode === market
    ? marketCategory
    : legacyMarketCategory
      ? legacyMarketCategory
    : product.category?.marketCode === market
      ? product.category
      : null;
  if (!effectiveCategory) return null;
  // Currency priority: product_markets.currency → market_settings.currency → product.currency
  // Applied whenever a market row exists and is active (not only when other overrides are set)
  // A composite uses its own marketplace price. Its configured components are
  // used for the selection snapshot and validation, not to replace the parent
  // product price.
  const effectiveCurrency = product.isComposite
    ? (marketSettingsMap.get(market)?.currency ?? product.currency)
    : (marketRow.currency ?? marketSettingsMap.get(market)?.currency ?? product.currency);
  const vatPercentage = Number(marketSettingsMap.get(market)?.vatPercentage ?? 0);
  const pricePair = resolveMarketPricePair({
    market,
    price: marketRow.price ?? product.price,
    priceNet: marketRow.priceNet,
    priceGross: marketRow.priceGross,
    priceDisplayMode: marketRow.priceDisplayMode,
    vatPercentage,
  });
  const directCompositeStock = marketRow.stockQuantity ?? product.stockQuantity;
  const effectiveCompositeStock = product.isComposite
    ? resolveCompositeStockQuantity(
        directCompositeStock,
        [{
          product,
          marketPrice: null,
          marketCurrency: null,
          marketStockQuantity: compositeStockByMarket.get(`${product.id}:${market}`) ?? 0,
          sortOrder: 0,
        }],
      )
    : null;
  return {
    ...product,
    categoryId: effectiveCategory.id,
    category: effectiveCategory,
    price: moneyString(pricePair.displayPrice),
    priceNet: moneyString(pricePair.priceNet),
    priceGross: moneyString(pricePair.priceGross),
    priceDisplayMode: pricePair.priceDisplayMode,
    vatPercentage: moneyString(pricePair.vatPercentage),
    compareAtPrice: marketRow.compareAtPrice ?? product.compareAtPrice,
    currency: effectiveCurrency,
    inStock: product.isComposite
      ? (effectiveCompositeStock ?? 0) > 0
      : (marketRow.inStock ?? product.inStock),
    stockQuantity: product.isComposite
      ? effectiveCompositeStock
      : (marketRow.stockQuantity ?? product.stockQuantity),
    _marketOverride: market,
  };
}

async function provisionMissingMarketplaceCategories(): Promise<void> {
  const products = await storage.getProducts({});
  const productsById = new Map(products.map(product => [product.id, product]));

  for (const market of ["fr", "com"]) {
    const [targetCategories, marketProducts] = await Promise.all([
      storage.getCategories(market),
      storage.getProductMarketsByMarket(market),
    ]);
    if (marketProducts.length === 0) continue;
    const targetSlugs = new Set(targetCategories.map(category => category.slug));
    const requiredSourceCategories = new Map<number, any>();
    for (const row of marketProducts) {
      const sourceCategory = productsById.get(row.productId)?.category;
      if (sourceCategory && !targetSlugs.has(sourceCategory.slug)) {
        requiredSourceCategories.set(sourceCategory.id, sourceCategory);
      }
    }

    for (const sourceCategory of requiredSourceCategories.values()) {
      try {
        await storage.createCategory({
          name: sourceCategory.name,
          slug: sourceCategory.slug,
          description: sourceCategory.description,
          imageUrl: sourceCategory.imageUrl,
          showOnMainTop: sourceCategory.showOnMainTop,
          showOnMainShop: sourceCategory.showOnMainShop,
          sortOrder: sourceCategory.sortOrder ?? 0,
          marketCode: market,
        });
      } catch (error: any) {
        // Multiple app instances may provision at the same time. The unique
        // (slug, market) constraint makes that race harmless.
        if (error?.code !== "23505") throw error;
      }
    }
  }
}

async function backfillMarketplaceCategoryAssignments(
  products: any[],
  categories: any[],
): Promise<void> {
  const productsById = new Map(products.map(product => [product.id, product]));
  const categoryByMarketAndSlug = new Map(
    categories.map(category => [`${category.marketCode}:${category.slug}`, category]),
  );

  for (const market of ["ro", "fr", "com"]) {
    const marketRows = await storage.getProductMarketsByMarket(market);
    for (const row of marketRows) {
      if (row.categoryId != null) continue;
      const product = productsById.get(row.productId);
      const slug = product?.category?.slug;
      const targetCategory = slug
        ? categoryByMarketAndSlug.get(`${market}:${slug}`)
        : undefined;
      if (targetCategory) {
        await storage.setProductMarketCategoryIfMissing(
          row.productId,
          market,
          targetCategory.id,
        );
      }
    }
  }
}

let categoryTranslationBackfillInFlight: Promise<number> | null = null;

async function backfillMarketplaceCategoryTranslations(): Promise<number> {
  if (categoryTranslationBackfillInFlight) {
    return categoryTranslationBackfillInFlight;
  }

  categoryTranslationBackfillInFlight = (async () => {
    const result: any = await db.transaction(async tx => {
      // Keep lock acquisition separate so the INSERT receives a fresh
      // READ COMMITTED snapshot after any competing writer has committed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(2026082601)`);
      return tx.execute(sql`
        WITH source_rows AS (
          SELECT DISTINCT ON (category_id, language)
            category_id,
            language,
            name,
            description
          FROM category_translations
          ORDER BY category_id, language, updated_at DESC NULLS LAST, id DESC
        ),
        inserted AS (
          INSERT INTO category_translations (
            category_id,
            language,
            name,
            description,
            created_at,
            updated_at
          )
          SELECT
            target.id,
            source_translation.language,
            source_translation.name,
            source_translation.description,
            NOW(),
            NOW()
          FROM categories AS target
          JOIN categories AS source_category
            ON source_category.slug = target.slug
           AND source_category.market_code = 'ro'
          JOIN source_rows AS source_translation
            ON source_translation.category_id = source_category.id
          WHERE target.market_code IN ('fr', 'com')
            AND NOT EXISTS (
              SELECT 1
              FROM category_translations AS existing
              WHERE existing.category_id = target.id
                AND existing.language = source_translation.language
            )
          RETURNING id
        )
        SELECT COUNT(*)::int AS created_count FROM inserted
      `);
    });
    const row = result?.rows?.[0] ?? result?.[0];
    return Number(row?.created_count || 0);
  })();

  try {
    return await categoryTranslationBackfillInFlight;
  } finally {
    categoryTranslationBackfillInFlight = null;
  }
}

async function getCompositeSources(parentProductId: number, market: string): Promise<CompositeComponentSource[]> {
  const rows = await storage.getCompositeProductComponents(parentProductId, market);
  const language = market === "fr" ? "fr" : market === "com" ? "en" : "ro";
  return Promise.all(rows.map(async row => {
    const translation = await storage.getProductTranslation(row.product.id, language);
    const pricePair = resolveMarketPricePair({
      market,
      price: row.marketPrice ?? row.product.price,
      priceNet: row.marketPriceNet,
      priceGross: row.marketPriceGross,
      priceDisplayMode: row.marketPriceDisplayMode,
      vatPercentage: marketSettingsMap.get(market)?.vatPercentage ?? 0,
    });
    return {
      product: translation?.name ? { ...row.product, name: translation.name } : row.product,
      marketPrice: moneyString(pricePair.displayPrice),
      priceNet: moneyString(pricePair.priceNet),
      priceGross: moneyString(pricePair.priceGross),
      priceDisplayMode: pricePair.priceDisplayMode,
      vatPercentage: moneyString(pricePair.vatPercentage),
      marketCurrency: row.marketCurrency ?? marketSettingsMap.get(market)?.currency ?? row.product.currency,
      marketStockQuantity: row.marketStockQuantity,
      sortOrder: row.sortOrder,
    };
  }));
}

function compositeSnapshotName(item: any): string {
  const productName = item.product?.name || `Product ${item.productId}`;
  const components = Array.isArray(item.compositeConfiguration?.components)
    ? item.compositeConfiguration.components
    : [];
  if (!components.length) return productName;
  return `${productName} (${components
    .map((component: any) => `${component.name || `#${component.componentProductId}`} x${component.quantity}`)
    .join(", ")})`;
}

async function getCompositeConfiguration(
  product: any,
  market: string,
  requestedComponents: unknown,
): Promise<CompositeConfiguration> {
  if (!product?.isComposite) {
    throw new Error("Product is not composite");
  }
  const sources = await getCompositeSources(product.id, market);
  if (sources.length === 0) {
    throw new Error("Composite product has no configured components for this market");
  }
  const defaultCurrency = marketSettingsMap.get(market)?.currency ?? product.currency ?? "RON";
  const effectiveProduct = applyMarketOverlay(product, market);
  if (!effectiveProduct) {
    throw new Error("Composite product is not available in this market");
  }
  return calculateCompositeConfiguration(
    sources,
    requestedComponents,
    defaultCurrency,
    applyVolumeDiscount,
    {
      parentPriceDisplayMode: effectiveProduct.priceDisplayMode,
      vatPercentage: Number(effectiveProduct.vatPercentage ?? 0),
    },
  );
}

async function decorateCompositeProduct(product: any, market: string): Promise<any> {
  if (!product?.isComposite) return product;
  const sources = await getCompositeSources(product.id, market);
  const components = sources.map(source => ({
    id: source.product.id,
    name: source.product.name,
    productCode: source.product.productCode,
    imageUrl: source.product.imageUrl,
    status: source.product.status,
    price: source.marketPrice ?? source.product.price,
    priceNet: source.priceNet,
    priceGross: source.priceGross,
    priceDisplayMode: source.priceDisplayMode,
    vatPercentage: source.vatPercentage,
    currency: source.marketCurrency ?? marketSettingsMap.get(market)?.currency ?? source.product.currency,
    stockQuantity: source.marketStockQuantity ?? source.product.stockQuantity ?? 0,
    inStock: Number(source.marketStockQuantity ?? source.product.stockQuantity ?? 0) > 0,
    sortOrder: source.sortOrder,
  }));
  return { ...product, compositeComponents: components };
}

async function validateOrderItemForMarket(item: any, market: string) {
  const quantity = parseInt(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    throw new Error(`Invalid quantity for product ${item.productId}: must be between 1 and 9999`);
  }

  const product = await storage.getProduct(item.productId);
  if (!product) throw new Error(`Product not found: ${item.productId}`);
  if (product.status?.toLowerCase() !== "active") {
    throw new Error(`Product is not available: ${product.name}`);
  }

  const effectiveProduct = applyMarketOverlay(product, market);
  if (effectiveProduct === null) {
    throw new Error(`Product is not available in this market: ${product.name}`);
  }
  const storedProductType = String(product.productType ?? "").trim().toLowerCase();
  const productType = (storedProductType === "service" ||
    (storedProductType === "standard" && product.isService === true))
    ? "service"
    : storedProductType || "standard";

  if (product.isComposite) {
    const requestedComponents = item.compositeConfiguration?.components ?? item.components;
    const configuration = await getCompositeConfiguration(product, market, requestedComponents);
    const unitPriceNet = Number(configuration.totalPriceNet ?? configuration.totalPrice);
    const unitPriceGross = Number(configuration.totalPriceGross ?? configuration.totalPrice);
    const displayPrice = configuration.priceDisplayMode === "net" ? unitPriceNet : unitPriceGross;
    const totalPriceNet = Number(moneyString(unitPriceNet * quantity));
    const totalPriceGross = Number(moneyString(unitPriceGross * quantity));
    return {
      productId: item.productId,
      quantity,
      price: moneyString(unitPriceGross),
      totalPrice: moneyString(totalPriceGross),
      priceNet: moneyString(unitPriceNet),
      totalPriceNet: moneyString(totalPriceNet),
      displayPrice: moneyString(displayPrice),
      displayTotalPrice: moneyString(displayPrice * quantity),
      priceDisplayMode: configuration.priceDisplayMode || defaultPriceDisplayMode(market),
      vatPercentage: moneyString(Number(configuration.vatPercentage ?? marketSettingsMap.get(market)?.vatPercentage ?? 0)),
      vatAmount: moneyString(totalPriceGross - totalPriceNet),
      compositeConfiguration: configuration,
      productType,
    };
  }

  const priceDisplayMode = effectiveProduct.priceDisplayMode || defaultPriceDisplayMode(market);
  const vatPercentage = Number(effectiveProduct.vatPercentage ?? marketSettingsMap.get(market)?.vatPercentage ?? 0);
  const discountedDisplayPrice = applyVolumeDiscount(
    Number(effectiveProduct.price),
    quantity,
    (product as any).volumeDiscounts,
  );
  const discountedPair = pricePairFromDisplayPrice(
    discountedDisplayPrice,
    priceDisplayMode,
    vatPercentage,
  );
  const totalPriceNet = Number(moneyString(discountedPair.priceNet * quantity));
  const totalPriceGross = Number(moneyString(discountedPair.priceGross * quantity));
  return {
    productId: item.productId,
    quantity,
    price: moneyString(discountedPair.priceGross),
    totalPrice: moneyString(totalPriceGross),
    priceNet: moneyString(discountedPair.priceNet),
    totalPriceNet: moneyString(totalPriceNet),
    displayPrice: moneyString(discountedPair.displayPrice),
    displayTotalPrice: moneyString(discountedPair.displayPrice * quantity),
    priceDisplayMode,
    vatPercentage: moneyString(vatPercentage),
    vatAmount: moneyString(totalPriceGross - totalPriceNet),
    compositeConfiguration: null,
    productType,
  };
}

// Load ALL data into memory at startup - never hit database again
export async function loadAllDataIntoMemory() {
  try {
    console.log('Loading all data into permanent memory...');
    
    // Update version to invalidate caches
    bumpDataVersion();
    productsByCategory.clear();
    productsBySlug.clear();

    await provisionMissingMarketplaceCategories();
    
    // Load categories
    const rawCategories = await storage.getCategories();
    const restoredCategoryTranslations = await backfillMarketplaceCategoryTranslations();
    if (restoredCategoryTranslations > 0) {
      console.log(`Restored ${restoredCategoryTranslations} marketplace category translations`);
    }
    categoriesById = new Map(rawCategories.map(category => [category.id, category]));
    setCachedData('categories-all', rawCategories);
    
    // Load products for each category and add product count
    for (const category of rawCategories) {
      const products = await storage.getProducts({
        categoryId: category.id
      });
      // Filter only active products for public display (case-insensitive)
      const activeProducts = products.filter(p => p.status?.toLowerCase() === 'active');
      // Sort products by priority (1 = highest, then 2, 3, etc. Products with 0 or null come last)
      const sortedProducts = [...activeProducts].sort((a, b) => {
        const priorityA = a.priority || 999;
        const priorityB = b.priority || 999;
        return priorityA - priorityB;
      });
      // Only set productsByCategory if we found products OR the slug isn't mapped yet.
      // This prevents FR/COM duplicate-slug categories (which have no direct product links)
      // from overwriting the RO base categories that DO have products.
      if (sortedProducts.length > 0 || !productsByCategory.has(category.slug)) {
        productsByCategory.set(category.slug, sortedProducts);
      }
      // For product count on FR/COM categories: fall back to the already-mapped count for same slug
      const existingCount = productsByCategory.get(category.slug)?.length ?? 0;
      (category as any).productCount = sortedProducts.length > 0 ? sortedProducts.length : existingCount;
    }
    
    // Load all category translations and attach to categories
    const allCategoryTranslations = await storage.getAllCategoryTranslations();
    const translationsByCategory = new Map<number, Record<string, { name: string; description: string | null }>>();
    for (const t of allCategoryTranslations) {
      if (!translationsByCategory.has(t.categoryId)) {
        translationsByCategory.set(t.categoryId, {});
      }
      translationsByCategory.get(t.categoryId)![t.language] = {
        name: t.name,
        description: t.description,
      };
    }
    for (const category of rawCategories) {
      (category as any).translations = translationsByCategory.get(category.id) || {};
    }

    categoriesData = rawCategories;
    
    // Refresh stringified categories data (now includes productCount and translations)
    stringifiedCategoriesData = JSON.stringify(categoriesData);
    
    // Load all products (no filter, no limit)
    const rawAllProducts = await storage.getProducts({});
    // Filter only active products for public display (case-insensitive)
    const activeProducts = rawAllProducts.filter(p => p.status?.toLowerCase() === 'active');
    // Sort all products by priority (1 = highest, then 2, 3, etc. Products with 0 or null come last)
    allProductsData = [...activeProducts].sort((a, b) => {
      const priorityA = a.priority || 999;
      const priorityB = b.priority || 999;
      return priorityA - priorityB;
    });

    // Marketplace membership is explicit. Never recreate a market row for an
    // orphan product during startup: an orphan can be intentional after an
    // admin removes the product from its last marketplace.
    await backfillMarketplaceCategoryAssignments(rawAllProducts, rawCategories);
    
    // Attach category translations to products
    for (const product of allProductsData) {
      if (product.category) {
        (product.category as any).translations = translationsByCategory.get(product.category.id) || {};
      }
    }
    // Also attach to products by category
    for (const [slug, products] of productsByCategory) {
      for (const product of products) {
        if (product.category) {
          (product.category as any).translations = translationsByCategory.get(product.category.id) || {};
        }
      }
    }
    
    // Pre-compile data structures for ultra-fast access
    for (const product of allProductsData) {
      productsBySlug.set(product.slug, product);
    }
    
    // Pre-stringify JSON for fastest possible responses
    stringifiedProductsData = JSON.stringify(allProductsData);

    // Load market caches
    await refreshMarketCaches();
    
    console.log('✅ All data loaded into permanent memory - database queries eliminated');
    console.log(`📊 Memory data loaded: ${allProductsData.length} total products`);
    
    // Log products with priority for debugging
    const productsWithPriority = allProductsData.filter(p => p.priority && p.priority > 0);
    if (productsWithPriority.length > 0) {
      console.log(`📊 Products with priority set: ${productsWithPriority.map(p => `${p.name}(${p.priority})`).join(', ')}`);
    }
    console.log(`📊 First 5 products in memory:`, allProductsData.slice(0, 5).map(p => ({ id: p.id, name: p.name })));
    console.log(`📊 All products data variable type:`, typeof allProductsData);
    console.log(`📊 All products data is array:`, Array.isArray(allProductsData));
  } catch (error) {
    console.error('Failed to load data into memory:', error);
  }
}

// Refresh data periodically (but not too frequently to avoid product disappearing)
let isRefreshing = false;
setInterval(async () => {
  if (!isRefreshing) {
    isRefreshing = true;
    await loadAllDataIntoMemory();
    isRefreshing = false;
  }
}, CACHE_REFRESH_INTERVAL);

// Remove duplicate - using the one defined above

const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Access token required" });
  }

  const user = await storage.getUser(req.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

export { getMarketFromRequest };

export async function registerRoutes(app: Express): Promise<Server> {
  // Public XML endpoint consumed by Google Merchant Center. It is intentionally
  // unauthenticated; the admin API above controls whether each market feed is
  // enabled and which products are included.
  app.get("/feeds/google-merchant/:market.xml", async (req, res) => {
    const market = String(req.params.market || "") as MerchantMarket;
    if (!["ro", "fr", "com"].includes(market)) {
      return res.status(404).type("text/plain").send("Feed not found");
    }
    try {
      const { xml } = await getGoogleMerchantFeedXml(market);
      res.status(200)
        .set("Content-Type", "application/xml; charset=utf-8")
        .set("Cache-Control", "public, max-age=300")
        .send(xml);
    } catch (error) {
      res.status(404).type("text/plain").send(
        error instanceof Error ? error.message : "Feed not available",
      );
    }
  });

  // SEO: server-side meta tag injection for all SPA routes (helps Google index them)
  registerSeoRoutes(app, storage, {
    getMarket: getMarketFromRequest,
    applyOverlay: applyMarketOverlay,
  });

  // Sitemap.xml - dynamic, includes all products
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const BASE_URL = canonicalBaseUrl(req);
      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'weekly' },
        { url: '/products', priority: '0.9', changefreq: 'daily' },
        { url: '/b2b', priority: '0.8', changefreq: 'monthly' },
        { url: '/blog', priority: '0.8', changefreq: 'daily' },
        { url: '/ai-assistant', priority: '0.6', changefreq: 'monthly' },
        { url: '/about', priority: '0.7', changefreq: 'monthly' },
        { url: '/terms', priority: '0.4', changefreq: 'yearly' },
        { url: '/privacy', priority: '0.4', changefreq: 'yearly' },
        { url: '/returns', priority: '0.5', changefreq: 'yearly' },
      ];
      const market = getMarketFromRequest(req);
      if (market === "fr") {
        staticPages.push({ url: '/chef-event', priority: '0.7', changefreq: 'monthly' });
      }
      const allRawProducts = await storage.getProducts({ limit: 10000 });
      const products = (await Promise.all(allRawProducts.map(async p => {
        if (!p.slug) return false;
        if (p.status?.toLowerCase() !== 'active') return false;
        const overlaid = applyMarketOverlay(p, market);
        if (!overlaid) return false;
        const language = market === "fr" ? "fr" : market === "com" ? "en" : null;
        const translation = language
          ? await storage.getProductTranslation(overlaid.id, language)
          : null;
        return { product: overlaid, slug: translation?.slug || overlaid.slug };
      }))).filter((product): product is { product: any; slug: string } => product !== false);
      const now = new Date().toISOString().split('T')[0];
      const publishedBlogPosts = await storage.getBlogPosts({ published: true, marketCode: market });
      const escapeXml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      const urlEntries = [
        ...staticPages.map(p => `
  <url>
    <loc>${escapeXml(`${BASE_URL}${p.url}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
        ...products.map(({ product: p, slug }) => {
          const seoTitle = (p.name || '').replace(/xHACCP/gi, 'HACCP');
          const escapedTitle = escapeXml(seoTitle);

          const makeAbsolute = (url: string) =>
            escapeXml(url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`);

          // Collect all images: primary + gallery
          const allImageUrls: string[] = [];
          if (p.imageUrl) allImageUrls.push(makeAbsolute(p.imageUrl));
          if (Array.isArray((p as any).images)) {
            for (const img of (p as any).images) {
              const rawUrl = typeof img === 'string' ? img : img?.url;
              if (rawUrl && rawUrl !== p.imageUrl) {
                allImageUrls.push(makeAbsolute(rawUrl));
              }
            }
          }

          const imageBlocks = allImageUrls
            .map(loc => `\n    <image:image>\n      <image:loc>${loc}</image:loc>\n      <image:title>${escapedTitle}</image:title>\n    </image:image>`)
            .join('');

          return `
  <url>
    <loc>${escapeXml(`${BASE_URL}/products/${encodeURIComponent(slug)}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageBlocks}
  </url>`;
        }),
        ...publishedBlogPosts.map(b => `
  <url>
    <loc>${escapeXml(`${BASE_URL}/blog/${encodeURIComponent(b.slug)}`)}</loc>
    <lastmod>${b.publishedAt ? new Date(b.publishedAt).toISOString().split('T')[0] : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`),
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries.join('')}
</urlset>`;
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Vary', 'Host, X-Market');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(xml);
    } catch (error) {
      console.error('Sitemap generation error:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // robots.txt - points crawlers to sitemap (dynamic per domain)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = canonicalBaseUrl(req);
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *
Disallow: /admin
Disallow: /checkout
Disallow: /merci
Disallow: /cart
Disallow: /account
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`);
  });

  // 301 Redirects for old Romanian URL structure (SEO preservation)
  const romanianRedirects: Record<string, string> = {
    '/produse':           '/products',
    '/cos':               '/cart',
    '/comanda':           '/checkout',
    '/cont':              '/account',
    '/despre':            '/about',
    '/termeni':           '/terms',
    '/confidentialitate': '/privacy',
    '/contact':           '/about',
    '/utile':             '/',
    '/en':                '/',
  };
  for (const [oldPath, newPath] of Object.entries(romanianRedirects)) {
    app.get(oldPath, (_req, res) => res.redirect(301, newPath));
    app.get(oldPath + '/', (_req, res) => res.redirect(301, newPath));
  }

  // Strip tracking/noise query params from homepage (e.g. ?ref=aftership, ?sLang=fr)
  app.get('/', (req, res, next) => {
    const noiseParams = ['ref', 'sLang', 'route', 'path', 'sort', 'order'];
    const hasNoise = noiseParams.some(p => req.query[p] !== undefined);
    if (hasNoise) return res.redirect(301, '/');
    next();
  });
  // Convert old filename-style slugs to dash-separated slugs
  // e.g. "eticheteLUNI.html" → "etichete-luni", "etichete_luni" → "etichete-luni"
  function fileToSlug(raw: string): string {
    return raw
      .replace(/\.html?$/i, '')               // strip .html / .htm
      .replace(/([a-z])([A-Z])/g, '$1-$2')   // split camelCase: eticheteLUNI → etichete-LUNI
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2') // split consecutive caps
      .replace(/[_\s]+/g, '-')               // underscores/spaces → dashes
      .replace(/[^a-zA-Z0-9-]/g, '-')        // remove other special chars
      .replace(/-+/g, '-')                   // collapse multiple dashes
      .replace(/^-|-$/g, '')                 // trim leading/trailing dashes
      .toLowerCase();
  }

  // /produse/:slug → /products/:slug (handles .html extensions and camelCase)
  // For .html slugs that don't match real products, go to /products listing
  const legacyProduseSlugs: Record<string, string> = {
    'epson-tm-t20iii.html': '/products',
    'pos-all-in-one-p1000-colormetrics.html': '/products',
    'xhaccp-software-urmarire-si-gestionare-termene-de-expirare-in-bucatarii.html': '/products',
    'honeywell-pc43k.html': '/products',
  };
  // /produse/pagina/:n → /products (old pagination structure)
  app.get('/produse/pagina/:page', (_req, res) => res.redirect(301, '/products'));

  app.get('/produse/:slug', (req, res) => {
    const slug = req.params.slug;
    if (legacyProduseSlugs[slug]) {
      return res.redirect(301, legacyProduseSlugs[slug]);
    }
    // All .html slugs that aren't in the known mapping → /products (avoid soft-404)
    if (slug.endsWith('.html') || slug.endsWith('.htm')) {
      return res.redirect(301, '/products');
    }
    res.redirect(301, `/products/${fileToSlug(slug)}`);
  });

  // Specific 301 redirects for old .html pages indexed by Google
  const legacyHtmlRedirects: Record<string, string> = {
    '/eticheteLUNI.html': '/products/set-de-8-role-de-etichete-kitoff-luni',
    '/80x60-rola-termica-casa-de-marcat.html': '/products',
    '/80x80-rola-termica-casa-de-marcat.html': '/products',
    '/57x25-rola-termica-casa-de-marcat.html': '/products',
    '/60x40-rola-termica-casa-de-marcat.html': '/products',
    '/xhaccp-software-urmarire-si-gestionare-termene-de-expirare-in-bucatarii.html': '/products',
    '/test.html': '/',
  };
  for (const [oldPath, newPath] of Object.entries(legacyHtmlRedirects)) {
    app.get(oldPath, (_req, res) => res.redirect(301, newPath));
  }

  // Catch-all for any remaining old .html pages → redirect to /products
  app.get('/*.html', (_req, res) => res.redirect(301, '/products'));

  app.get("/r2/:prefix/:filename", async (req, res) => {
    try {
      const { getImageFromR2 } = await import("./r2-storage");
      const key = `${req.params.prefix}/${req.params.filename}`;
      const result = await getImageFromR2(key);
      if (!result) {
        return res.status(404).send("Not found");
      }
      res.set({
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      const stream = result.body;
      stream.pipe(res);
    } catch (e) {
      res.status(500).send("Error");
    }
  });

  // ── Admin API URL rewrite middleware ──────────────────────────────────────
  // The compiled admin bundle calls /admin/api/* but the server exposes routes
  // at /api/* and /api/admin/*. This middleware rewrites the URL in-process so
  // all existing route handlers are reused without duplication.
  app.use("/admin/api", (req, _res, next) => {
    const sub = req.path; // e.g. "/login", "/orders", "/blog/posts"

    // Special auth mappings
    if (sub === "/login")           { req.url = "/api/auth/login";           return next("router"); }
    if (sub === "/forgot-password") { req.url = "/api/auth/forgot-password"; return next("router"); }
    if (sub === "/logout")          { req.url = "/api/auth/logout";          return next("router"); }

    // Routes that live under /api/admin/
    if (sub.startsWith("/orders")   ||
        sub.startsWith("/blog")     ||
        sub.startsWith("/invoices") ||
        sub.startsWith("/invoice-counters") ||
        sub.startsWith("/stats")    ||
        sub.startsWith("/users")    ||
        sub.startsWith("/suppliers")||
        sub.startsWith("/vouchers") ||
        sub.startsWith("/markets")  ||
        sub.startsWith("/market-products") ||
        sub.startsWith("/products") ||
        sub.startsWith("/categories")||
        sub.startsWith("/upload-images") ||
        sub.startsWith("/delete-image-by-url") ||
        sub.startsWith("/company-settings") ||
        sub.startsWith("/shipping-settings")) {
      req.url = "/api" + sub + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
      return next("router");
    }

    // Generic fallback: /admin/api/X → /api/X
    req.url = "/api" + sub + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
    next("router");
  });

  // Admin interface route (original flow preserved)
  app.get("/admin", (req, res) => {
    try {
      const adminPath = path.resolve('./admin/index.html');
      console.log('Serving admin interface from:', adminPath);
      
      // Set cache headers for better performance
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });
      
      res.sendFile(adminPath);
    } catch (error) {
      console.error('Error serving admin interface:', error);
      res.status(500).send('Admin interface not available');
    }
  });


  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse({
        ...req.body,
        email: typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : req.body?.email,
      });
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SIGNING_SECRET,
        { expiresIn: "24h" }
      );

      const linkedCount = await storage.linkGuestOrdersToUser(userData.email, user.id);

      const { orderId } = req.body;
      if (orderId && typeof orderId === 'number') {
        const order = await storage.getOrder(orderId);
        const orderEmail = (order?.shippingAddress as any)?.email;
        if (order && !order.userId && orderEmail === userData.email) {
          await storage.updateOrder(orderId, { userId: user.id });
          console.log(`🔗 Explicitly linked order ${orderId} to new user ${user.id}`);
        }
      }

      res.json({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.passwordSetupRequired) {
        return res.status(401).json({ message: "Choose your password using the secure link sent to your email." });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SIGNING_SECRET,
        { expiresIn: "24h" }
      );

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on login:', err);
      });

      res.json({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.redirect("/login?error=google_not_configured");
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${proto}://${req.get('host')}/api/auth/google/callback`;
    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.redirect("/login?error=google_failed");
      }
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect("/login?error=google_not_configured");
      }
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const redirectUri = `${proto}://${req.get('host')}/api/auth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Google token exchange failed:', await tokenResponse.text());
        return res.redirect("/login?error=google_failed");
      }

      const tokenData = await tokenResponse.json() as any;

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.redirect("/login?error=google_failed");
      }

      const googleUser = await userInfoResponse.json() as any;
      const email = googleUser.email;
      const firstName = googleUser.given_name || googleUser.name?.split(' ')[0] || '';
      const lastName = googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '';

      let user = await storage.getUserByEmail(email);
      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          firstName,
          lastName,
          password: hashedPassword,
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SIGNING_SECRET,
        { expiresIn: "24h" }
      );

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on Google login:', err);
      });

      res.redirect(`/login?token=${token}&userId=${user.id}`);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/login?error=google_failed");
    }
  });

  app.get("/api/auth/apple", (req, res) => {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    if (!clientId || !teamId || !keyId || !privateKey) {
      return res.redirect("/login?error=apple_not_configured");
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${proto}://${req.get('host')}/api/auth/apple/callback`;
    const scope = encodeURIComponent('name email');
    const state = crypto.randomBytes(16).toString('hex');
    appleOAuthStates.set(state, Date.now());
    const url = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&response_mode=form_post&state=${state}`;
    res.redirect(url);
  });

  app.post("/api/auth/apple/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      
      if (!state || !appleOAuthStates.has(state)) {
        console.error('Apple callback: state mismatch or missing (CSRF check failed)');
        return res.redirect("/login?error=apple_failed");
      }
      appleOAuthStates.delete(state);

      if (!code) {
        console.error('Apple callback: no code received, body:', JSON.stringify(req.body));
        return res.redirect("/login?error=apple_failed");
      }
      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        return res.redirect("/login?error=apple_not_configured");
      }

      let clientSecret: string;
      try {
        clientSecret = generateAppleClientSecret();
      } catch (e) {
        console.error('Apple client secret generation failed:', e);
        return res.redirect("/login?error=apple_not_configured");
      }

      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const redirectUri = `${proto}://${req.get('host')}/api/auth/apple/callback`;

      const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Apple token exchange failed:', await tokenResponse.text());
        return res.redirect("/login?error=apple_failed");
      }

      const tokenData = await tokenResponse.json() as any;
      const appleIdToken = tokenData.id_token;
      
      if (!appleIdToken) {
        console.error('Apple callback: no id_token in token response');
        return res.redirect("/login?error=apple_failed");
      }

      const payload = JSON.parse(Buffer.from(appleIdToken.split('.')[1], 'base64').toString());
      
      if (payload.iss !== 'https://appleid.apple.com' || payload.aud !== clientId) {
        console.error('Apple id_token validation failed: iss or aud mismatch');
        return res.redirect("/login?error=apple_failed");
      }

      const email = payload.email || payload.sub;

      const userBody = req.body.user ? JSON.parse(req.body.user) : null;
      const firstName = userBody?.name?.firstName || '';
      const lastName = userBody?.name?.lastName || '';

      let user = await storage.getUserByEmail(email);
      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          firstName: firstName || 'Apple',
          lastName: lastName || 'User',
          password: hashedPassword,
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SIGNING_SECRET,
        { expiresIn: "24h" }
      );

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on Apple login:', err);
      });

      res.redirect(`/login?token=${token}&userId=${user.id}`);
    } catch (error) {
      console.error("Apple OAuth callback error:", error);
      res.redirect("/login?error=apple_failed");
    }
  });

  app.get("/api/auth/social/status", (req, res) => {
    const googleId = process.env.GOOGLE_CLIENT_ID;
    const appleId = process.env.APPLE_CLIENT_ID;
    const appleTeamId = process.env.APPLE_TEAM_ID;
    const appleKeyId = process.env.APPLE_KEY_ID;
    const applePrivateKey = process.env.APPLE_PRIVATE_KEY;
    const appleConfigured = !!(appleId && appleTeamId && appleKeyId && applePrivateKey);
    res.json({
      google: !!googleId,
      apple: appleConfigured,
    });
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        // Invoice details fields
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        registrationNumber: user.registrationNumber,
        taxId: user.taxId,
        companyAddress: user.companyAddress,
        companyCity: user.companyCity,
        companyState: user.companyState,
        companyCounty: user.companyCounty, // Add missing county field
        companyZip: user.companyZip,
        companyCountry: user.companyCountry,
        billingEmail: user.billingEmail,
        billingPhone: user.billingPhone,
        // Delivery address
        deliveryAddress: user.deliveryAddress,
        deliveryCity: user.deliveryCity,
        deliveryState: user.deliveryState,
        deliveryCounty: user.deliveryCounty, // Add missing delivery county field
        deliveryZip: user.deliveryZip,
        deliveryCountry: user.deliveryCountry,
        deliveryInstructions: user.deliveryInstructions,
        // Notification preferences
        emailNotifications: user.emailNotifications,
        orderUpdates: user.orderUpdates,
        productRestocks: user.productRestocks,
        priceDrops: user.priceDrops,
        promotions: user.promotions,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.put("/api/auth/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      // Check if email is already taken by another user
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== req.userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUser(req.userId!, {
        firstName,
        lastName,
        email,
      });

      res.json({ 
        id: updatedUser.id, 
        email: updatedUser.email, 
        firstName: updatedUser.firstName, 
        lastName: updatedUser.lastName, 
        isAdmin: updatedUser.isAdmin,
        // Include invoice fields in profile response too
        companyName: updatedUser.companyName,
        vatNumber: updatedUser.vatNumber,
        registrationNumber: updatedUser.registrationNumber,
        taxId: updatedUser.taxId,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity,
        companyState: updatedUser.companyState,
        companyCounty: updatedUser.companyCounty,
        companyZip: updatedUser.companyZip,
        companyCountry: updatedUser.companyCountry,
        billingEmail: updatedUser.billingEmail,
        billingPhone: updatedUser.billingPhone,
        deliveryAddress: updatedUser.deliveryAddress,
        deliveryCity: updatedUser.deliveryCity,
        deliveryState: updatedUser.deliveryState,
        deliveryCounty: updatedUser.deliveryCounty,
        deliveryZip: updatedUser.deliveryZip,
        deliveryCountry: updatedUser.deliveryCountry,
        deliveryInstructions: updatedUser.deliveryInstructions,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });



  // Update invoice details endpoint
  app.put("/api/auth/invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const {
        companyName,
        vatNumber,
        registrationNumber,
        taxId,
        companyAddress,
        companyCity,
        companyState,
        companyCounty,
        companyZip,
        companyCountry,
        billingEmail,
        billingPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryCounty,
        deliveryZip,
        deliveryCountry,
        deliveryInstructions,
      } = req.body;

      console.log('🔄 Updating user profile data for user:', req.userId);
      console.log('📊 Profile data received:', {
        companyName, companyAddress, companyCity, companyCounty, 
        billingEmail, billingPhone
      });

      const updatedUser = await storage.updateUser(req.userId!, {
        companyName,
        vatNumber,
        registrationNumber,
        taxId,
        companyAddress,
        companyCity,
        companyState,
        companyCounty,
        companyZip,
        companyCountry,
        billingEmail,
        billingPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryCounty,
        deliveryZip,
        deliveryCountry,
        deliveryInstructions,
      });

      console.log('✅ User profile updated successfully:', {
        id: updatedUser.id,
        companyName: updatedUser.companyName,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity
      });

      res.json({ 
        id: updatedUser.id, 
        email: updatedUser.email, 
        firstName: updatedUser.firstName, 
        lastName: updatedUser.lastName, 
        isAdmin: updatedUser.isAdmin,
        // Include all invoice/company fields
        companyName: updatedUser.companyName,
        vatNumber: updatedUser.vatNumber,
        registrationNumber: updatedUser.registrationNumber,
        taxId: updatedUser.taxId,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity,
        companyState: updatedUser.companyState,
        companyCounty: updatedUser.companyCounty,
        companyZip: updatedUser.companyZip,
        companyCountry: updatedUser.companyCountry,
        billingEmail: updatedUser.billingEmail,
        billingPhone: updatedUser.billingPhone,
        deliveryAddress: updatedUser.deliveryAddress,
        deliveryCity: updatedUser.deliveryCity,
        deliveryState: updatedUser.deliveryState,
        deliveryCounty: updatedUser.deliveryCounty,
        deliveryZip: updatedUser.deliveryZip,
        deliveryCountry: updatedUser.deliveryCountry,
        deliveryInstructions: updatedUser.deliveryInstructions,
        // Include notification preferences too
        emailNotifications: updatedUser.emailNotifications,
        orderUpdates: updatedUser.orderUpdates,
        productRestocks: updatedUser.productRestocks,
        priceDrops: updatedUser.priceDrops,
        promotions: updatedUser.promotions,
      });
    } catch (error) {
      console.error("❌ Error updating invoice details:", error);
      console.error("❌ Error stack:", (error as Error).stack);
      res.status(500).json({ message: "Failed to update invoice details" });
    }
  });

  // Change password endpoint
  app.put("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Get current user
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      const updatedUser = await storage.updateUser(req.userId!, {
        password: hashedNewPassword,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Update notification preferences endpoint
  app.put("/api/auth/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const {
        emailNotifications,
        orderUpdates,
        productRestocks,
        priceDrops,
        promotions,
      } = req.body;

      // Update user notification preferences in the database
      const [updatedUser] = await db
        .update(users)
        .set({
          emailNotifications,
          orderUpdates,
          productRestocks,
          priceDrops,
          promotions,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send confirmation email to test user (liviu.chertes@gmail.com)
      const preferences = {
        emailNotifications: updatedUser.emailNotifications,
        orderUpdates: updatedUser.orderUpdates,
        productRestocks: updatedUser.productRestocks,
        priceDrops: updatedUser.priceDrops,
        promotions: updatedUser.promotions,
      };

      try {
        await sendNotificationPreferencesEmail(updatedUser, {
          emailNotifications: updatedUser.emailNotifications || false,
          orderUpdates: updatedUser.orderUpdates || false,
          productRestocks: updatedUser.productRestocks || false,
          priceDrops: updatedUser.priceDrops || false,
          promotions: updatedUser.promotions || false
        }, getMarketFromRequest(req));
        console.log('✅ Notification preferences email sent successfully to:', updatedUser.email);
      } catch (emailError) {
        console.error('❌ Failed to send notification preferences email:', emailError);
        // Continue with success response even if email fails
      }
      
      res.json({ 
        message: "Notification preferences updated successfully",
        preferences
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const invoiceList = await storage.getInvoices(userId, getMarketFromRequest(req));
      const enriched = await Promise.all(invoiceList.map(async (inv) => {
        const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
        return { ...inv, itemCount: items.length };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Customer-facing account invoice endpoints (spec-compliant paths)
  app.get("/api/account/invoices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const invoiceList = await storage.getInvoices(userId, getMarketFromRequest(req));
      const enriched = await Promise.all(invoiceList.map(async (inv) => {
        const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
        return { ...inv, itemCount: items.length };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching account invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/account/invoices/:id/pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (!req.isAdmin && !(await invoiceMatchesRequestMarket(invoice, getMarketFromRequest(req)))) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Not authorized to access this invoice" });
      }
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      const pdfBuffer = await invoiceService.getInvoicePdf(invoiceId);
      if (!pdfBuffer) return res.status(404).json({ message: "PDF not available for this invoice" });
      const filename = `Factura_${(invoice as any).invoiceNumber?.replace(/[^a-zA-Z0-9]/g, '_') || invoiceId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading account invoice PDF:", error);
      res.status(500).json({ message: "Failed to download invoice PDF" });
    }
  });

  app.get("/api/account/subscriptions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const subscriptionList = await listUserSubscriptions(req.userId!);
      res.json(subscriptionList);
    } catch (error) {
      console.error("Get account subscriptions error:", error);
      res.status(500).json({ message: "Failed to load subscriptions" });
    }
  });

  app.post("/api/account/subscriptions/:id/cancel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const subscriptionId = Number(req.params.id);
      if (!Number.isInteger(subscriptionId)) {
        return res.status(400).json({ message: "Invalid subscription" });
      }
      const canceled = await cancelUserSubscription(req.userId!, subscriptionId);
      if (!canceled) {
        return res.status(404).json({ message: "Subscription not found or already canceled" });
      }
      res.json(canceled);
    } catch (error) {
      console.error("Cancel account subscription error:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.get("/api/invoices/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (!req.isAdmin && !(await invoiceMatchesRequestMarket(invoice, getMarketFromRequest(req)))) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if user owns this invoice or is admin
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/number/:invoiceNumber", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceNumber = req.params.invoiceNumber;
      const invoice = await storage.getInvoiceByNumber(invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (!req.isAdmin && !(await invoiceMatchesRequestMarket(invoice, getMarketFromRequest(req)))) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const totalNum = parseFloat(String(invoice.totalAmount));
      const vatNum = parseFloat(String(invoice.vatAmount));
      if (vatNum === 0 && totalNum > 0) {
        const invoiceMarket = invoice.market ?? "ro";
        const vatRate = parseFloat(String(
          marketSettingsMap.get(invoiceMarket)?.vatPercentage ??
          (invoiceMarket === "fr" ? "20" : "21")
        ));
        const calculatedVat = (totalNum * vatRate) / (100 + vatRate);
        const calculatedSubtotal = totalNum - calculatedVat;
        invoice.subtotal = calculatedSubtotal.toFixed(2);
        invoice.vatAmount = calculatedVat.toFixed(2);
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice by number:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/:invoiceId/pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (!req.isAdmin && !(await invoiceMatchesRequestMarket(invoice, getMarketFromRequest(req)))) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check direct ownership; also allow if the invoice belongs to one of the user's orders (covers guest-linked invoices)
      if (invoice.userId !== req.userId && !req.isAdmin) {
        let allowed = false;
        if (invoice.orderId) {
          const userOrder = await db.select({ id: orders.id }).from(orders)
            .where(and(eq(orders.id, invoice.orderId), eq(orders.userId, req.userId!)))
            .limit(1);
          if (userOrder.length > 0) {
            allowed = true;
            // Link the invoice to this user so future checks pass instantly
            await db.update(invoices).set({ userId: req.userId! }).where(eq(invoices.id, invoiceId));
          }
        }
        if (!allowed) {
          return res.status(403).json({ message: "Not authorized to access this invoice" });
        }
      }

      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      const pdfBuffer = await invoiceService.getInvoicePdf(invoiceId);

      if (!pdfBuffer) {
        return res.status(404).json({ message: "PDF not available for this invoice" });
      }

      const filename = `Factura_${(invoice as any).invoiceNumber?.replace(/[^a-zA-Z0-9]/g, '_') || invoiceId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      res.status(500).json({ message: "Failed to download invoice PDF" });
    }
  });

  // Create invoice from order - both endpoints for compatibility
  app.post("/api/orders/:orderId/create-invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'wire_transfer' } = req.body;
      
      // Get the order with items
      const order = await storage.getOrder(orderId);
      console.log(`Fetched order ${orderId}:`, JSON.stringify(order, null, 2));
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (!req.isAdmin && !marketMatches(order.market, getMarketFromRequest(req))) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin (also match by email for guest orders)
      let isOwner = order.userId === req.userId;
      if (!isOwner && !req.isAdmin && req.userId) {
        const user = await storage.getUser(req.userId);
        const orderEmail = (order.shippingAddress as any)?.email || (order.billingAddress as any)?.email;
        if (user && orderEmail && user.email === orderEmail) {
          isOwner = true;
          if (!order.userId) {
            await storage.updateOrder(orderId, { userId: req.userId });
          }
        }
      }
      if (!isOwner && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if order has items
      if (!order.items || order.items.length === 0) {
        console.error(`Order ${orderId} has no items:`, order.items);
        return res.status(400).json({ message: "Order has no items to create invoice" });
      }

      // Generate unique invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      // Create payment link for wire transfer
      let paymentLink = '';
      if (paymentMethod === 'wire_transfer') {
        paymentLink = `https://www.xhaccp.com/pay/invoice/${invoiceNumber}`;
      }

      // Calculate totals using the order's marketplace tax and currency.
      const subtotal = parseFloat(order.totalAmount);
      const invoiceMarket = order.market || "ro";
      const vatRate = parseFloat(String(
        marketSettingsMap.get(invoiceMarket)?.vatPercentage ??
        (invoiceMarket === "fr" ? "20" : "21")
      ));
      const vatAmount = (subtotal * vatRate) / (100 + vatRate); // Extract VAT from total
      const subtotalWithoutVat = subtotal - vatAmount;
      const totalAmount = subtotal; // Total already includes VAT

      // Create invoice
      const invoiceData = {
        invoiceNumber,
        orderId,
        market: invoiceMarket,
        userId: req.userId || order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: order.currency || marketSettingsMap.get(invoiceMarket)?.currency || (invoiceMarket === "ro" ? "RON" : "EUR"),
        paymentMethod,
        paymentLink: paymentLink || null,
        notes: `Factura cu TVA ${vatRate}% pentru piața ${invoiceMarket.toUpperCase()}`,
      };

      // Create invoice items
      const invoiceItems = order.items.map(item => ({
        invoiceId: 0, // Will be set after invoice creation
        productId: item.productId,
        productName: compositeSnapshotName(item),
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: vatRate.toFixed(2),
        lineTotal: item.totalPrice,
      }));

      const invoice = await storage.createInvoice(invoiceData as any, invoiceItems);
      
      // Get the full invoice with items for response
      const fullInvoice = await storage.getInvoice(invoice.id);
      
      res.json(fullInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.post("/api/orders/:orderId/invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'wire_transfer' } = req.body;
      
      console.log(`🧾 CREATING INVOICE for order ${orderId} using Smartbill integration`);
      console.log(`📋 Smartbill Configuration: enabled=${process.env.ENABLE_SMARTBILL === 'true'}, series=${process.env.SMARTBILL_SERIES}`);
      
      // Get the order with items
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (!req.isAdmin && !marketMatches(order.market, getMarketFromRequest(req))) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin (also match by email for guest orders)
      let isOwner = order.userId === req.userId;
      let effectiveUserId = order.userId || req.userId;
      if (!isOwner && !req.isAdmin && req.userId) {
        const reqUser = await storage.getUser(req.userId);
        const orderEmail = (order.shippingAddress as any)?.email || (order.billingAddress as any)?.email;
        if (reqUser && orderEmail && reqUser.email === orderEmail) {
          isOwner = true;
          effectiveUserId = req.userId;
          if (!order.userId) {
            await storage.updateOrder(orderId, { userId: req.userId });
          }
        }
      }
      if (!isOwner && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get user details for Smartbill invoice
      const user = await storage.getUser(effectiveUserId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Initialize InvoiceService with corrected Smartbill configuration
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();

      console.log(`📋 Smartbill enabled: ${process.env.ENABLE_SMARTBILL === 'true'}, Series: ${process.env.SMARTBILL_SERIES}`);

      // Create invoice using InvoiceService (will use Smartbill if enabled)
      const invoice = await invoiceService.createInvoiceForOrder(order, user, { paymentMethod });
      
      console.log(`✅ Invoice created successfully:`, {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        smartbillId: invoice.smartbillId,
        source: invoice.smartbillId ? 'Smartbill' : 'Local'
      });
      
      res.json(invoice);
    } catch (error) {
      console.error(`❌ Error creating invoice for order ${req.params.orderId}:`, error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Download invoice as PDF (placeholder for now)
  app.get("/api/invoices/:id/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (!req.isAdmin && !(await invoiceMatchesRequestMarket(invoice, getMarketFromRequest(req)))) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if user owns this invoice or is admin
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // For now, return a message that PDF generation is not implemented
      // In a real application, you would generate a PDF here using a library like puppeteer
      res.status(501).json({ message: "PDF generation not yet implemented" });
    } catch (error) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ message: "Failed to download invoice" });
    }
  });

  // Admin: Update invoice number (for correcting SmartBill sync discrepancies)
  app.patch("/api/admin/invoices/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { invoiceNumber, smartbillNumber, smartbillSeries } = req.body;

      if (!invoiceNumber) {
        return res.status(400).json({ message: "invoiceNumber is required" });
      }

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const updated = await storage.updateInvoice(invoiceId, {
        invoiceNumber,
        ...(smartbillNumber && { smartbillNumber }),
        ...(smartbillSeries && { smartbillSeries }),
      });

      console.log(`✏️ Admin corrected invoice #${invoiceId}: ${invoice.invoiceNumber} → ${invoiceNumber}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Public company data for the detected market (no auth required).
  app.get("/api/company-settings", async (req, res) => {
    try {
      const market = getMarketFromRequest(req);
      const settings = await storage.getCompanySettingsByMarket(market);
      if (!settings) return res.json({});
      res.json({
        name: settings.name,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        city: settings.city,
        state: settings.state,
        zipCode: settings.zipCode,
        country: settings.country,
        contactPerson: settings.contactPerson,
        website: settings.website,
        vatNumber: settings.vatNumber,
        registrationNumber: settings.registrationNumber,
        bankName: settings.bankName,
        iban: settings.iban,
        description: settings.description,
        defaultVatPercentage: settings.defaultVatPercentage,
      });
    } catch (error) {
      console.error("Error fetching public company settings:", error);
      res.json({});
    }
  });

  // Public homepage hero configuration for the detected marketplace.
  app.get("/api/homepage-hero", async (req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const market = getMarketFromRequest(req);
      const [storedSlides, settings] = await Promise.all([
        storage.getHomepageHeroSlides(market),
        storage.getHomepageHeroSettings(market),
      ]);
      const slides = await Promise.all(storedSlides.map(async (slide) => {
        const destinationUrl = await resolveHomepageHeroDestination(slide, market);
        return {
          ...slide,
          destinationUrl,
          // Keep the existing CTA contract working while making a configured
          // category/product destination authoritative over a stale ctaUrl.
          ctaUrl: slide.destinationType && slide.destinationType !== "none"
            ? destinationUrl
            : slide.ctaUrl,
        };
      }));
      res.json({
        slides,
        autoplaySeconds: Math.min(30, Math.max(3, settings?.autoplaySeconds || 5)),
      });
    } catch (error) {
      console.error("Error fetching public homepage hero:", error);
      res.status(503).json({ message: "Homepage hero is temporarily unavailable" });
    }
  });

  // Category routes - instant response from memory
  app.get("/api/categories", (req, res) => {
    // No browser caching to ensure admin changes are visible immediately
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `categories-${dataVersion}`,
      'Content-Type': 'application/json'
    });
    const market = getMarketFromRequest(req);
    {
      const filtered = categoriesData.filter((c: any) => (c.marketCode || 'ro') === market);
      // Category rows are independent per marketplace. Never expose another
      // market's rows as a fallback: that would make a category look available
      // on the wrong storefront and make its product links ambiguous.
      const withMarketCounts = filtered.map((category: any) => ({
        ...category,
        productCount: allProductsData.filter((product: any) => {
          const overlaid = applyMarketOverlay(product, market);
          return overlaid?.categoryId === category.id;
        }).length,
      }));
      return res.json(withMarketCounts);
    }
  });

  app.post("/api/categories", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      await loadAllDataIntoMemory();
      res.json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(400).json({ message: "Invalid category data" });
    }
  });

  app.put("/api/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const categoryData = req.body;
      const category = await storage.updateCategory(categoryId, categoryData);
      await loadAllDataIntoMemory();
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(400).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      await loadAllDataIntoMemory();
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Product routes - ultra-fast response from memory
  app.get("/api/products", (req, res) => {
    const { categorySlug, search, limit = "20", featured } = req.query;
    const market = getMarketFromRequest(req);
    
    let products: any[] = [];
    
    // Start from the shared product records, then resolve each product's
    // marketplace-specific category before applying category filters.
    products = allProductsData;
    
    // Apply market overlay: filter out products disabled for this market, apply price overrides
    {
      const withOverlay: any[] = [];
      for (const p of products) {
        const overlaid = applyMarketOverlay(p, market);
        if (overlaid !== null) withOverlay.push(overlaid);
      }
      products = withOverlay;
    }

    if (categorySlug) {
      const publicSlug = String(categorySlug);
      const requestedSlug = market === "fr" && publicSlug === "etiquettes-alimentaires"
        ? "food-labels"
        : publicSlug;
      products = products.filter((product: any) =>
        product.category?.slug === requestedSlug
      );
    }
    
    // Apply featured filter if requested
    if (featured === 'true') {
      products = products.filter(product => product.featured === true);
    }
    
    // Apply search filter if needed (optimized string operations)
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      products = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply limit (optimized slice operation)
    const limitNum = parseInt(limit as string) || 20;
    if (limitNum > 0 && products.length > limitNum) {
      products = products.slice(0, limitNum);
    }
    
    // Marketplace availability changes must be visible immediately after an
    // admin import/removal, not up to five minutes later from browser/CDN cache.
    const searchKey = search ? encodeURIComponent(String(search)) : 'all';
    res.set({
      'Cache-Control': 'no-store',
      'ETag': `products-${dataVersion}-${market}-${categorySlug || 'all'}-${featured || 'all'}-${searchKey}-${limitNum}`,
      'Content-Type': 'application/json'
    });
    
    res.json(products);
  });

  app.get("/api/products/:id", createPublicProductDetailHandler({
    getProduct: productId => storage.getProduct(productId),
    getMarket: getMarketFromRequest,
    applyMarketOverlay,
    decorateCompositeProduct,
  }));

  app.get("/api/products/slug/:slug", createPublicProductSlugHandler({
    getCachedProductBySlug: slug => productsBySlug.get(slug),
    getProductBySlug: slug => storage.getProductBySlug(slug),
    getActiveProducts: () => allProductsData,
    getMarket: getMarketFromRequest,
    applyMarketOverlay,
    decorateCompositeProduct,
  }));

  // Get product translation by language (public endpoint)
  app.get("/api/products/:id/translation/:language", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const language = req.params.language;
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const translation = await storage.getProductTranslation(productId, language);
      if (!translation) {
        return res.status(404).json({ message: "Translation not found" });
      }
      res.json(translation);
    } catch (error) {
      console.error("Get product translation error:", error);
      res.status(500).json({ message: "Failed to get product translation" });
    }
  });

  app.get("/api/categories/:id/translation/:language", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const language = req.params.language;
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      const translation = await storage.getCategoryTranslation(categoryId, language);
      if (!translation) {
        return res.status(404).json({ message: "Translation not found" });
      }
      res.json(translation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get category translation" });
    }
  });

  app.get("/api/category-translations/:language", async (req, res) => {
    try {
      const language = req.params.language;
      const categoryIds = req.query.ids?.toString().split(',').map(Number).filter(id => !isNaN(id)) || [];
      if (categoryIds.length === 0) {
        return res.json({});
      }
      const results = await storage.getCategoryTranslationsBatch(categoryIds, language);
      const translations: Record<number, { name: string; description: string | null }> = {};
      for (const t of results) {
        translations[t.categoryId] = { name: t.name, description: t.description };
      }
      res.json(translations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get category translations" });
    }
  });

  // Get all translations for multiple products by language (batch endpoint)
  app.get("/api/translations/:language", async (req, res) => {
    try {
      const language = req.params.language;
      const productIds = req.query.ids?.toString().split(',').map(Number).filter(id => !isNaN(id)) || [];
      
      if (productIds.length === 0) {
        return res.json({});
      }
      
      const translations: Record<number, { name: string; description: string | null }> = {};
      
      for (const productId of productIds) {
        const translation = await storage.getProductTranslation(productId, language);
        if (translation) {
          translations[productId] = {
            name: translation.name,
            description: translation.description
          };
        }
      }
      
      res.json(translations);
    } catch (error) {
      console.error("Get batch translations error:", error);
      res.status(500).json({ message: "Failed to get translations" });
    }
  });

  app.post("/api/products", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      await loadAllDataIntoMemory();
      res.json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(400).json({ message: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const productData = req.body;
      const product = await storage.updateProduct(productId, productData);
      await loadAllDataIntoMemory();
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      await storage.deleteProduct(productId);
      await loadAllDataIntoMemory();
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Cart routes
  app.get("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const market = getMarketFromRequest(req);
      const cartItems = await storage.getCartItems(req.userId!, market);
      // Apply market overlay to each cart item's product:
      // - items whose product is inactive for this market are filtered out
      // - surviving items get market-specific price, compareAtPrice, currency, stock
      const marketItems = (await Promise.all(cartItems
        .map(async (item) => {
          if (!item.product) return item;
          const overlaid = applyMarketOverlay(item.product, market);
          if (overlaid === null) return null; // product inactive in this market
          if (item.product.isComposite) {
            try {
              const configuration = await getCompositeConfiguration(
                item.product,
                market,
                item.compositeConfiguration?.components,
              );
              return {
                ...item,
                compositeConfiguration: configuration,
                product: { ...overlaid, price: configuration.totalPrice, currency: configuration.currency },
              };
            } catch {
              return null;
            }
          }
          return { ...item, product: overlaid };
        })))
        .filter((item): item is NonNullable<typeof item> => item !== null);
      res.json(marketItems);
    } catch (error) {
      console.error("Get cart error:", error);
      res.status(500).json({ message: "Failed to get cart" });
    }
  });

  app.post("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.body?.productId);
      const quantity = Number(req.body?.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
        return res.status(400).json({ message: "Invalid cart item" });
      }
      const product = await storage.getProduct(productId);
      if (!product || product.status?.toLowerCase() !== "active") {
        return res.status(400).json({ message: "Product is not available" });
      }
      const market = getMarketFromRequest(req);
      if (applyMarketOverlay(product, market) === null) {
        return res.status(400).json({ message: "Product is not available in this market" });
      }
      const compositeConfiguration = product.isComposite
        ? await getCompositeConfiguration(
            product,
            market,
            req.body?.compositeConfiguration?.components ?? req.body?.components,
          )
        : null;
      const cartItemData: InsertCartItem = {
        userId: req.userId,
        productId,
        market,
        quantity,
        compositeConfiguration,
      };
      const cartItem = await storage.addToCart(cartItemData);
      res.json(cartItem);
    } catch (error) {
      console.error("Add to cart error:", error);
      res.status(400).json({ message: "Failed to add to cart" });
    }
  });

  app.put("/api/cart/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const cartItemId = Number(req.params.id);
      const quantity = Number(req.body?.quantity);
      const market = getMarketFromRequest(req);
      if (!Number.isInteger(cartItemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
        return res.status(400).json({ message: "Quantity must be an integer between 1 and 9999" });
      }
      const cartItem = await storage.updateCartItem(cartItemId, req.userId!, quantity, market);
      if (!cartItem) return res.status(404).json({ message: "Cart item not found" });
      res.json(cartItem);
    } catch (error) {
      console.error("Update cart item error:", error);
      res.status(400).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const cartItemId = Number(req.params.id);
      const market = getMarketFromRequest(req);
      if (!Number.isInteger(cartItemId)) {
        return res.status(400).json({ message: "Invalid cart item" });
      }
      const removed = await storage.removeFromCart(cartItemId, req.userId!, market);
      if (!removed) return res.status(404).json({ message: "Cart item not found" });
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Remove from cart error:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  app.delete("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearCart(req.userId!, getMarketFromRequest(req));
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Clear cart error:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Voucher validation route (public for checkout)
  app.post("/api/vouchers/validate", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { code, orderTotal } = req.body;
      
      if (!code) {
        return res.status(400).json({ valid: false, message: "Voucher code is required" });
      }

      const trustedMarket = getMarketFromRequest(req);
      const voucher = await storage.getVoucherByCode(code, trustedMarket);
      
      if (!voucher) {
        return res.status(404).json({ valid: false, message: "Voucher code not found" });
      }

      if (voucher.ownerUserId !== null) {
        const account = req.userId ? await storage.getUser(req.userId) : undefined;
        const ownerError = account
          ? getVoucherOwnershipError(voucher, account.id, account.email)
          : null;
        const checkoutEmailError = getVoucherOwnershipError(
          voucher,
          account?.id,
          typeof req.body?.email === "string" ? req.body.email : account?.email,
        );
        if (ownerError || checkoutEmailError) {
          return res.status(403).json({ valid: false, message: ownerError || checkoutEmailError });
        }
      }

      const now = new Date();
      const validityError = getVoucherValidityError(voucher, now);
      if (validityError) {
        return res.status(400).json({ valid: false, message: validityError });
      }

      // Check max uses
      if (voucher.maxUses && voucher.usedCount !== null && voucher.usedCount >= voucher.maxUses) {
        return res.status(400).json({ valid: false, message: "This voucher has reached its usage limit" });
      }

      // Check minimum order amount
      if (voucher.minOrderAmount && orderTotal && parseFloat(orderTotal) < parseFloat(voucher.minOrderAmount)) {
        return res.status(400).json({ 
          valid: false, 
          message: `Minimum order amount for this voucher is ${voucher.minOrderAmount}` 
        });
      }

      // Calculate discount
      let discountAmount = 0;
      if (voucher.discountType === 'percentage') {
        discountAmount = orderTotal ? (parseFloat(orderTotal) * parseFloat(voucher.discountValue)) / 100 : 0;
      } else {
        discountAmount = parseFloat(voucher.discountValue);
      }

      res.json({
        valid: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          name: voucher.name,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          discountAmount: discountAmount.toFixed(2)
        }
      });
    } catch (error) {
      console.error("Validate voucher error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate voucher" });
    }
  });

  // Order routes
  app.get("/api/orders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const market = getMarketFromRequest(req);
      const orders = await storage.getOrders(req.userId);
      res.json(orders.filter(order => marketMatches(order.market, market)));
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  app.get("/api/orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (!req.isAdmin && !marketMatches(order.market, getMarketFromRequest(req))) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Not authorized to access this order" });
      }
      res.json(order);
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ message: "Failed to get order" });
    }
  });

  app.post("/api/orders", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { shippingAddress, billingAddress, paymentMethod, items, notes, voucherCode, contactPhone, email: bodyEmail, recurringConsent } = req.body;
      
      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }
      
      // SECURITY: Look up product prices from database - NEVER trust client-provided prices or quantities
      const orderMarket = getMarketFromRequest(req);
      if (orderMarket === "fr" && paymentMethod !== "viva") {
        return res.status(400).json({ message: "Only online card payment is available on the French marketplace" });
      }
      const validatedItems = await Promise.all(
        items.map((item: any) => validateOrderItemForMarket(item, orderMarket)),
      );
      const subscriptionItems = validatedItems.filter((item: any) => item.productType === "subscription");
      if (subscriptionItems.length > 0) {
        if (!req.userId || paymentMethod !== "viva" || recurringConsent !== true) {
          return res.status(400).json({ message: "Subscription checkout requires an authenticated Viva recurring payment with consent" });
        }
        if (subscriptionItems.length !== validatedItems.length || subscriptionItems.length !== 1 || subscriptionItems[0].quantity !== 1) {
          return res.status(400).json({ message: "Subscriptions must be purchased separately as one item" });
        }
      }
      
      // Calculate subtotal from validated items (using server-side prices with volume discounts)
      const subtotal = validatedItems.reduce((sum: number, item: any) => sum + Number(item.displayTotalPrice), 0);
      
      // Shipping and tax settings are market-owned. Never fall back to the
      // first/global company row for a different storefront.
      const market = orderMarket;
      const companySettings = await storage.getCompanySettingsByMarket(market);
      const marketSetting = marketSettingsMap.get(market);
      const vatPercentage = Number(marketSetting?.vatPercentage ?? 0);
      const freeShippingThreshold = marketSetting?.freeShippingThreshold
        ? parseFloat(marketSetting.freeShippingThreshold)
        : (companySettings?.freeShippingThreshold ? parseFloat(companySettings.freeShippingThreshold) : (market === "ro" ? 1000 : 200));
      const standardShippingCost = marketSetting?.standardShippingCost
        ? parseFloat(marketSetting.standardShippingCost)
        : (companySettings?.standardShippingCost ? parseFloat(companySettings.standardShippingCost) : (market === "ro" ? 35 : 12));
      
      const shippingCost = calculateShippingQuote(
        validatedItems,
        freeShippingThreshold,
        standardShippingCost,
      ).shippingCost;
      
      // Server-side voucher validation (do NOT trust client-provided discount amounts)
      let discountAmount = 0;
      let validatedVoucher: {
        id: number;
        code: string;
        discountType: string;
        discountValue: string;
        ownerUserId: number | null;
      } | null = null;
      const guestEmail = String(bodyEmail || shippingAddress?.email || billingAddress?.email || "");
      
      if (voucherCode) {
        const orderMarket = getMarketFromRequest(req);
        const voucher = await storage.getVoucherByCode(voucherCode, orderMarket);
        if (voucher && voucher.isActive) {
          const account = req.userId ? await storage.getUser(req.userId) : undefined;
          const ownerError = getVoucherOwnershipError(voucher, account?.id, account?.email || guestEmail);
          const checkoutEmailError = account
            ? getVoucherOwnershipError(voucher, account.id, guestEmail || account.email)
            : null;
          if (ownerError || checkoutEmailError) {
            return res.status(403).json({ message: ownerError || checkoutEmailError });
          }
          const now = new Date();
          const validFrom = voucher.validFrom ? new Date(voucher.validFrom) : null;
          const validUntil = voucher.validUntil ? new Date(voucher.validUntil) : null;
          const validityError = getVoucherValidityError(voucher, now);
          const maxUsesReached = voucher.maxUses && voucher.usedCount && voucher.usedCount >= voucher.maxUses;
          const minOrderMet = !voucher.minOrderAmount || subtotal >= parseFloat(voucher.minOrderAmount);
          
          if (!validityError && !maxUsesReached && minOrderMet &&
              (!validFrom || now >= validFrom) && 
              (!validUntil || now <= validUntil)) {
            // Calculate discount based on voucher type
            if (voucher.discountType === 'percentage') {
              discountAmount = subtotal * (parseFloat(voucher.discountValue) / 100);
            } else {
              discountAmount = parseFloat(voucher.discountValue);
            }
            validatedVoucher = voucher;
          }
        }
      }
      
      // Apply voucher discount (to subtotal only, not shipping)
      const taxSnapshot = calculateOrderTaxSnapshot(
        validatedItems.map((item: any) => ({ ...item, totalPriceGross: item.totalPrice })),
        discountAmount,
        shippingCost,
        vatPercentage,
        defaultPriceDisplayMode(orderMarket),
      );
      discountAmount = Number(taxSnapshot.discountAmount);
      const totalAmount = Number(taxSnapshot.totalAmount);
      
      // Add voucher info to notes if applied
      let orderNotes = notes || '';
      if (validatedVoucher && discountAmount > 0) {
        orderNotes = `Voucher: ${validatedVoucher.code} (-${discountAmount.toFixed(2)})${orderNotes ? '\n' + orderNotes : ''}`;
      }
      
      if (!req.userId && guestEmail) {
        orderNotes = `Guest email: ${guestEmail}${contactPhone ? ', Phone: ' + contactPhone : ''}${orderNotes ? '\n' + orderNotes : ''}`;
      }

      const orderData = {
        userId: getVoucherOrderUserId(validatedVoucher, req.userId),
        market: orderMarket,
        currency: marketSettingsMap.get(orderMarket)?.currency ?? (orderMarket === "ro" ? "RON" : "EUR"),
        status: "pending",
        totalAmount: totalAmount.toFixed(2),
        subtotalNet: taxSnapshot.subtotalNet,
        subtotalGross: taxSnapshot.subtotalGross,
        vatPercentage: moneyString(vatPercentage),
        vatAmount: taxSnapshot.vatAmount,
        shippingNetAmount: taxSnapshot.shippingNetAmount,
        shippingVatAmount: taxSnapshot.shippingVatAmount,
        shippingCost: taxSnapshot.shippingGrossAmount,
        voucherCode: validatedVoucher?.code || undefined,
        discountAmount: discountAmount > 0 ? taxSnapshot.discountAmount : undefined,
        discountNetAmount: discountAmount > 0 ? taxSnapshot.discountNetAmount : undefined,
        discountGrossAmount: discountAmount > 0 ? taxSnapshot.discountGrossAmount : undefined,
        shippingAddress: { ...shippingAddress, email: guestEmail || shippingAddress?.email },
        billingAddress,
        paymentMethod,
        paymentStatus: "pending",
        notes: orderNotes || undefined,
      };

      const order = await storage.createOrder(orderData, validatedItems);
      
      const fullOrder = await storage.getOrder(order.id);
      
      if (req.userId) {
        const user = await storage.getUser(req.userId);
        if (fullOrder && user) {
          const { sendOrderConfirmationEmail, sendNewOrderNotificationEmail, getCompanyEmailFromSettings } = await import('./email-service.js');
          sendOrderConfirmationEmail(fullOrder, user, fullOrder.paymentMethod || undefined).catch(error => {
            console.error('Failed to send order confirmation to customer:', error);
          });
          getCompanyEmailFromSettings().then((companyEmail: string | null) => {
            if (companyEmail) {
              sendNewOrderNotificationEmail(fullOrder, user, companyEmail).catch((error: any) => {
                console.error('Failed to send new order notification to company:', error);
              });
            }
          }).catch((err: any) => console.error('Failed to get company email:', err));
        }
        await storage.clearCart(req.userId, orderMarket);
      } else if (fullOrder) {
        const guestUser = {
          id: 0,
          email: guestEmail,
          firstName: shippingAddress?.firstName || 'Guest',
          lastName: shippingAddress?.lastName || '',
          name: `${shippingAddress?.firstName || 'Guest'} ${shippingAddress?.lastName || ''}`.trim(),
        };
        const { sendOrderConfirmationEmail, sendNewOrderNotificationEmail, getCompanyEmailFromSettings } = await import('./email-service.js');
        sendOrderConfirmationEmail(fullOrder, guestUser as any, fullOrder.paymentMethod || undefined).catch(error => {
          console.error('Failed to send guest order confirmation email:', error);
        });
        getCompanyEmailFromSettings().then((companyEmail: string | null) => {
          if (companyEmail) {
            sendNewOrderNotificationEmail(fullOrder, guestUser as any, companyEmail).catch((error: any) => {
              console.error('Failed to send new order notification to company:', error);
            });
          }
        }).catch((err: any) => console.error('Failed to get company email:', err));
      }
      
      // KitOff integration: for COD orders notify immediately at placement
      if (fullOrder && (paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash')) {
        const codEmail = (req.userId
          ? ((await storage.getUser(req.userId))?.email || guestEmail)
          : guestEmail);
        if (codEmail && fullOrder.items) {
          (async () => {
            try {
              const { maybeNotifyKitoff } = await import('./kitoff-webhook.js');
              const kitoffItems = fullOrder.items.map((item: any) => ({
                productName: item.product?.name || '',
                quantity: item.quantity,
              }));
              await maybeNotifyKitoff(codEmail, fullOrder.id, kitoffItems);
            } catch (kitoffErr) {
              console.error(`[KitOff] COD notification failed for order #${fullOrder.id}:`, kitoffErr);
            }
          })();
        }
      }

      res.json(order);
    } catch (error: any) {
      console.error("Create order error:", error);
      if (error instanceof VoucherReservationConflictError) {
        return res.status(409).json({ message: error.message });
      }
      const errorMessage = error?.message || "Failed to create order";
      res.status(400).json({ message: errorMessage });
    }
  });

  app.put("/api/orders/:id/status", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const order = await storage.updateOrderStatus(orderId, status);
      
      res.json(order);

      if (status === 'processing') {
        (async () => {
          try {
            console.log(`🔄 Processing acceptance flow for order #${orderId}...`);
            const fullOrder = await storage.getOrder(orderId);
            if (!fullOrder) return;

            const shippingAddr = fullOrder.shippingAddress as any;
            const billingAddr = fullOrder.billingAddress as any;
            let customerEmail = '';

            if (fullOrder.userId) {
              const user = await storage.getUser(fullOrder.userId);
              if (user) customerEmail = user.email;
            }
            if (!customerEmail) {
              customerEmail = shippingAddr?.email || billingAddr?.email || fullOrder.notes?.match(/Guest email:\s*([^\s,]+)/)?.[1] || '';
            }

            const isCOD = fullOrder.paymentMethod === 'cash_on_delivery' || fullOrder.paymentMethod === 'cod' || fullOrder.paymentMethod === 'cash';
            let invoiceGenerated = false;
            let invoiceNumber: string | undefined;
            let invoiceId: number | undefined;
            let awbNumber: string | undefined;

            try {
              console.log(`📄 Generating SmartBill invoice for order #${orderId} (${isCOD ? 'COD' : fullOrder.paymentMethod})...`);
              const { createInvoiceService } = await import('./invoice-service.js');
              const invoiceSvc = await createInvoiceService();
              const invoice = await invoiceSvc.generateInvoiceAfterPayment(
                orderId,
                {
                  status: 'succeeded',
                  paymentMethod: isCOD ? 'cash_on_delivery' : (fullOrder.paymentMethod || 'card'),
                  paymentId: isCOD ? `cod_${orderId}` : `accept_${orderId}`,
                  amount: parseFloat(String(fullOrder.totalAmount)),
                }
              );
              console.log(`✅ Invoice generated for order #${orderId}:`, invoice.invoiceNumber);
              invoiceGenerated = true;
              invoiceNumber = invoice.invoiceNumber;
              invoiceId = invoice.id;
            } catch (invoiceError) {
              console.error(`❌ Failed to generate invoice for order #${orderId}:`, invoiceError);
            }

            if ((fullOrder.market || 'ro') === 'fr') {
              try {
                const awbResult = await generateAWBForOrder(orderId);
                if (awbResult) awbNumber = awbResult.awbNumber;
              } catch (awbError) {
                console.error(`❌ Failed to generate MyFlyingBox AWB for order #${orderId}:`, awbError);
              }
            } else {
              try {
                const { createSamedayAPI } = await import('./sameday-api');
                const samedayAPI = createSamedayAPI();
                if (samedayAPI) {
                  const currentOrder = await storage.getOrder(orderId);
                  if (currentOrder && !currentOrder.awbNumber) {
                    console.log(`📦 Generating AWB for order #${orderId}...`);
                    const [shippingContext, services] = await Promise.all([
                      getRomanianSamedayShippingContext(samedayAPI),
                      samedayAPI.getServices()
                    ]);
                    console.log(`📦 Using configured pickup point ${shippingContext.pickupPoint.id}; Services: ${services.length}`);

                    if (services.length > 0) {
                      const selectedPickupPoint = shippingContext.pickupPoint;
                      const parcels: any[] = [];
                      let parcelCounter = 1;

                      if (currentOrder.items && currentOrder.items.length > 0) {
                        for (const item of currentOrder.items) {
                          const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
                          if (!product) continue;
                          const piecesPerPackage = (product as any).piecesPerPackage || 1;
                          const weight = (product as any).weight || 1;
                          const numberOfPackages = Math.ceil(item.quantity / piecesPerPackage);
                          for (let i = 0; i < numberOfPackages; i++) {
                            parcels.push({ sequenceNo: parcelCounter++, weight, width: 30, height: 20, length: 40 });
                          }
                        }
                      }
                      if (parcels.length === 0) {
                        parcels.push({ sequenceNo: 1, weight: 1, width: 30, height: 20, length: 40 });
                      }

                      const totalAmount = parseFloat(String(currentOrder.totalAmount));
                      const defaultContact = shippingContext.contactPerson;
                      const awbData: any = {
                        pickupPoint: selectedPickupPoint.id,
                        contactPerson: defaultContact?.id,
                        service: services[0].id,
                        packageType: 0,
                        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
                        awbPayment: 1,
                        awbRecipient: {
                          name: `${shippingAddr?.firstName || ''} ${shippingAddr?.lastName || ''}`.trim() || 'Customer',
                          phoneNumber: shippingAddr?.phone || '',
                          personType: 0,
                          address: shippingAddr?.streetAddress || shippingAddr?.address || '',
                          countyString: shippingAddr?.state || shippingAddr?.county || '',
                          cityString: shippingAddr?.city || shippingAddr?.state || shippingAddr?.county || 'N/A',
                          postalCode: shippingAddr?.zipCode || '',
                        },
                        parcels,
                        thirdPartyPickup: 0,
                        insuredValue: 0,
                        cashOnDelivery: isCOD ? totalAmount : 0,
                        observation: `Order #${orderId}`,
                        clientInternalReference: `order_${orderId}`,
                      };

                      const awbResult = await samedayAPI.createAWB(awbData);
                      if (awbResult && awbResult.awbNumber) {
                        await storage.updateOrder(orderId, {
                          awbNumber: awbResult.awbNumber,
                          awbCost: String(awbResult.cost || 0),
                          awbCurrency: awbResult.currency || 'RON',
                          status: 'processing',
                        });
                        awbNumber = awbResult.awbNumber;
                        console.log(`✅ AWB generated for order #${orderId}: ${awbNumber}`);
                      }
                    }
                  } else if (currentOrder?.awbNumber) {
                    awbNumber = currentOrder.awbNumber;
                  }
                }
              } catch (awbError) {
                console.error(`❌ Failed to generate AWB for order #${orderId}:`, awbError);
              }
            }

            if (awbNumber) {
              const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');

              let awbPdfBuffer: Buffer | undefined;
              try {
                if ((fullOrder.market || 'ro') === 'fr') {
                  const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
                  const myFlyingBoxAPI = createMyFlyingBoxAPI();
                  if (myFlyingBoxAPI) {
                    awbPdfBuffer = await myFlyingBoxAPI.getLabels(awbNumber);
                    console.log(`📄 MyFlyingBox label retrieved for order #${orderId}`);
                  }
                } else {
                  const { createSamedayAPI } = await import('./sameday-api');
                  const samedayAPI = createSamedayAPI();
                  if (samedayAPI) {
                    awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                    console.log(`📄 AWB PDF retrieved for order #${orderId}`);
                  }
                }
              } catch (pdfError) {
                console.error(`AWB PDF retrieval failed for ${awbNumber}:`, pdfError);
              }

              const latestOrder = await storage.getOrder(orderId);
              if (latestOrder) {
                const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                for (const item of latestOrder.items) {
                  const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
                  const supplierId = product?.supplierId || null;
                  let supplierInfo = supplierGroups.get(supplierId);

                  if (!supplierInfo) {
                    if (supplierId) {
                      const supplier = await storage.getSupplier(supplierId);
                      if (supplier && supplier.email) {
                        supplierInfo = {
                          supplierName: supplier.contactPerson || supplier.name,
                          supplierEmail: supplier.email,
                          items: [],
                        };
                      }
                    }
                    if (!supplierInfo) {
                      const orderMkt = latestOrder.market || 'ro';
                      const companySettings = await storage.getCompanySettingsByMarket(orderMkt);
                      const fallbackEmail = companySettings?.logisticsEmail || companySettings?.email || '';
                      supplierInfo = {
                        supplierName: companySettings?.name || 'xHACCP',
                        supplierEmail: fallbackEmail,
                        items: [],
                      };
                    }
                    supplierGroups.set(supplierId, supplierInfo);
                  }

                  supplierInfo.items.push({
                    productName: item.product.name,
                    quantity: item.quantity,
                  });
                }

                for (const [, group] of supplierGroups) {
                  if (group.supplierEmail) {
                    try {
                      await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber, awbPdfBuffer);
                      console.log(`✅ Supplier email sent to ${group.supplierEmail} for order #${orderId}`);
                    } catch (err) {
                      console.error(`❌ Failed to send supplier email to ${group.supplierEmail}:`, err);
                    }
                  }
                }

                let invoicePdfBuffer: Buffer | null = null;
                if (invoiceGenerated && invoiceId) {
                  try {
                    const { createInvoiceService } = await import('./invoice-service.js');
                    const invoiceSvc = await createInvoiceService();
                    invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                    console.log(`📄 Invoice PDF retrieved for order #${orderId}`);
                  } catch (pdfError) {
                    console.error(`❌ Failed to retrieve invoice PDF for order #${orderId}:`, pdfError);
                  }
                }

                if (customerEmail) {
                  try {
                    if ((latestOrder.market || 'ro') === 'fr') {
                      const result = await sendFrenchOrderDocumentsEmail(orderId);
                      console.log(`FR customer documents email for accepted order #${orderId}: ${result}`);
                    } else {
                      await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber, invoicePdfBuffer, invoiceNumber);
                      console.log(`✅ Customer shipment email sent to ${customerEmail} for order #${orderId}`);
                    }
                  } catch (err) {
                    console.error(`❌ Failed to send customer shipment email for order #${orderId}:`, err);
                  }
                }
              }
            } else {
              // No AWB — but still send invoice confirmation email for fr/com markets (PDF attached)
              // and a plain confirmation for .ro orders that couldn't generate AWB
              console.log(`⚠️ No AWB generated for order #${orderId} — sending invoice confirmation email instead`);
              if ((fullOrder.market || 'ro') !== 'fr' && invoiceGenerated && invoiceId && customerEmail) {
                try {
                  const { sendOrderConfirmationEmail } = await import('./email-service.js');
                  let invoicePdfBuffer: Buffer | null = null;
                  try {
                    const { createInvoiceService } = await import('./invoice-service.js');
                    const invoiceSvc = await createInvoiceService();
                    invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                  } catch (pdfErr) {
                    console.error(`❌ Invoice PDF not available for no-AWB email on order #${orderId}:`, pdfErr);
                  }
                  const latestOrder = await storage.getOrder(orderId);
                  if (latestOrder) {
                    const user = fullOrder.userId ? await storage.getUser(fullOrder.userId) : null;
                    const guestUser = user || {
                      id: 0,
                      email: customerEmail,
                      firstName: (fullOrder.shippingAddress as any)?.firstName || 'Customer',
                      lastName: (fullOrder.shippingAddress as any)?.lastName || '',
                    };
                    await sendOrderConfirmationEmail(
                      latestOrder,
                      guestUser as any,
                      fullOrder.paymentMethod || undefined,
                      invoicePdfBuffer || undefined,
                      invoiceNumber
                    );
                    console.log(`✅ Invoice confirmation email sent to ${customerEmail} for order #${orderId} (no AWB)`);
                  }
                } catch (noAwbEmailErr) {
                  console.error(`❌ Failed to send invoice confirmation email for order #${orderId}:`, noAwbEmailErr);
                }
              }
            }

            console.log(`✅ Acceptance flow completed for order #${orderId}`);
          } catch (error) {
            console.error(`❌ Background acceptance flow failed for order #${orderId}:`, error);
          }
        })();
      }
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(400).json({ message: "Failed to update order status" });
    }
  });

  // AWB Generation routes
  app.post("/api/orders/:id/generate-awb", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if ((order.market as string) === "fr") {
        const myFlyingBoxResult = await generateAWBForOrder(orderId);
        if (!myFlyingBoxResult) {
          return res.status(500).json({
            message: "MyFlyingBox AWB could not be generated. Check the MFB credentials and shipper address configuration.",
          });
        }
        return res.json({
          success: true,
          awbNumber: myFlyingBoxResult.awbNumber,
          awbCost: myFlyingBoxResult.cost,
          currency: myFlyingBoxResult.currency,
          order: await storage.getOrder(orderId),
          trackingUrl: `/api/orders/${orderId}/track-awb`,
        });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured. Please add SAMEDAY_USERNAME and SAMEDAY_PASSWORD environment variables." });
      }

      // Get pickup points and services
      const [shippingContext, services] = await Promise.all([
        getRomanianSamedayShippingContext(samedayAPI),
        samedayAPI.getServices()
      ]);

      if (services.length === 0) {
        return res.status(500).json({ message: "No services configured for Sameday" });
      }

      const shippingAddr = order.shippingAddress as any;
      const billingAddr1 = order.billingAddress as any;
      const isB2B1 = !!(billingAddr1?.companyName);

      console.log('📦 Using configured pickup point:', {
        id: shippingContext.pickupPoint.id,
        name: shippingContext.pickupPoint.name,
        address: shippingContext.pickupPoint.address,
      });
      console.log('🚚 Available services:', services.length);
      console.log('🚚 First 3 services:', services.slice(0, 3).map(s => ({ id: s.id, name: s.name })));
      
      const selectedPickupPoint = shippingContext.pickupPoint;
      const selectedService = services.find(s => s.name.toLowerCase().includes('standard')) || services[0];
      
      console.log('📦 Selected pickup point:', { id: selectedPickupPoint.id, name: selectedPickupPoint.name });
      console.log('🚚 Selected service:', { id: selectedService.id, name: selectedService.name });

      // Calculate parcels based on product logistics data and pieces per package
      const parcels = [];
      let parcelCounter = 1;

      // Group order items by product and calculate required packages
      if (order.items && order.items.length > 0) {
        console.log('📦 Processing order items for intelligent package calculation:');
        
        for (const item of order.items) {
          const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
          if (!product) {
            console.log(`⚠️ Product not found for item ${item.productId}, using defaults`);
            continue;
          }

          const quantity = item.quantity;
          const piecesPerPackage = product.piecesPerPackage || 1;
          const weight = Number(product.weight) || 1;
          const length = Number(product.length) || 10;
          const width = Number(product.width) || 10;
          const height = Number(product.height) || 10;

          // Calculate number of packages needed for this product
          const packagesNeeded = Math.ceil(quantity / piecesPerPackage);
          
          console.log(`📦 Product: ${product.name}`);
          console.log(`   - Quantity ordered: ${quantity}`);
          console.log(`   - Pieces per package: ${piecesPerPackage}`);
          console.log(`   - Packages needed: ${packagesNeeded}`);
          console.log(`   - Weight per package: ${weight}kg`);
          console.log(`   - Dimensions: ${length}x${width}x${height}cm`);

          // Create parcels for this product
          for (let packageNum = 1; packageNum <= packagesNeeded; packageNum++) {
            const remainingQuantity = quantity - ((packageNum - 1) * piecesPerPackage);
            const itemsInThisPackage = Math.min(remainingQuantity, piecesPerPackage);
            const packageWeight = Math.max(1, Math.round(weight * (itemsInThisPackage / piecesPerPackage)));

            parcels.push({
              weight: packageWeight,
              length: length,
              width: width,
              height: height,
              awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P${parcelCounter}`,
            });

            console.log(`   📦 Package ${parcelCounter}: ${itemsInThisPackage} items, ${packageWeight}kg`);
            parcelCounter++;
          }
        }
      }

      // Fallback: if no parcels created, create one default parcel
      if (parcels.length === 0) {
        console.log('⚠️ No parcels calculated, using fallback single parcel');
        parcels.push({
          weight: 1,
          awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P1`,
        });
      }

      console.log(`📦 Total parcels to ship: ${parcels.length}`);
      console.log('📦 Parcel summary:', parcels.map(p => ({ number: p.awbParcelNumber, weight: `${p.weight}kg` })));

      // Get real counties and cities from Sameday API for proper ID mapping
      const [counties, cities] = await Promise.all([
        samedayAPI.getCounties(),
        samedayAPI.getCities()
      ]);

      console.log('📍 Total counties available:', counties.length);
      console.log('📍 First 3 counties:', counties.slice(0, 3).map(c => ({ id: c.id, name: c.name })));
      console.log('📍 Total cities available:', cities.length);
      console.log('📍 First 3 cities:', cities.slice(0, 3).map(c => ({ id: c.id, name: c.name })));

      // Find county and city IDs based on shipping address
      const targetCounty = (shippingAddr.county || shippingAddr.state || 'Cluj').toLowerCase();
      const targetCity = (shippingAddr.city || 'Feleacu').toLowerCase();
      
      const county = counties.find(c => 
        c.name.toLowerCase().includes(targetCounty) || targetCounty.includes(c.name.toLowerCase())
      ) || counties[0]; // Use first available county as fallback
      
      const city = cities.find(c => 
        c.name.toLowerCase().includes(targetCity) || targetCity.includes(c.name.toLowerCase())
      ) || cities[0]; // Use first available city as fallback
      
      console.log('🎯 Found county:', county ? { id: county.id, name: county.name } : 'None');
      console.log('🎯 Found city:', city ? { id: city.id, name: city.name } : 'None');

      const adminIsCOD = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod' || order.paymentMethod === 'cash';
      const adminTotalAmount = parseFloat(order.totalAmount.toString());

      const awbData = {
        pickupPoint: selectedPickupPoint.id,
        ...(shippingContext.contactPerson?.id ? { contactPerson: shippingContext.contactPerson.id } : {}),
        service: 7,
        packageType: 0,
        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
        awbPayment: 1,
        awbRecipient: {
          name: `${shippingAddr.firstName || ''} ${shippingAddr.lastName || ''}`.trim() || shippingAddr.companyName || (order as { customerName?: string }).customerName || 'Customer',
          phoneNumber: shippingAddr.phone || '+40700000000',
          personType: isB2B1 ? 1 : 0,
          ...(isB2B1 && { companyName: billingAddr1.companyName }),
          address: shippingAddr.address,
          countyString: shippingAddr.county || shippingAddr.state || '',
          cityString: shippingAddr.city || shippingAddr.county || shippingAddr.state || 'N/A',
          postalCode: shippingAddr.zipCode || '',
        },
        parcels: parcels,
        cashOnDelivery: adminIsCOD ? adminTotalAmount : 0,
        insuredValue: 0,
        observation: `Order #${order.id} - xHACCP E-commerce`,
        clientInternalReference: `ORDER_${order.id}`,
      };

      console.log(`🚚 Admin AWB for order #${order.id}: paymentMethod=${order.paymentMethod}, isCOD=${adminIsCOD}, cashOnDelivery=${adminIsCOD ? adminTotalAmount : 0}`);

      const awbResponse = await samedayAPI.createAWB(awbData);

      const updatedOrder = await storage.updateOrder(orderId, {
        status: 'shipped',
        awbNumber: awbResponse.awbNumber,
        awbCourier: 'sameday',
        awbCost: (awbResponse.cost ?? 0).toString(),
        awbCurrency: awbResponse.currency || 'RON',
        awbCreatedAt: new Date(),
      });

      console.log('✅ AWB generated successfully:', awbResponse.awbNumber);

      res.json({
        success: true,
        awbNumber: awbResponse.awbNumber,
        awbCost: awbResponse.cost,
        currency: awbResponse.currency,
        order: updatedOrder,
        trackingUrl: `https://sameday.ro/status-colet/?awb=${awbResponse.awbNumber}`,
      });

    } catch (error) {
      console.error("Generate AWB error:", error);
      res.status(500).json({ 
        message: "Failed to generate AWB", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get AWB PDF
  app.get("/api/orders/:id/awb-pdf", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order || !order.awbNumber) {
        return res.status(404).json({ message: "Order or AWB not found" });
      }

      if (order.awbCourier === "myflyingbox") {
        const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
        const myFlyingBoxAPI = createMyFlyingBoxAPI();
        if (!myFlyingBoxAPI) {
          return res.status(500).json({ message: "MyFlyingBox API not configured" });
        }
        const pdfBuffer = await myFlyingBoxAPI.getLabels(order.awbNumber);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="AWB_${order.awbNumber}.pdf"`);
        return res.send(pdfBuffer);
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured" });
      }

      const pdfBuffer = await samedayAPI.getAWBPDF(order.awbNumber);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="AWB_${order.awbNumber}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Get AWB PDF error:", error);
      res.status(500).json({ message: "Failed to get AWB PDF" });
    }
  });

  // Public French tracking is intentionally unauthenticated; the opaque order
  // reference and market/carrier checks are enforced by the route handler.
  registerPublicTrackingRoute(app, {
    getOrderByPublicOrderRef: (publicOrderRef) => storage.getOrderByPublicOrderRef(publicOrderRef),
    createTrackingClient: async () => {
      const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
      return createMyFlyingBoxAPI();
    },
  });

  app.get("/api/orders/:id/track-awb", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin
      if (order.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!order.awbNumber) {
        return res.status(404).json({ message: "AWB not found for this order" });
      }

      if (order.awbCourier === "myflyingbox") {
        const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
        const myFlyingBoxAPI = createMyFlyingBoxAPI();
        if (!myFlyingBoxAPI) {
          return res.status(500).json({ message: "MyFlyingBox API not configured" });
        }
        const trackingInfo = await myFlyingBoxAPI.getTracking(order.awbNumber);
        return res.json({
          awbNumber: order.awbNumber,
          trackingUrl: `/api/orders/${order.id}/track-awb`,
          trackingInfo,
        });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured" });
      }

      const trackingInfo = await samedayAPI.trackAWB(order.awbNumber);

      res.json({
        awbNumber: order.awbNumber,
        trackingUrl: `https://sameday.ro/status-colet/?awb=${order.awbNumber}`,
        trackingInfo,
      });

    } catch (error) {
      console.error("Track AWB error:", error);
      res.status(500).json({ message: "Failed to track AWB" });
    }
  });

  // AI description formatting — saved permanently in DB (Claude called once per product ever)
  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  app.get("/api/products/:id/description-ai", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) return res.status(400).json({ message: "Invalid product id" });

      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      // Return saved HTML from DB — Claude was already called for this product
      if ((product as any).descriptionHtml) {
        return res.json({ html: (product as any).descriptionHtml });
      }

      if (!product.description || !product.description.trim()) {
        return res.json({ html: "" });
      }

      const prompt = `You are an HTML formatter for a professional e-commerce product page.

Format the following product description as clean HTML. Follow these exact rules:
1. Wrap each distinct paragraph in <p> tags.
2. Detect the product name (provided below) — bold it using <strong> the FIRST time it appears in the text. Do NOT bold it every time.
3. Convert any enumeration, list of features, benefits, or properties into a <ul> with <li> items. Lines starting with -, -, bullet symbol, *, or that are clearly list items should become <li>.
4. If there is a "Product advantages:", "Features:", "Benefits:" or similar heading line, wrap it in <strong> tags inside a <p>.
5. Keep the HTML minimal — only use: <p>, <ul>, <li>, <strong>, <em>. NO divs, NO inline styles, NO classes.
6. Return ONLY the HTML — no explanation, no markdown, no code fences.

Product name: ${product.name}

Description:
${product.description}`;

      const message = await anthropicClient.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const html = (message.content[0] as any).text?.trim() || "";

      // Save to DB permanently — Claude won't be called again for this product
      await storage.saveProductDescriptionHtml(productId, html);

      res.json({ html });
    } catch (error) {
      console.error("AI description format error:", error);
      res.status(500).json({ message: "Failed to format description" });
    }
  });

  // Review routes
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ message: "Failed to get reviews" });
    }
  });

  app.post("/api/products/:id/reviews", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const productId = parseInt(req.params.id);
      const rating = Number(req.body?.rating);
      const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid product" });
      }
      if (!req.userId) {
        return res.status(401).json({ message: "Authentication required to leave a review" });
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
      }
      if (!comment) {
        return res.status(400).json({ message: "Review comment is required" });
      }

      const reviewData = insertReviewSchema.parse({
        productId,
        userId: req.userId,
        rating,
        comment,
      });
      const review = await storage.createReview(reviewData);
      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(400).json({ message: "Failed to create review" });
    }
  });

  // Admin routes
  app.get("/api/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { market } = req.query;
      const orders = await storage.getOrders();
      const filtered = (market && market !== 'all')
        ? orders.filter(o => (o.market || 'ro') === market)
        : orders;
      res.json(filtered);
    } catch (error) {
      console.error("Get admin orders error:", error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  // Consumer withdrawal notice. The timestamp and reference returned to the
  // customer are generated before email delivery so they match the submitted notice.
  app.post("/api/consumer-withdrawal", consumerWithdrawalLimiter, async (req, res) => {
    const market = getMarketFromRequest(req) as ContactMarket;
    const parsed = parseConsumerWithdrawalInput(req.body, market);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: market === "fr"
          ? "Veuillez vérifier les informations saisies."
          : market === "ro"
            ? "Vă rugăm să verificați datele introduse."
            : "Please check the information you entered.",
      });
    }

    const submittedAt = new Date();
    try {
      const companySettings = await storage.getCompanySettingsByMarket(market);
      const businessEmails = collectContactRecipients(companySettings);
      const emailResults = await sendContactFormEmails(parsed.data, {
        market,
        businessEmails,
        createdAt: submittedAt,
        suppressRecipientLogging: true,
      });

      if (!emailResults.toBusinessSent) {
        console.error("Consumer withdrawal notice could not be delivered to a market recipient", {
          market,
          configuredRecipients: businessEmails.length,
        });
        return res.status(503).json({
          success: false,
          message: market === "fr"
            ? "Votre déclaration n'a pas pu être enregistrée. Veuillez réessayer."
            : market === "ro"
              ? "Declarația nu a putut fi înregistrată. Vă rugăm să încercați din nou."
              : "Your notice could not be recorded. Please try again.",
        });
      }

      return res.json({
        success: true,
        noticeReceived: true,
        ticketId: emailResults.ticketId,
        submittedAt: emailResults.submittedAt,
        receiptSent: emailResults.toCustomerSent,
      });
    } catch {
      console.error("Consumer withdrawal handling failed", { market });
      return res.status(503).json({
        success: false,
        message: market === "fr"
          ? "Votre déclaration n'a pas pu être enregistrée. Veuillez réessayer."
          : market === "ro"
            ? "Declarația nu a putut fi înregistrată. Vă rugăm să încercați din nou."
            : "Your notice could not be recorded. Please try again.",
      });
    }
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, category, message, orderNumber } = req.body;
      const market = getMarketFromRequest(req) as ContactMarket;
      
      // Validate required fields
      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof subject !== "string" ||
        typeof message !== "string" ||
        typeof category !== "string" ||
        !name.trim() ||
        !email.trim() ||
        !subject.trim() ||
        !message.trim() ||
        !category.trim()
      ) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: name, email, subject, message, and category are required" 
        });
      }

      if (!isValidEmailAddress(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      const allowedCategories = new Set([
        "general",
        "product",
        "order",
        "technical",
        "billing",
        "partnership",
      ]);
      if (!allowedCategories.has(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contact category",
        });
      }

      const companySettings = await storage.getCompanySettingsByMarket(market);
      const businessEmails = collectContactRecipients(companySettings);

      // Do not log customer PII or configured recipient addresses.
      console.log("Contact form submission received", {
        market,
        category,
        hasOrderNumber: Boolean(orderNumber),
        configuredRecipients: businessEmails.length,
        timestamp: new Date().toISOString(),
      });

      const emailResults = await sendContactFormEmails({
        name: name.trim(),
        email: email.trim(),
        phone: typeof phone === "string" ? phone.trim() : undefined,
        subject: subject.trim(),
        category,
        message: message.trim(),
        orderNumber: typeof orderNumber === "string" ? orderNumber.trim() : undefined,
      }, {
        market,
        businessEmails,
      });

      console.log("Contact form email results:", emailResults);

      const successMessages: Record<ContactMarket, string> = {
        ro: "Vă mulțumim că ne-ați contactat! Am primit mesajul dumneavoastră și vă vom răspunde în cel mai scurt timp posibil.",
        fr: "Merci de nous avoir contactés ! Nous avons reçu votre message et nous vous répondrons dans les plus brefs délais.",
        com: "Thank you for contacting us! We received your message and will reply as soon as possible.",
      };
      const failureMessages: Record<ContactMarket, string> = {
        ro: "Mesajul nu a putut fi livrat. Vă rugăm să încercați din nou.",
        fr: "Votre message n'a pas pu être envoyé. Veuillez réessayer.",
        com: "Your message could not be delivered. Please try again.",
      };

      // A customer confirmation alone must never count as successful delivery.
      if (emailResults.toBusinessSent) {
        res.json({
          success: true,
          message: successMessages[market],
          ticketId: emailResults.ticketId,
          timestamp: new Date().toISOString(),
          emailsSent: {
            toBusinessSent: emailResults.toBusinessSent,
            toCustomerSent: emailResults.toCustomerSent,
            businessRecipientsAttempted: emailResults.businessRecipientsAttempted,
            businessRecipientsSent: emailResults.businessRecipientsSent,
            businessRecipientsFailed: emailResults.businessRecipientsFailed,
          },
        });
      } else {
        console.error("Contact form was not delivered to any configured market recipient", {
          market,
          configuredRecipients: businessEmails.length,
        });
        res.status(500).json({ 
          success: false, 
          message: failureMessages[market],
        });
      }
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ 
        success: false, 
        message: "A apărut o eroare la trimiterea mesajului. Vă rugăm să încercați din nou." 
      });
    }
  });

  // AI Assistant routes
  app.post("/api/ai/connect", async (req, res) => {
    try {
      // Simulate AI connection process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      res.json({ 
        success: true, 
        message: "Connected to AI Assistant",
        sessionId: `ai_session_${Date.now()}`,
        capabilities: [
          "Product recommendations",
          "Kitchen setup advice", 
          "HACCP compliance help",
          "Equipment comparisons",
          "Order status & invoices"
        ]
      });
    } catch (error) {
      console.error("AI connect error:", error);
      res.status(500).json({ message: "Failed to connect to AI Assistant" });
    }
  });

  app.post("/api/ai/chat", async (req: AuthRequest, res) => {
    try {
      const { message, sessionId, language } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Determine the current market (query param → X-Market header → hostname → 'ro')
      const market = getMarketFromRequest(req);
      const marketCurrency = marketSettingsMap.get(market)?.currency || 'EUR';

      // Get the complete active catalog for this market, with market-specific prices
      // and availability applied before it is sent to the model. Do not truncate
      // this list: products are sorted by priority in allProductsData, but every
      // active product must be available for recommendations.
      const products = getAIMarketCatalogForMarket(market);
      const productList = formatAIMarketCatalog(products, marketCurrency);
      const now = new Date();
      const [activeAIPromotion] = await db.select({
        market: aiRecommendationCampaigns.market,
        productIds: aiRecommendationCampaigns.productIds,
        startsAt: aiRecommendationCampaigns.startsAt,
        endsAt: aiRecommendationCampaigns.endsAt,
      })
        .from(aiRecommendationCampaigns)
        .where(and(
          eq(aiRecommendationCampaigns.market, market),
          sql`${aiRecommendationCampaigns.startsAt} <= ${now}`,
          sql`${aiRecommendationCampaigns.endsAt} > ${now}`,
        ))
        .orderBy(desc(aiRecommendationCampaigns.startsAt))
        .limit(1);
      const promotedProducts = getActiveAIPromotionProducts(
        products,
        activeAIPromotion,
        market,
        now,
      );
      const promotionContext = promotedProducts.length > 0
        ? `\n\nSCHEDULED AI RECOMMENDATIONS FOR THIS MARKET:\n${formatAIMarketCatalog(promotedProducts, marketCurrency)}\nWhen a customer asks for a relevant product recommendation, consider these campaign products first, in the order shown. Do not force them into unrelated answers. They are subject to the same availability, price, currency, and linking rules as the complete catalog.`
        : "";

      // Extract user ID from JWT token if present (optional authentication)
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SIGNING_SECRET) as any;
          userId = decoded.id ?? decoded.userId;
        } catch (error) {
          // Token is invalid or expired, continue without authentication
          console.log("Invalid or expired token, continuing as guest");
        }
      }

      // Check if user is authenticated for order-related queries
      let userContext = "";
      let userOrders: any[] = [];
      
      if (userId) {
        try {
          userOrders = await storage.getOrders(userId);
          userContext = `\n\nUser is logged in. Available user services:
- Order Status: User has ${userOrders.length} order(s) in their account
- Invoice Information: Can provide invoice details for completed orders
- Order History: Can show past purchases and order tracking

When user asks about orders, invoices, or order status, provide specific information from their order history.`;
        } catch (error) {
          console.error("Error fetching user orders:", error);
        }
      } else {
        userContext = `\n\nUser is not logged in. For order status and invoice information, they need to sign in to their account first.`;
      }

      // Language context for multilingual support
      const languageMap = {
        'en': 'English',
        'ro': 'Romanian',
        'es': 'Spanish',
        'fr': 'French', 
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic'
      };
      
      const userLanguage = (languageMap as any)[language] || 'English';
      const languageInstruction = language && language !== 'en' 
        ? `\n\nIMPORTANT: Respond in ${userLanguage} language. The user interface is in ${userLanguage}, so provide your response in the same language to ensure consistency.`
        : '';

      // Create system prompt with xHACCP context
      const systemPrompt = `You are an AI assistant for xHACCP, a professional kitchen equipment and supplies company. You help customers with:

1. Product recommendations from our catalog
2. Kitchen setup advice for commercial and home kitchens
3. HACCP compliance and food safety guidance
4. Equipment comparisons and technical specifications
5. Order status and invoice information (for signed-in users)

The customer is browsing the ${market.toUpperCase()} market site.

${promotionContext}

Our complete active product catalog for this market is below. Every listed product is available for recommendations, and the price/currency shown on its line is the current price for this market:
${productList}${userContext}

STRICT RULES about products and prices:
- Only recommend products from the complete catalog above; never invent products, prices, or availability.
- Only quote prices exactly as listed above, always with the currency shown next to each price. Never use "$" unless a product's listed currency is USD.
- Do not mention products or prices from other markets.

IMPORTANT: When recommending specific products from our catalog, always format them as clickable links using this exact format:
[Product Name](/products/product-slug)

For example: [Digital Food Thermometer](/products/digital-food-thermometer)

Always be helpful, professional, and focus on practical solutions. When recommending products, mention specific items from our catalog when relevant and provide direct links. Keep responses concise but informative.${languageInstruction}`;

      // Prepare user message with order context if relevant
      let enhancedMessage = message;
      
      // If user is asking about orders and is logged in, add order details
      if (userId && userOrders.length > 0 && (
        message.toLowerCase().includes('order') || 
        message.toLowerCase().includes('invoice') || 
        message.toLowerCase().includes('status') ||
        message.toLowerCase().includes('purchase')
      )) {
        const orderDetails = userOrders.map(order => {
          const orderCurrency = marketSettingsMap.get(order.market || 'ro')?.currency || 'RON';
          const orderTotal = order.totalAmount != null
            ? parseFloat(order.totalAmount)
            : order.items.reduce((sum: number, item: any) => sum + (parseFloat(item.product.price) * item.quantity), 0);
          return `Order #${order.id} - Status: ${order.status} - Total: ${orderTotal.toFixed(2)} ${orderCurrency} - Date: ${new Date(order.createdAt).toLocaleDateString()} - Items: ${order.items.length}`;
        }).join('\n');
        
        enhancedMessage = `${message}\n\nUser's Order History:\n${orderDetails}`;
      }

      if (!openai) {
        return res.json({
          response: "AI chat is currently unavailable. Please contact us directly for assistance with your kitchen equipment needs.",
          sessionId,
          timestamp: new Date().toISOString(),
          suggestedActions: []
        });
      }

      // Call OpenAI ChatGPT API with timeout and error handling
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: enhancedMessage }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout')), 30000)
        )
      ]);

      const response = (completion as any).choices[0].message.content || "I'm here to help with your kitchen equipment needs! How can I assist you today?";

      res.json({
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        suggestedActions: [
          "View recommended products",
          "Get compliance checklist",
          "Compare equipment options",
          "Schedule consultation"
        ]
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      
      // Provide specific error messages based on error type
      let errorMessage = "I'm temporarily unavailable. Please try again in a moment.";
      
      if (error.message?.includes('timeout')) {
        errorMessage = "The AI service is taking too long to respond. Please try again with a shorter question.";
      } else if (error.message?.includes('rate limit')) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error.message?.includes('API key')) {
        errorMessage = "AI service configuration issue. Please contact support.";
      }
      
      res.status(500).json({ 
        message: errorMessage,
        response: errorMessage
      });
    }
  });

  // ============ VIVA PAYMENTS INTEGRATION ============

  // Helper: Get Viva OAuth2 access token
  async function getVivaAccessToken(market: VivaMarket, requestId?: string): Promise<string> {
    const credentials = getVivaCredentials(market);
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    
    if (!clientId || !clientSecret) {
      throw new Error(`Viva ${market} OAuth credentials not configured`);
    }

    const response = await fetch("https://accounts.vivapayments.com/connect/token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "xHACCP-Viva-Integration/1.0",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    });

    if (!response.ok) {
      const errorText = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
      console.error(`[Viva ${requestId || "unknown"}] OAuth error:`, response.status, errorText);
      throw new Error(`Viva authentication failed: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  async function failVivaOrderOnlyIfProviderConfirms(
    order: { id: number; market: string | null; paymentMethod: string | null; paymentStatus: string; paymentProviderOrderId: string | null },
  ) {
    if (
      order.paymentStatus !== "pending" ||
      order.paymentMethod !== "viva" ||
      !order.paymentProviderOrderId
    ) {
      return null;
    }
    const market: VivaMarket = order.market === "fr" || order.market === "com" ? order.market : "ro";
    if (!await isVivaPaymentOrderNonPayable(order.paymentProviderOrderId, market, order.id)) {
      return null;
    }
    return storage.markOrderPaymentFailed(order.id);
  }

  // Create Viva payment order and return checkout URL
  app.post("/api/payments/viva/create-order", optionalAuth, async (req: AuthRequest, res) => {
    const requestId = crypto.randomUUID().slice(0, 12);
    const vivaMarket = getMarketFromRequest(req);
    let localVivaOrderId: number | null = null;
    let vivaOrderRequestStarted = false;

    try {
      const { currency, cartItems, voucherCode, orderData } = req.body;

      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }

      let subtotal = 0;
      console.log(`[Viva ${requestId}] create-order started: market=${vivaMarket}, items=${cartItems.length}, currency=${currency || "missing"}`);
      const serverCurrency = marketSettingsMap.get(vivaMarket)?.currency ?? getVivaCurrency(vivaMarket);
      if (currency && String(currency).toUpperCase() !== serverCurrency) {
        return res.status(400).json({ message: "Checkout currency does not match the current marketplace" });
      }

      // Each Viva source is configured for a specific merchant/currency setup.
      // The RO source cannot be reused for the FR EUR marketplace.
      const { apiKey, sourceCode, merchantId, clientId, clientSecret } = getVivaCredentials(vivaMarket);
      if (!apiKey || !sourceCode || !merchantId || !clientId || !clientSecret) {
        return res.status(503).json({
          message: vivaMarket === "fr"
            ? "Viva EUR payments are not configured for the French marketplace"
            : "Viva payment source not configured",
        });
      }

      const userId = req.userId ?? null;
      const authenticatedAccount = userId ? await storage.getUser(userId) : undefined;

      const validatedVivaItems: any[] = [];
      let subscriptionItemCount = 0;
      for (const item of cartItems) {
        const validatedItem = await validateOrderItemForMarket(item, vivaMarket);
        subtotal += Number(validatedItem.displayTotalPrice);
        validatedVivaItems.push(validatedItem);
        if (validatedItem.productType === "subscription") {
          subscriptionItemCount += validatedItem.quantity;
        }
      }
      const hasSubscription = subscriptionItemCount > 0;
      if (hasSubscription) {
        if (!userId) {
          return res.status(401).json({ message: "An account is required for subscription payments" });
        }
        if (subscriptionItemCount !== 1 || validatedVivaItems.some(item =>
          item.productType === "subscription" && item.quantity !== 1
        )) {
          return res.status(400).json({ message: "A subscription must be purchased as a single item" });
        }
        if (validatedVivaItems.some(item => item.productType !== "subscription")) {
          return res.status(400).json({ message: "Subscriptions cannot be combined with other products" });
        }
        if (orderData?.recurringConsent !== true) {
          return res.status(400).json({ message: "Recurring payment consent is required" });
        }
      }

      const companySettings = await storage.getCompanySettingsByMarket(vivaMarket);
      const market2 = vivaMarket;
      const marketSetting2 = marketSettingsMap.get(market2);
      const vatPercentage = Number(marketSetting2?.vatPercentage ?? 0);
      const freeShippingThreshold = marketSetting2?.freeShippingThreshold
        ? parseFloat(marketSetting2.freeShippingThreshold)
        : (companySettings?.freeShippingThreshold ? parseFloat(companySettings.freeShippingThreshold) : (vivaMarket === "ro" ? 1000 : 200));
      const standardShippingCost = marketSetting2?.standardShippingCost
        ? parseFloat(marketSetting2.standardShippingCost)
        : (companySettings?.standardShippingCost ? parseFloat(companySettings.standardShippingCost) : (vivaMarket === "ro" ? 35 : 12));
      const shippingCost = calculateShippingQuote(
        validatedVivaItems,
        freeShippingThreshold,
        standardShippingCost,
      ).shippingCost;

      let discountAmount = 0;
      let voucherOwnerUserId: number | null = null;
      if (voucherCode) {
        const vivaOrderMarket = getMarketFromRequest(req);
        const voucher = await storage.getVoucherByCode(voucherCode, vivaOrderMarket);
        if (voucher && voucher.isActive) {
          const orderEmail = String(orderData?.shippingAddress?.email
            || orderData?.billingAddress?.email
            || orderData?.email
            || "");
          const ownerError = authenticatedAccount
            ? getVoucherOwnershipError(voucher, authenticatedAccount.id, authenticatedAccount.email)
            : null;
          const orderEmailError = getVoucherOwnershipError(voucher, authenticatedAccount?.id, orderEmail);
          if (ownerError || orderEmailError) {
            return res.status(403).json({ message: ownerError || orderEmailError });
          }
          const now = new Date();
          const validFrom = voucher.validFrom ? new Date(voucher.validFrom) : null;
          const validUntil = voucher.validUntil ? new Date(voucher.validUntil) : null;
          const validityError = getVoucherValidityError(voucher, now);
          const maxUsesReached = voucher.maxUses && voucher.usedCount && voucher.usedCount >= voucher.maxUses;
          const minOrderMet = !voucher.minOrderAmount || subtotal >= parseFloat(voucher.minOrderAmount);
          
          if (!validityError && !maxUsesReached && minOrderMet &&
              (!validFrom || now >= validFrom) && 
              (!validUntil || now <= validUntil)) {
            if (voucher.discountType === 'percentage') {
              discountAmount = subtotal * (parseFloat(voucher.discountValue) / 100);
            } else {
              discountAmount = parseFloat(voucher.discountValue);
            }
            if (discountAmount > 0) voucherOwnerUserId = voucher.ownerUserId ?? null;
          }
        }
      }

      const taxSnapshot = calculateOrderTaxSnapshot(
        validatedVivaItems.map((item: any) => ({ ...item, totalPriceGross: item.totalPrice })),
        discountAmount,
        shippingCost,
        vatPercentage,
        defaultPriceDisplayMode(vivaMarket),
      );
      discountAmount = Number(taxSnapshot.discountAmount);
      const finalAmountCents = Math.round(Number(taxSnapshot.totalAmount) * 100);

      if (finalAmountCents < 30) {
        return res.status(400).json({ message: "Order total is too low" });
      }

      if (!orderData) {
        return res.status(400).json({ message: "Order data is required" });
      }

      // Validate Viva credentials before creating the local pending order.
      const accessToken = await getVivaAccessToken(vivaMarket, requestId);

      // Use server-validated items (with volume discounts applied) for order storage
      const orderItems = validatedVivaItems;

      let dbOrderId: number;
      try {
        let orderNotes = orderData.notes || '';
        if (voucherCode && discountAmount > 0) {
          orderNotes = `Voucher: ${voucherCode} (-${discountAmount.toFixed(2)})${orderNotes ? '\n' + orderNotes : ''}`;
        }

        const newOrder = await storage.createOrder({
          userId: getVoucherOrderUserId(
            voucherOwnerUserId != null ? { ownerUserId: voucherOwnerUserId } : null,
            userId,
          ),
          market: vivaMarket,
          currency: serverCurrency,
          status: 'pending',
          totalAmount: taxSnapshot.totalAmount,
          subtotalNet: taxSnapshot.subtotalNet,
          subtotalGross: taxSnapshot.subtotalGross,
          vatPercentage: moneyString(vatPercentage),
          vatAmount: taxSnapshot.vatAmount,
          shippingNetAmount: taxSnapshot.shippingNetAmount,
          shippingVatAmount: taxSnapshot.shippingVatAmount,
          shippingCost: taxSnapshot.shippingGrossAmount,
          voucherCode: voucherCode && discountAmount > 0 ? voucherCode : undefined,
          discountAmount: discountAmount > 0 ? taxSnapshot.discountAmount : undefined,
          discountNetAmount: discountAmount > 0 ? taxSnapshot.discountNetAmount : undefined,
          discountGrossAmount: discountAmount > 0 ? taxSnapshot.discountGrossAmount : undefined,
          shippingAddress: orderData.shippingAddress || {},
          billingAddress: orderData.billingAddress || {},
          paymentMethod: 'viva',
          paymentStatus: 'pending',
          notes: orderNotes || undefined,
        }, orderItems);

        dbOrderId = newOrder.id;
        localVivaOrderId = dbOrderId;
        console.log(`Created order ${dbOrderId} for Viva payment`);
      } catch (orderError) {
        if (orderError instanceof VoucherReservationConflictError) {
          return res.status(409).json({ message: orderError.message });
        }
        console.error("Error creating order for Viva payment:", orderError);
        return res.status(500).json({ message: "Failed to create order" });
      }

      const baseUrlByMarket: Record<string, string> = {
        ro: "https://www.xhaccp.ro",
        fr: "https://www.xhaccp.fr",
        com: "https://www.xhaccp.com",
      };
      const baseUrl = baseUrlByMarket[vivaMarket] || baseUrlByMarket.ro;

      const vivaOrderPayload: any = buildVivaCheckoutPayload({
        market: vivaMarket,
        amountCents: finalAmountCents,
        orderId: dbOrderId,
        baseUrl,
        hasSubscription,
      });

      if (orderData?.shippingAddress?.email) {
        const countryName = (orderData.shippingAddress.country || '').toLowerCase();
        const countryMap: Record<string, string> = {
          'romania': 'RO', 'ro': 'RO',
          'germany': 'DE', 'de': 'DE',
          'france': 'FR', 'fr': 'FR',
          'italy': 'IT', 'it': 'IT',
          'spain': 'ES', 'es': 'ES',
          'united kingdom': 'GB', 'uk': 'GB', 'gb': 'GB',
          'netherlands': 'NL', 'nl': 'NL',
          'belgium': 'BE', 'be': 'BE',
          'austria': 'AT', 'at': 'AT',
          'greece': 'GR', 'gr': 'GR',
          'portugal': 'PT', 'pt': 'PT',
          'poland': 'PL', 'pl': 'PL',
          'hungary': 'HU', 'hu': 'HU',
          'czech republic': 'CZ', 'czechia': 'CZ', 'cz': 'CZ',
          'bulgaria': 'BG', 'bg': 'BG',
          'croatia': 'HR', 'hr': 'HR',
          'sweden': 'SE', 'se': 'SE',
          'denmark': 'DK', 'dk': 'DK',
          'finland': 'FI', 'fi': 'FI',
          'ireland': 'IE', 'ie': 'IE',
          'cyprus': 'CY', 'cy': 'CY',
          'luxembourg': 'LU', 'lu': 'LU',
          'malta': 'MT', 'mt': 'MT',
          'slovakia': 'SK', 'sk': 'SK',
          'slovenia': 'SI', 'si': 'SI',
          'estonia': 'EE', 'ee': 'EE',
          'latvia': 'LV', 'lv': 'LV',
          'lithuania': 'LT', 'lt': 'LT',
          'moldova': 'MD', 'md': 'MD',
          'republic of moldova': 'MD',
        };
        const isoCode = countryMap[countryName] || (countryName.length === 2 ? countryName.toUpperCase() : 'RO');

        vivaOrderPayload.customer = {
          email: orderData.shippingAddress.email,
          fullName: `${orderData.shippingAddress.firstName || ''} ${orderData.shippingAddress.lastName || ''}`.trim(),
          phone: orderData.contactPhone || orderData.shippingAddress.phone || '',
          countryCode: isoCode,
          requestLang: vivaMarket === 'fr' ? 'fr-FR' : vivaMarket === 'com' ? 'en-US' : 'ro-RO',
        };
      }

      // Never log the full payload: it contains the market source code and
      // customer contact data. The summary is enough to troubleshoot routing.
      console.log(`[Viva ${requestId}] order payload prepared:`, JSON.stringify({
        market: vivaMarket,
        amountCents: finalAmountCents,
        currencyCode: vivaOrderPayload.currencyCode,
        sourceCodeConfigured: Boolean(vivaOrderPayload.sourceCode),
        hasCustomer: Boolean(vivaOrderPayload.customer),
        allowRecurring: hasSubscription,
        dbOrderId,
      }));

      // Create payment order via Viva API
      vivaOrderRequestStarted = true;
      const vivaResponse = await fetch("https://api.vivapayments.com/checkout/v2/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(vivaOrderPayload),
      });

      if (!vivaResponse.ok) {
        const errorText = (await vivaResponse.text()).replace(/\s+/g, " ").slice(0, 500);
        console.error(`[Viva ${requestId}] create order error:`, vivaResponse.status, errorText);
        if (vivaResponse.status >= 400 && vivaResponse.status < 500) {
          await storage.markOrderPaymentFailed(dbOrderId);
        }
        return res.status(502).json({
          message: vivaMarket === "fr"
            ? "Le service de paiement n’a pas pu préparer la commande. Réessayez dans quelques instants."
            : "The payment service could not prepare the order. Please try again shortly.",
          code: "VIVA_CREATE_ORDER_FAILED",
          requestId,
        });
      }

      const vivaOrder = await vivaResponse.json() as any;
      const orderCode = vivaOrder.orderCode;
      if (orderCode == null || !(await storage.bindPaymentProviderOrder(dbOrderId, String(orderCode)))) {
        return res.status(502).json({
          message: vivaMarket === "fr"
            ? "Le service de paiement n’a pas pu préparer la commande. Réessayez dans quelques instants."
            : "The payment service could not prepare the order. Please try again shortly.",
          code: "VIVA_CREATE_ORDER_FAILED",
          requestId,
        });
      }

      console.log(`Viva payment order created: ${orderCode} for DB order ${dbOrderId}`);

      const checkoutUrl = `https://www.vivapayments.com/web/checkout?ref=${orderCode}&color=0000ff`;

      res.json({
        orderCode,
        checkoutUrl,
        dbOrderId,
        serverCalculatedAmount: finalAmountCents / 100,
        currency: serverCurrency,
      });
    } catch (error) {
      console.error(`[Viva ${requestId}] Error creating payment order:`, error);
      if (localVivaOrderId != null && !vivaOrderRequestStarted) {
        await storage.markOrderPaymentFailed(localVivaOrderId).catch(markError => {
          console.error(`[Viva ${requestId}] Could not release failed checkout voucher reservation:`, markError);
        });
      }
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("Viva authentication failed: 403")) {
        return res.status(502).json({
          message: "Viva FR a respins autentificarea Production. Verifică Smart Checkout Client ID și Client Secret pentru contul FR.",
          code: "VIVA_AUTH_FAILED",
          requestId,
        });
      }
      if (/timeout|timed out|connect/i.test(errorMessage)) {
        return res.status(503).json({
          message: vivaMarket === "fr"
            ? "Le service est temporairement indisponible. Réessayez dans quelques instants."
            : "The payment service is temporarily unavailable. Please try again shortly.",
          code: "VIVA_TEMPORARILY_UNAVAILABLE",
          requestId,
        });
      }
      res.status(500).json({
        message: vivaMarket === "fr"
          ? "Impossible de préparer le paiement. Réessayez dans quelques instants."
          : "Failed to prepare the payment. Please try again shortly.",
        code: "VIVA_CREATE_ORDER_ERROR",
        requestId,
      });
    }
  });

  const awbGenerationInProgress = new Set<number>();

  const normalizeMyFlyingBoxCountry = (value: unknown, fallback = ""): string => {
    const raw = String(value || fallback).trim();
    if (!raw) return "";
    const aliases: Record<string, string> = {
      romania: "RO",
      france: "FR",
      "france métropolitaine": "FR",
      germany: "DE",
      deutschland: "DE",
      italy: "IT",
      spain: "ES",
      belgium: "BE",
      netherlands: "NL",
      portugal: "PT",
      austria: "AT",
      bulgaria: "BG",
    };
    return aliases[raw.toLowerCase()] || raw.toUpperCase();
  };

  const normalizeMyFlyingBoxPhone = (value: unknown, country: string): string => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/[^\d+]/g, "");
    if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\+/g, "")}`;
    if (country === "FR" && compact.startsWith("0")) return `+33${compact.slice(1)}`;
    if (country === "RO" && compact.startsWith("0")) return `+40${compact.slice(1)}`;
    return compact;
  };

  async function generateMyFlyingBoxAWBForOrder(order: any): Promise<{ awbNumber: string; cost: number; currency: string } | null> {
    const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
    const myFlyingBoxAPI = createMyFlyingBoxAPI();
    if (!myFlyingBoxAPI) {
      console.error(`AWB: MyFlyingBox is not configured for French order ${order.id}`);
      return null;
    }

    const shippingAddress = (order.shippingAddress || {}) as Record<string, any>;
    const billingAddress = (order.billingAddress || {}) as Record<string, any>;
    const [originAddress] = await db.select().from(wmsOriginAddresses)
      .where(eq(wmsOriginAddresses.market, "fr"))
      .limit(1);
    if (!originAddress) {
      throw new Error("MyFlyingBox origin address is not configured for the French logistics company");
    }

    const shipperCountry = normalizeMyFlyingBoxCountry(originAddress.country);
    const shipper = {
      name: originAddress.companyName,
      company: originAddress.companyName,
      street: originAddress.address,
      city: originAddress.city,
      state: originAddress.state,
      postal_code: originAddress.zipCode,
      phone: normalizeMyFlyingBoxPhone(originAddress.phone, shipperCountry),
      email: originAddress.email,
      country: shipperCountry,
    };

    const recipientCountry = normalizeMyFlyingBoxCountry(shippingAddress.country, "FR");
    const recipientCompany = String(
      shippingAddress.company || billingAddress.companyName || "",
    ).trim();
    const recipientName = `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim()
      || recipientCompany;
    const recipientState = String(shippingAddress.state || "").trim();
    const recipientPostalCode = String(shippingAddress.zipCode || "").trim();
    const recipientCity = String(shippingAddress.city || "").trim();
    const recipientPhone = normalizeMyFlyingBoxPhone(shippingAddress.phone || billingAddress.phone, recipientCountry);
    const recipientEmail = String(
      shippingAddress.email || billingAddress.email || "",
    ).trim();

    if (!shipper.name || !shipper.street || !shipper.city || !shipper.postal_code || !shipper.state || !shipper.phone || !shipper.email) {
      throw new Error("MyFlyingBox shipper address is incomplete; configure the warehouse address and département code");
    }
    if (!recipientName || !recipientState || !recipientPostalCode || !recipientCity || !recipientPhone || !recipientEmail) {
      throw new Error("MyFlyingBox recipient address is incomplete");
    }

    const parcels: Array<{ type: "package"; length: number; width: number; height: number; weight: number }> = [];
    let parcelCounter = 1;
    for (const item of order.items || []) {
      const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
      if (!product) continue;

      const quantity = Number(item.quantity) || 1;
      const piecesPerPackage = Number(product.piecesPerPackage) || 1;
      const packagesNeeded = Math.ceil(quantity / piecesPerPackage);
      const weight = Math.max(0.1, Number(product.weight) || 1);
      const length = Math.max(1, Math.round(Number(product.length) || 10));
      const width = Math.max(1, Math.round(Number(product.width) || 10));
      const height = Math.max(1, Math.round(Number(product.height) || 10));

      for (let packageNumber = 1; packageNumber <= packagesNeeded; packageNumber++) {
        const remainingQuantity = quantity - ((packageNumber - 1) * piecesPerPackage);
        const itemsInPackage = Math.min(remainingQuantity, piecesPerPackage);
        parcels.push({
          type: "package",
          length,
          width,
          height,
          weight: Math.max(0.1, Number((weight * (itemsInPackage / piecesPerPackage)).toFixed(3))),
        });
        parcelCounter++;
      }
    }

    if (parcels.length === 0) {
      parcels.push({ type: "package", length: 10, width: 10, height: 10, weight: 1 });
    }

    const quote = await myFlyingBoxAPI.createQuote({
      parcel_type: "package",
      shipper: {
        country: shipper.country,
        postal_code: String(shipper.postal_code),
        city: shipper.city,
      },
      recipient: {
        is_a_company: Boolean(recipientCompany),
        country: recipientCountry,
        postal_code: recipientPostalCode,
        city: recipientCity,
      },
      parcels,
    });
    const offer = myFlyingBoxAPI.selectOffer(quote.offers || []);

    const mfbOrder = await myFlyingBoxAPI.createOrder({
      offer_id: offer.id,
      ecommerce_order_platform: "xhaccp",
      ecommerce_order_identifier: String(order.id),
      ecommerce_order_reference: `ORDER_${order.id}`,
      shipper,
      recipient: {
        name: recipientName,
        ...(recipientCompany ? { company: recipientCompany } : {}),
        street: String(shippingAddress.address || "").trim(),
        city: recipientCity,
        state: recipientState,
        postal_code: recipientPostalCode,
        phone: recipientPhone,
        email: recipientEmail,
        country: recipientCountry,
        is_a_company: Boolean(recipientCompany),
      },
      parcels: parcels.map((_, index) => ({
        shipper_reference: `ORDER_${order.id}_P${index + 1}`,
        recipient_reference: `ORDER_${order.id}_P${index + 1}`,
        currency: "EUR",
        description: "Food safety and hygiene products",
        country_of_origin: shipper.country,
      })),
    });

    const awbNumber = mfbOrder.uuid || mfbOrder.id;
    if (!awbNumber) {
      throw new Error("MyFlyingBox order response did not include an order identifier");
    }

    const cost = offer.total_price?.amount ?? offer.price?.amount ?? 0;
    const currency = offer.total_price?.currency || offer.price?.currency || "EUR";
    await storage.updateOrder(order.id, {
      status: "shipped",
      awbNumber,
      awbCourier: "myflyingbox",
      awbTrackingUrl: buildPublicTrackingUrl(order.publicOrderRef),
      awbCost: String(cost),
      awbCurrency: currency,
      awbCreatedAt: new Date(),
    });

    console.log(`MyFlyingBox order created for order ${order.id}: courier=myflyingbox, parcels=${parcels.length}, currency=${currency}`);
    return { awbNumber, cost, currency };
  }

  async function generateAWBForOrder(orderId: number): Promise<{ awbNumber: string; cost: number; currency: string } | null> {
    if (awbGenerationInProgress.has(orderId)) {
      console.log(`AWB: Generation already in progress for order ${orderId}, skipping`);
      return null;
    }
    awbGenerationInProgress.add(orderId);

    try {
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`AWB: Order ${orderId} not found`);
        return null;
      }

      if (order.awbNumber) {
        console.log(`AWB: Order ${orderId} already has AWB ${order.awbNumber}, skipping`);
        return { awbNumber: order.awbNumber, cost: parseFloat(order.awbCost || '0'), currency: order.awbCurrency || 'RON' };
      }

      if ((order.market as string) === "fr") {
        return await generateMyFlyingBoxAWBForOrder(order);
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      if (!samedayAPI) {
        console.error('AWB: Sameday API not configured');
        return null;
      }

      const [shippingContext, services] = await Promise.all([
        getRomanianSamedayShippingContext(samedayAPI),
        samedayAPI.getServices()
      ]);

      if (services.length === 0) {
        console.error('AWB: No Sameday services available');
        return null;
      }

      const shippingAddr = order.shippingAddress as any;
      const billingAddr2 = order.billingAddress as any;
      const isB2B2 = !!(billingAddr2?.companyName);
      const selectedPickupPoint = shippingContext.pickupPoint;

      const parcels: any[] = [];
      let parcelCounter = 1;

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
          if (!product) continue;

          const quantity = item.quantity;
          const piecesPerPackage = product.piecesPerPackage || 1;
          const weight = Number(product.weight) || 1;
          const length = Number(product.length) || 10;
          const width = Number(product.width) || 10;
          const height = Number(product.height) || 10;
          const packagesNeeded = Math.ceil(quantity / piecesPerPackage);

          for (let packageNum = 1; packageNum <= packagesNeeded; packageNum++) {
            const remainingQuantity = quantity - ((packageNum - 1) * piecesPerPackage);
            const itemsInThisPackage = Math.min(remainingQuantity, piecesPerPackage);
            const packageWeight = Math.max(1, Math.round(weight * (itemsInThisPackage / piecesPerPackage)));

            parcels.push({
              weight: packageWeight,
              length, width, height,
              awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P${parcelCounter}`,
            });
            parcelCounter++;
          }
        }
      }

      if (parcels.length === 0) {
        parcels.push({
          weight: 1,
          awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P1`,
        });
      }

      const [counties, cities] = await Promise.all([
        samedayAPI.getCounties(),
        samedayAPI.getCities()
      ]);

      const targetCounty = (shippingAddr.county || shippingAddr.state || 'Cluj').toLowerCase();
      const targetCity = (shippingAddr.city || 'Feleacu').toLowerCase();

      const county = counties.find(c =>
        c.name.toLowerCase().includes(targetCounty) || targetCounty.includes(c.name.toLowerCase())
      ) || counties[0];

      const city = cities.find(c =>
        c.name.toLowerCase().includes(targetCity) || targetCity.includes(c.name.toLowerCase())
      ) || cities[0];

      const isCOD = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod' || order.paymentMethod === 'cash';
      const totalAmount = parseFloat(order.totalAmount.toString());

      const awbData = {
        pickupPoint: selectedPickupPoint.id,
        ...(shippingContext.contactPerson?.id ? { contactPerson: shippingContext.contactPerson.id } : {}),
        service: 7,
        packageType: 0,
        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
        awbPayment: 1,
        awbRecipient: {
          name: `${shippingAddr.firstName || ''} ${shippingAddr.lastName || ''}`.trim() || shippingAddr.companyName || (order as { customerName?: string }).customerName || 'Customer',
          phoneNumber: shippingAddr.phone || '+40700000000',
          personType: isB2B2 ? 1 : 0,
          ...(isB2B2 && { companyName: billingAddr2.companyName }),
          address: shippingAddr.address,
          countyString: shippingAddr.county || shippingAddr.state || '',
          cityString: shippingAddr.city || shippingAddr.county || shippingAddr.state || 'N/A',
          postalCode: shippingAddr.zipCode || '',
        },
        parcels,
        cashOnDelivery: isCOD ? totalAmount : 0,
        insuredValue: 0,
        observation: `Order #${order.id} - xHACCP E-commerce`,
        clientInternalReference: `ORDER_${order.id}`,
      };

      console.log(`🚚 AWB for order #${order.id}: paymentMethod=${order.paymentMethod}, isCOD=${isCOD}, cashOnDelivery=${isCOD ? totalAmount : 0}`);

      const awbResponse = await samedayAPI.createAWB(awbData);

      await storage.updateOrder(orderId, {
        status: 'shipped',
        awbNumber: awbResponse.awbNumber,
        awbCourier: 'sameday',
        awbCost: (awbResponse.cost ?? 0).toString(),
        awbCurrency: awbResponse.currency || 'RON',
        awbCreatedAt: new Date(),
      });

      console.log(`✅ AWB auto-generated for order ${orderId}: ${awbResponse.awbNumber}`);

      try {
        const updatedOrder = await storage.getOrder(orderId);
        if (updatedOrder) {
          let awbPdfBuffer: Buffer | undefined;
          try {
            awbPdfBuffer = await samedayAPI.getAWBPDF(awbResponse.awbNumber);
          } catch (pdfError) {
            console.error(`AWB PDF retrieval failed for ${awbResponse.awbNumber}:`, pdfError);
          }

          const { sendLogisticsAWBEmail } = await import('./email-service.js');
          await sendLogisticsAWBEmail(updatedOrder, awbResponse.awbNumber, awbPdfBuffer);
        }
      } catch (emailError) {
        console.error(`Failed to send logistics email for order ${orderId}:`, emailError);
      }

      return { awbNumber: awbResponse.awbNumber, cost: awbResponse.cost, currency: awbResponse.currency };
    } catch (error) {
      console.error(`AWB auto-generation failed for order ${orderId}:`, error);
      return null;
    } finally {
      awbGenerationInProgress.delete(orderId);
    }
  }

  // Direct PayPal checkout for ordinary French-market orders.
  app.post("/api/payments/paypal/create-order", paypalCreateOrderLimiter, optionalAuth, async (req: AuthRequest, res) => {
    const requestId = crypto.randomUUID().slice(0, 12);
    try {
      if (getMarketFromRequest(req) !== "fr") return res.status(400).json({ message: "PayPal is only available on the French marketplace" });
      const { cartItems, voucherCode, orderData } = req.body;
      if (!Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ message: "Cart items are required" });
      if (!orderData || typeof orderData !== "object") return res.status(400).json({ message: "Order data is required" });
      const shipping = orderData.shippingAddress;
      const billing = orderData.billingAddress;
      const email = shipping?.email || billing?.email;
      const required = [shipping?.firstName, shipping?.lastName, shipping?.address, shipping?.city, shipping?.state, shipping?.zipCode, shipping?.country, shipping?.phone, billing?.firstName, billing?.lastName, billing?.address, billing?.city, billing?.state, billing?.zipCode, billing?.country];
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || required.some(value => typeof value !== "string" || !value.trim())) {
        return res.status(400).json({ message: "Complete shipping, billing and email details are required" });
      }
      const account = req.userId ? await storage.getUser(req.userId) : undefined;
      if ((marketSettingsMap.get("fr")?.currency || "EUR").toUpperCase() !== "EUR") return res.status(503).json({ message: "French marketplace currency is not configured for EUR" });
      const validatedItems = await Promise.all(cartItems.map((item: any) => validateOrderItemForMarket(item, "fr")));
      if (validatedItems.some((item: any) => item.productType === "subscription")) {
        return res.status(400).json({ message: "Subscriptions require Viva recurring payment" });
      }
      const subtotal = validatedItems.reduce((sum: number, item: any) => sum + Number(item.displayTotalPrice), 0);
      const setting = marketSettingsMap.get("fr");
      const vatPercentage = Number(setting?.vatPercentage ?? 0);
      const company = await storage.getCompanySettingsByMarket("fr");
      const freeThreshold = setting?.freeShippingThreshold ? Number(setting.freeShippingThreshold) : Number(company?.freeShippingThreshold || 200);
      const shippingCost = calculateShippingQuote(
        validatedItems,
        freeThreshold,
        Number(setting?.standardShippingCost ?? company?.standardShippingCost ?? 12),
      ).shippingCost;
      let discountAmount = 0;
      let voucher: any = null;
      if (voucherCode) {
        voucher = await storage.getVoucherByCode(voucherCode, "fr");
        if (voucher) {
          const ownerError = account
            ? getVoucherOwnershipError(voucher, account.id, account.email)
            : null;
          const orderEmailError = getVoucherOwnershipError(voucher, account?.id, String(email));
          if (ownerError || orderEmailError) {
            return res.status(403).json({ message: ownerError || orderEmailError });
          }
        }
        if (voucher && voucher.isActive && !getVoucherValidityError(voucher, new Date()) &&
          (!voucher.maxUses || (voucher.usedCount || 0) < voucher.maxUses) &&
          (!voucher.minOrderAmount || subtotal >= Number(voucher.minOrderAmount))) {
          discountAmount = voucher.discountType === "percentage"
            ? subtotal * Number(voucher.discountValue) / 100
            : Number(voucher.discountValue);
        } else voucher = null;
      }
      const taxSnapshot = calculateOrderTaxSnapshot(
        validatedItems.map((item: any) => ({ ...item, totalPriceGross: item.totalPrice })),
        discountAmount,
        shippingCost,
        vatPercentage,
        defaultPriceDisplayMode("fr"),
      );
      discountAmount = Number(taxSnapshot.discountAmount);
      const total = Number(taxSnapshot.totalAmount);
      if (!Number.isFinite(total) || total < 0.01) return res.status(400).json({ message: "Order total is invalid" });
      const notes = `${orderData.notes || ""}${voucher ? `${orderData.notes ? "\n" : ""}Voucher: ${voucher.code} (-${discountAmount.toFixed(2)})` : ""}`;
      const localOrder = await storage.createOrder({
        userId: getVoucherOrderUserId(voucher, req.userId), market: "fr", currency: "EUR", status: "pending",
        totalAmount: total.toFixed(2), shippingCost: taxSnapshot.shippingGrossAmount,
        subtotalNet: taxSnapshot.subtotalNet,
        subtotalGross: taxSnapshot.subtotalGross,
        vatPercentage: moneyString(vatPercentage),
        vatAmount: taxSnapshot.vatAmount,
        shippingNetAmount: taxSnapshot.shippingNetAmount,
        shippingVatAmount: taxSnapshot.shippingVatAmount,
        voucherCode: voucher?.code, discountAmount: discountAmount ? taxSnapshot.discountAmount : undefined,
        discountNetAmount: discountAmount ? taxSnapshot.discountNetAmount : undefined,
        discountGrossAmount: discountAmount ? taxSnapshot.discountGrossAmount : undefined,
        shippingAddress: { ...(orderData.shippingAddress || {}), email }, billingAddress: orderData.billingAddress || {},
        paymentMethod: "paypal", paymentStatus: "pending", notes: notes || undefined,
      }, validatedItems);
      const baseUrl = "https://www.xhaccp.fr";
      let paypalOrder;
      try {
        paypalOrder = await createPayPalOrderWithRecovery({
          amount: total.toFixed(2), orderId: localOrder.id,
          returnUrl: `${baseUrl}/api/payments/paypal/callback`,
          cancelUrl: `${baseUrl}/api/payments/paypal/callback?cancel=1`,
          requestId: paypalCreateRequestId(localOrder.publicOrderRef || "", localOrder.id),
        });
      } catch (error) {
        console.error(`[PayPal ${requestId}] order creation failed:`, error instanceof Error ? error.message : "unknown error");
        if (error instanceof PayPalApiError && error.status >= 400 && error.status < 500 && error.status !== 408) {
          await storage.markOrderPaymentFailed(localOrder.id);
        }
        return res.status(502).json({ message: "PayPal payment could not be started" });
      }
      if (!isPayPalOrderForLocalOrder(paypalOrder, localOrder)) {
        console.error(`[PayPal ${requestId}] Created order did not match local order ${localOrder.id}`);
        return res.status(502).json({ message: "PayPal payment could not be started" });
      }
      const bound = await storage.bindPaymentProviderOrder(localOrder.id, paypalOrder.id);
      if (!bound) {
        const existing = await storage.getOrderByPaymentProviderOrderId(paypalOrder.id);
        if (!existing || existing.id !== localOrder.id) {
          // A binding conflict does not prove the remote checkout is terminal.
          // Keep the local voucher reservation until provider confirmation.
          return res.status(409).json({ message: "PayPal order is already linked" });
        }
      }
      const approvalUrl = paypalApprovalUrl(paypalOrder);
      if (!approvalUrl) {
        await expirePayPalOrderIfProviderConfirms(
          paypalOrder.id,
          requestId,
          { storage, getPayPalOrder },
        ).catch(error => {
          console.error(`[PayPal ${requestId}] Could not verify unapprovable order status:`, error instanceof Error ? error.message : "unknown error");
        });
        return res.status(502).json({ message: "PayPal returned no approval URL" });
      }
      return res.json({ approvalUrl, paypalOrderId: paypalOrder.id, dbOrderId: localOrder.id });
    } catch (error) {
      console.error(`[PayPal ${requestId}] create-order failed:`, error instanceof Error ? error.message : "unknown error");
      if (error instanceof VoucherReservationConflictError) {
        return res.status(409).json({ message: error.message });
      }
      return res.status(500).json({ message: "Unable to start PayPal payment" });
    }
  });

  const paypalReconciliationDependencies = {
    storage,
    getPayPalOrder,
    capturePayPalOrder,
    getInvoiceService: async () => {
      if (!invoiceService) invoiceService = await createInvoiceService();
      return invoiceService;
    },
    ensureFrenchOrderAwb: async (orderId: number) => {
      await generateAWBForOrder(orderId);
    },
    sendFrenchOrderConfirmationEmails: async (orderId: number) => {
      const result = await sendFrenchOrderConfirmationEmails(orderId);
      console.log(`FR order confirmation for PayPal order #${orderId}: customer=${result.customer}, company=${result.company}`);
    },
    sendFrenchOrderDocumentsEmail: async (orderId: number) => {
      await sendFrenchOrderDocumentsEmail(orderId);
    },
  };

  app.post("/api/payments/paypal/webhook", async (req, res) => {
    const requestId = crypto.randomUUID().slice(0, 12);
    await handlePayPalWebhook(req, res, {
      ...paypalReconciliationDependencies,
      verifyWebhook: undefined,
    }, requestId);
  });

  app.get("/api/payments/paypal/callback", async (req, res) => {
    const requestId = crypto.randomUUID().slice(0, 12);
    const failed = () => res.redirect("/merci?payment=failed");
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (req.query.cancel) {
        if (token) {
          await expirePayPalOrderIfProviderConfirms(token, requestId, paypalReconciliationDependencies);
        }
        return failed();
      }
      if (!token) return failed();
      const orderId = await reconcilePayPalPayment(token, requestId, paypalReconciliationDependencies);
      return orderId ? res.redirect(`/merci?payment=paypal&orderId=${orderId}`) : failed();
    } catch (error) {
      console.error(`[PayPal ${requestId}] callback failed:`, error instanceof Error ? error.message : "unknown error");
      return failed();
    }
  });

  // Viva payment success/failure callback
  app.get("/api/payments/viva/callback", async (req, res) => {
    const callbackMarket = getMarketFromRequest(req);
    const resultPath = callbackMarket === "fr" ? "/merci" : "/";
    try {
      const { s: transactionId, t: vivaOrderCode, lang } = req.query;
      
      console.log(`Viva callback received - transactionId: ${transactionId}, orderCode: ${vivaOrderCode}, lang: ${lang}`);
      console.log(`Viva callback full query params:`, JSON.stringify(req.query));

      if (transactionId) {
        res.redirect(`${resultPath}?payment=success`);

        (async () => {
          try {
            const accessToken = await getVivaAccessToken(callbackMarket);
            
            const txResponse = await fetch(`https://api.vivapayments.com/checkout/v2/transactions/${transactionId}`, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            });

            if (txResponse.ok) {
              const txData = await txResponse.json() as any;
              console.log(`Viva transaction data:`, JSON.stringify(txData));
              const merchantTrns = txData.merchantTrns || '';
              const orderIdMatch = merchantTrns.match(/order_(\d+)/);
              
              if (orderIdMatch) {
                const orderId = parseInt(orderIdMatch[1]);
                
                const claimedOrder = await storage.markOrderPaid(orderId, String(transactionId));
                if (!claimedOrder) {
                  console.log(`Viva callback: Order ${orderId} already processed (paid), skipping duplicate`);
                } else {

                console.log(`Viva payment verified and order ${orderId} updated to paid`);
                let paidOrder: any;
                try {
                  paidOrder = await storage.getOrder(orderId);
                  await activateSubscriptionForOrder(paidOrder, String(transactionId));
                } catch (subscriptionError) {
                  console.error(`Failed to activate subscription for Viva order ${orderId}:`, subscriptionError);
                }
                if (paidOrder?.market === "fr") {
                  try {
                    const result = await sendFrenchOrderConfirmationEmails(orderId);
                    console.log(`FR order confirmation for Viva order #${orderId}: customer=${result.customer}, company=${result.company}`);
                  } catch (emailError) {
                    console.error(`Failed to send FR order confirmation for Viva order #${orderId}:`, emailError);
                  }
                }

                let invoiceGenerated = false;
                let invoiceNumber: string | undefined;
                let invoiceId: number | undefined;

                try {
                  if (!invoiceService) {
                    invoiceService = await createInvoiceService();
                  }
                  
                  const invoice = await invoiceService.generateInvoiceAfterPayment(
                    orderId,
                    {
                      status: 'succeeded',
                      paymentMethod: 'viva',
                      paymentId: transactionId as string,
                      amount: txData.amount / 100,
                    }
                  );
                  console.log(`Invoice generated for Viva order ${orderId}:`, invoice.invoiceNumber);
                  invoiceGenerated = true;
                  invoiceNumber = invoice.invoiceNumber;
                  invoiceId = invoice.id;
                } catch (invoiceError) {
                  console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
                }

                let awbNumber: string | undefined;
                try {
                  const awbResult = await generateAWBForOrder(orderId);
                  if (awbResult) {
                    awbNumber = awbResult.awbNumber;
                  }
                } catch (awbError) {
                  console.error(`AWB auto-generation failed for order ${orderId}:`, awbError);
                }

                try {
                   const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');

                  const latestOrder = await storage.getOrder(orderId);
                  if (latestOrder) {
                    const orderMarket = (latestOrder.market as string) || 'ro';

                    let awbPdfBuffer: Buffer | undefined;
                    if (orderMarket === 'fr' && awbNumber) {
                      try {
                        const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
                        const myFlyingBoxAPI = createMyFlyingBoxAPI();
                        if (myFlyingBoxAPI) {
                          awbPdfBuffer = await myFlyingBoxAPI.getLabels(awbNumber);
                          console.log(`📄 MyFlyingBox labels retrieved for Viva order #${orderId}`);
                        }
                      } catch (pdfError) {
                        console.error(`❌ MyFlyingBox labels retrieval failed for Viva order #${orderId}:`, pdfError);
                      }
                    } else if (orderMarket !== 'fr' && awbNumber) {
                      try {
                        const { createSamedayAPI } = await import('./sameday-api');
                        const samedayAPI = createSamedayAPI();
                        if (samedayAPI) {
                          awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                          console.log(`📄 AWB PDF retrieved for Viva order #${orderId}`);
                        }
                      } catch (pdfError) {
                        console.error(`❌ AWB PDF retrieval failed for Viva order #${orderId}:`, pdfError);
                      }
                    } else if (orderMarket !== 'fr') {
                      console.log(`⚠️ No AWB generated for Viva order #${orderId}, emails will be sent without AWB`);
                    }

                    const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                    for (const item of latestOrder.items) {
                      const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
                      const supplierId = product?.supplierId || null;
                      let supplierInfo = supplierGroups.get(supplierId);

                      if (!supplierInfo) {
                        if (supplierId) {
                          const supplier = await storage.getSupplier(supplierId);
                          if (supplier && supplier.email) {
                            supplierInfo = {
                              supplierName: supplier.contactPerson || supplier.name,
                              supplierEmail: supplier.email,
                              items: [],
                            };
                          }
                        }
                        if (!supplierInfo) {
                          const companySettings = await storage.getCompanySettingsByMarket(orderMarket);
                          const fallbackEmail = companySettings?.logisticsEmail || companySettings?.email || '';
                          supplierInfo = {
                            supplierName: companySettings?.name || 'xHACCP',
                            supplierEmail: fallbackEmail,
                            items: [],
                          };
                        }
                        supplierGroups.set(supplierId, supplierInfo);
                      }

                      supplierInfo.items.push({
                        productName: item.product.name,
                        quantity: item.quantity,
                      });
                    }

                    for (const [, group] of supplierGroups) {
                      if (group.supplierEmail) {
                        try {
                          await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber || '', awbPdfBuffer);
                          console.log(`✅ Supplier email sent to ${group.supplierEmail} for Viva order #${orderId}`);
                        } catch (err) {
                          console.error(`❌ Failed to send supplier email for Viva order #${orderId}:`, err);
                        }
                      }
                    }

                    let invoicePdfBuffer: Buffer | null = null;
                    if (invoiceGenerated && invoiceId) {
                      try {
                        const { createInvoiceService } = await import('./invoice-service.js');
                        const invoiceSvc = await createInvoiceService();
                        invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                        console.log(`📄 Invoice PDF retrieved for Viva order #${orderId}`);
                      } catch (pdfError) {
                        console.error(`❌ Failed to retrieve invoice PDF for Viva order #${orderId}:`, pdfError);
                      }
                    }

                    const shippingAddr = latestOrder.shippingAddress as any;
                    const billingAddr = latestOrder.billingAddress as any;
                    let customerEmail = '';
                    if (latestOrder.userId) {
                      const user = await storage.getUser(latestOrder.userId);
                      if (user) customerEmail = user.email;
                    }
                    if (!customerEmail) {
                      customerEmail = shippingAddr?.email || billingAddr?.email || '';
                    }

                    if (customerEmail) {
                      try {
                         if (orderMarket === 'fr') {
                           const result = await sendFrenchOrderDocumentsEmail(orderId);
                           console.log(`FR customer documents email for Viva order #${orderId}: ${result}`);
                        } else if (orderMarket !== 'fr') {
                          await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber || '', invoicePdfBuffer, invoiceNumber);
                          console.log(`✅ Customer shipment email sent to ${customerEmail} for Viva order #${orderId}`);
                        }
                      } catch (err) {
                        console.error(`❌ Failed to send customer email for Viva order #${orderId}:`, err);
                      }
                    }
                  }
                } catch (emailError) {
                  console.error(`❌ Failed to send supplier/customer emails for Viva order #${orderId}:`, emailError);
                }
                }
              } else {
                console.error(`Viva callback: Could not extract orderId from merchantTrns: "${merchantTrns}"`);
              }
            } else {
              const errorText = await txResponse.text();
              console.error(`Viva transaction verification failed: ${txResponse.status}`, errorText);
            }
          } catch (verifyError) {
            console.error("Error in background Viva verification:", verifyError);
          }
        })();
      } else {
        console.log("Viva callback without transactionId - payment likely failed/cancelled");
        if (typeof vivaOrderCode === "string") {
          const order = await storage.getOrderByPaymentProviderOrderId(vivaOrderCode);
          if (order) await failVivaOrderOnlyIfProviderConfirms(order);
        }
        res.redirect(`${resultPath}?payment=failed`);
      }
    } catch (error) {
      console.error("Error processing Viva callback:", error);
      res.redirect(`${resultPath}?payment=error`);
    }
  });

  // Viva webhook for payment notifications
  app.post("/api/payments/viva/webhook", async (req, res) => {
    try {
      const event = req.body;
      console.log("Viva webhook received:", JSON.stringify(event).slice(0, 500));

      const eventTypeId = event.EventTypeId;
      const eventData = event.EventData;

      if (eventTypeId === 1796) {
        // Transaction Payment Created - payment successful
        const transactionId = eventData?.TransactionId;
        const merchantTrns = eventData?.MerchantTrns || '';
        const orderIdMatch = merchantTrns.match(/order_(\d+)/);

        if (orderIdMatch) {
          const orderId = parseInt(orderIdMatch[1]);
          console.log(`Viva webhook: Payment succeeded for order ${orderId}, transaction ${transactionId}`);

          const claimedOrder = await storage.markOrderPaid(
            orderId,
            transactionId == null ? undefined : String(transactionId),
          );
          if (!claimedOrder) {
            console.log(`Viva webhook: Order ${orderId} already processed (paid), skipping duplicate`);
          } else {
            let paidOrder: any;
            try {
              paidOrder = await storage.getOrder(orderId);
              await activateSubscriptionForOrder(paidOrder, String(transactionId));
            } catch (subscriptionError) {
              console.error(`Failed to activate subscription for webhook order ${orderId}:`, subscriptionError);
            }
            if (paidOrder?.market === "fr") {
              try {
                const result = await sendFrenchOrderConfirmationEmails(orderId);
                console.log(`FR order confirmation for Viva webhook order #${orderId}: customer=${result.customer}, company=${result.company}`);
              } catch (emailError) {
                console.error(`Failed to send FR order confirmation for Viva webhook order #${orderId}:`, emailError);
              }
            }
            (async () => {
              try {
                let invoiceGenerated = false;
                let invoiceNumber: string | undefined;
                let invoiceId: number | undefined;

                try {
                  if (!invoiceService) {
                    invoiceService = await createInvoiceService();
                  }

                  const invoice = await invoiceService.generateInvoiceAfterPayment(
                    orderId,
                    {
                      status: 'succeeded',
                      paymentMethod: 'viva',
                      paymentId: transactionId,
                      amount: (eventData?.Amount || 0) / 100,
                    }
                  );
                  console.log(`Invoice generated via webhook for order ${orderId}:`, invoice.invoiceNumber);
                  invoiceGenerated = true;
                  invoiceNumber = invoice.invoiceNumber;
                  invoiceId = invoice.id;
                } catch (invoiceError) {
                  console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
                }

                let awbNumber: string | undefined;
                try {
                  const awbResult = await generateAWBForOrder(orderId);
                  if (awbResult) {
                    awbNumber = awbResult.awbNumber;
                  }
                } catch (awbError) {
                  console.error(`AWB auto-generation via webhook failed for order ${orderId}:`, awbError);
                }

                try {
                   const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');

                  const latestOrder = await storage.getOrder(orderId);
                  if (latestOrder) {
                    const orderMarket = (latestOrder.market as string) || 'ro';

                    let awbPdfBuffer: Buffer | undefined;
                    if (orderMarket === 'fr' && awbNumber) {
                      try {
                        const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
                        const myFlyingBoxAPI = createMyFlyingBoxAPI();
                        if (myFlyingBoxAPI) {
                          awbPdfBuffer = await myFlyingBoxAPI.getLabels(awbNumber);
                        }
                      } catch (pdfError) {
                        console.error(`❌ MyFlyingBox labels retrieval failed for webhook order #${orderId}:`, pdfError);
                      }
                    } else if (orderMarket !== 'fr' && awbNumber) {
                      try {
                        const { createSamedayAPI } = await import('./sameday-api');
                        const samedayAPI = createSamedayAPI();
                        if (samedayAPI) {
                          awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                        }
                      } catch (pdfError) {
                        console.error(`❌ AWB PDF retrieval failed for webhook order #${orderId}:`, pdfError);
                      }
                    } else if (orderMarket !== 'fr') {
                      console.log(`⚠️ No AWB generated via webhook for order #${orderId}, emails will be sent without AWB`);
                    }

                    const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                    for (const item of latestOrder.items) {
                      const product = item.productId != null ? await storage.getProduct(item.productId) : undefined;
                      const supplierId = product?.supplierId || null;
                      let supplierInfo = supplierGroups.get(supplierId);

                      if (!supplierInfo) {
                        if (supplierId) {
                          const supplier = await storage.getSupplier(supplierId);
                          if (supplier && supplier.email) {
                            supplierInfo = {
                              supplierName: supplier.contactPerson || supplier.name,
                              supplierEmail: supplier.email,
                              items: [],
                            };
                          }
                        }
                        if (!supplierInfo) {
                          const companySettings = await storage.getCompanySettingsByMarket(orderMarket);
                          const fallbackEmail = companySettings?.logisticsEmail || companySettings?.email || '';
                          supplierInfo = {
                            supplierName: companySettings?.name || 'xHACCP',
                            supplierEmail: fallbackEmail,
                            items: [],
                          };
                        }
                        supplierGroups.set(supplierId, supplierInfo);
                      }

                      supplierInfo.items.push({
                        productName: item.product.name,
                        quantity: item.quantity,
                      });
                    }

                    for (const [, group] of supplierGroups) {
                      if (group.supplierEmail) {
                        try {
                          await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber || '', awbPdfBuffer);
                          console.log(`✅ Supplier email sent via webhook for order #${orderId}`);
                        } catch (err) {
                          console.error(`❌ Failed to send supplier email via webhook for order #${orderId}:`, err);
                        }
                      }
                    }

                    let invoicePdfBuffer: Buffer | null = null;
                    if (invoiceGenerated && invoiceId) {
                      try {
                        const { createInvoiceService } = await import('./invoice-service.js');
                        const invoiceSvc = await createInvoiceService();
                        invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                      } catch (pdfError) {
                        console.error(`❌ Failed to retrieve invoice PDF via webhook for order #${orderId}:`, pdfError);
                      }
                    }

                    const shippingAddr = latestOrder.shippingAddress as any;
                    const billingAddr = latestOrder.billingAddress as any;
                    let customerEmail = '';
                    if (latestOrder.userId) {
                      const user = await storage.getUser(latestOrder.userId);
                      if (user) customerEmail = user.email;
                    }
                    if (!customerEmail) {
                      customerEmail = shippingAddr?.email || billingAddr?.email || '';
                    }

                    if (customerEmail) {
                      try {
                         if (orderMarket === 'fr') {
                           const result = await sendFrenchOrderDocumentsEmail(orderId);
                           console.log(`FR customer documents email via webhook for order #${orderId}: ${result}`);
                        } else if (orderMarket !== 'fr') {
                          await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber || '', invoicePdfBuffer, invoiceNumber);
                          console.log(`✅ Customer shipment email sent via webhook for order #${orderId}`);
                        }
                      } catch (err) {
                        console.error(`❌ Failed to send customer email via webhook for order #${orderId}:`, err);
                      }
                    }

                    // KitOff integration: notify if order contains >= 4 label sets
                    try {
                      const { maybeNotifyKitoff } = await import('./kitoff-webhook.js');
                      const kitoffItems = latestOrder.items.map(item => ({
                        productName: item.product?.name || '',
                        quantity: item.quantity,
                      }));
                      await maybeNotifyKitoff(customerEmail, orderId, kitoffItems);
                    } catch (kitoffError) {
                      console.error(`[KitOff] Failed to notify for order #${orderId}:`, kitoffError);
                    }
                  }
                } catch (emailError) {
                  console.error(`❌ Failed to send emails via webhook for order #${orderId}:`, emailError);
                }
              } catch (error) {
                console.error(`❌ Webhook background processing failed for order #${orderId}:`, error);
              }
            })();
          }
        }
      } else if (eventTypeId === 1798) {
        // Transaction Failed
        const merchantTrns = eventData?.MerchantTrns || '';
        const orderIdMatch = merchantTrns.match(/order_(\d+)/);
        
        if (orderIdMatch) {
          const orderId = parseInt(orderIdMatch[1]);
          console.log(`Viva webhook: Payment failed for order ${orderId}`);
          const order = await storage.getOrder(orderId);
          if (order) await failVivaOrderOnlyIfProviderConfirms(order);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error processing Viva webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Viva webhook verification endpoint (GET - Viva sends verification key check)
  app.get("/api/payments/viva/webhook", async (req, res) => {
    try {
      const webhookMarket = getMarketFromRequest(req);
      const { merchantId, apiKey } = getVivaCredentials(webhookMarket);

      if (!merchantId || !apiKey) {
        return res.status(500).json({ message: `Viva ${webhookMarket} webhook credentials not configured` });
      }

      const verificationResponse = await fetch("https://www.vivapayments.com/api/messages/config/token", {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${merchantId}:${apiKey}`).toString("base64"),
        },
      });

      if (verificationResponse.ok) {
        const verificationData = await verificationResponse.json() as any;
        const key = verificationData.Key || verificationData;
        console.log("Viva webhook verification key retrieved:", key);
        res.json({ Key: key });
      } else {
        const errorText = await verificationResponse.text();
        console.error("Viva verification error:", verificationResponse.status, errorText);
        res.status(500).json({ error: "Verification failed" });
      }
    } catch (error) {
      console.error("Error getting Viva webhook verification:", error);
      res.status(500).send("Verification error");
    }
  });

  app.get("/api/shipping-settings", async (req, res) => {
    try {
      const market = getMarketFromRequest(req);
      const marketSetting = marketSettingsMap.get(market);
      const settings = await storage.getCompanySettingsByMarket(market);

      // Prefer per-market values from market_settings; fall back to company-wide defaults
      res.json({
        freeShippingThreshold: marketSetting?.freeShippingThreshold ?? settings?.freeShippingThreshold ?? "500.00",
        standardShippingCost: marketSetting?.standardShippingCost ?? settings?.standardShippingCost ?? "25.00",
        currency: marketSetting?.currency ?? settings?.defaultCurrency ?? "EUR",
        vatPercentage: marketSetting?.vatPercentage ?? settings?.defaultVatPercentage ?? (market === "ro" ? "21.00" : market === "fr" ? "20.00" : "21.00"),
      });
    } catch (error) {
      console.error("Error fetching shipping settings:", error);
      res.status(500).json({ message: "Failed to fetch shipping settings" });
    }
  });

  // Smartbill API Test endpoints
  app.get("/api/smartbill/test", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Initialize invoice service if needed
      if (!invoiceService) {
        invoiceService = await createInvoiceService();
      }
      
      const connected = await invoiceService.testConnection();
      res.json({ 
        connected,
        smartbillEnabled: process.env.ENABLE_SMARTBILL === 'true',
        hasCredentials: !!(process.env.SMARTBILL_USERNAME && process.env.SMARTBILL_TOKEN && process.env.SMARTBILL_COMPANY_VAT)
      });
    } catch (error) {
      console.error("Error testing Smartbill connection:", error);
      res.status(500).json({ message: "Failed to test connection", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/orders/:orderId/generate-invoice-smartbill", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'card' } = req.body;

      // Initialize invoice service if needed
      if (!invoiceService) {
        invoiceService = await createInvoiceService();
      }
      
      const invoice = await invoiceService.generateInvoiceAfterPayment(orderId, {
        status: 'succeeded',
        paymentMethod,
        paymentId: `manual_${Date.now()}`,
        amount: 0 // Will be calculated from order
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error generating test invoice:", error);
      res.status(500).json({ message: "Failed to generate invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // ─── Market Settings API (public read, no auth) ───────────────────────────
  // GET /api/markets — list all active markets
  app.get("/api/markets", async (_req, res) => {
    try {
      const markets = await storage.getMarketSettings();
      res.json(markets.filter(m => m.isActive));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch markets" });
    }
  });

  // GET /api/markets/:market — get settings for a specific market (used by frontend)
  app.get("/api/markets/:market", async (req, res) => {
    try {
      const ms = await storage.getMarketSetting(req.params.market);
      if (!ms || !ms.isActive) return res.status(404).json({ message: "Market not found" });
      res.json(ms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market" });
    }
  });

  // ─── Blog API ───────────────────────────────────────────────────────────────
  // Known-broken Unsplash photo URLs → working replacements
  // (Unsplash occasionally removes/unpublishes photos; add entries here as needed)
  const BROKEN_BLOG_IMAGES: Record<string, string> = {
    'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=1200&h=630&fit=crop&q=80':
      'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=1200&h=630&fit=crop&q=80',
  };
  function fixBlogImageUrl(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    return BROKEN_BLOG_IMAGES[url] ?? url;
  }
  function fixBlogPost<T extends { imageUrl?: string | null }>(post: T): T {
    return { ...post, imageUrl: fixBlogImageUrl(post.imageUrl) };
  }

  // Market → language mapping for blog posts
  function marketToLanguage(market: string): string {
    if (market === "fr") return "fr";
    if (market === "com") return "en";
    return "ro"; // default / 'ro' market
  }

  // Public: list published posts (filtered by market)
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const { limit, offset } = req.query;
      const market = getMarketFromRequest(req);
      const posts = await storage.getBlogPosts({
        published: true,
        marketCode: market,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(posts.map(fixBlogPost));
    } catch (error) {
      console.error("Get blog posts error:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  // Public: get single post by slug (market-scoped)
  app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
      const market = getMarketFromRequest(req);
      const post = await storage.getBlogPostBySlug(req.params.slug, market);
      if (!post || !post.published) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      // Enforce market segmentation: a post belongs to its market_code (NULL → 'ro')
      const postMarket = post.marketCode ?? 'ro';
      if (postMarket !== market) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      const translations = await storage.getBlogPostTranslations(post.id);
      res.json({ ...fixBlogPost(post), translations });
    } catch (error) {
      console.error("Get blog post error:", error);
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  // Public aliases: /api/blog and /api/blog/:slug (market-filtered, same logic as /api/blog/posts)
  app.get("/api/blog", async (req, res) => {
    try {
      const { limit, offset } = req.query;
      const market = getMarketFromRequest(req);
      const posts = await storage.getBlogPosts({
        published: true,
        marketCode: market,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(posts.map(fixBlogPost));
    } catch (error) {
      console.error("Get blog posts error:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const market = getMarketFromRequest(req);
      const post = await storage.getBlogPostBySlug(req.params.slug, market);
      if (!post || !post.published) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      const postMarket = post.marketCode ?? 'ro';
      if (postMarket !== market) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      const translations = await storage.getBlogPostTranslations(post.id);
      res.json({ ...fixBlogPost(post), translations });
    } catch (error) {
      console.error("Get blog post error:", error);
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  // Retired legacy Admin blog API. The protected /admin/api/blog/* family is
  // the only supported administration surface and enforces marketplace access.
  app.all("/api/admin/blog/*", (_req, res) => {
    res.status(410).json({
      message: "This Admin blog API was retired. Use /admin/api/blog/* instead.",
    });
  });

  // Unknown HTML routes are validated by the dev/production fallback AFTER
  // actual static resources have had a chance to be served.

  const httpServer = createServer(app);
  
  // Load all data into memory after server setup
  setTimeout(loadAllDataIntoMemory, 2000); // Wait 2 seconds for database to be ready
  
  return httpServer;
}
