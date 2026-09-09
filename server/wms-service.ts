import crypto from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import {
  fulfillmentPartners,
  marketFulfillment,
  marketSettings,
  orders,
  orderItems,
  products,
  productMarkets,
  productTranslations,
  categories,
  wmsApiKeys,
  wmsAuditLogs,
  wmsIdempotencyKeys,
  wmsInventory,
  wmsOrderEvents,
  wmsShipments,
  type Order,
} from "@shared/schema";
import { db } from "./db";
import { sendEmail, getSenderForMarket } from "./email-service.js";

export const WMS_MARKETS = ["ro", "fr", "com"] as const;
export const WMS_SCOPES = ["catalog:read", "orders:read", "orders:ack", "orders:events", "inventory:write"] as const;
export type WmsScope = (typeof WMS_SCOPES)[number];
export type WmsMarket = (typeof WMS_MARKETS)[number];

export type WmsRoutingRecord = {
  market: string;
  partnerId: number | null;
  isActive: boolean;
};

export type WmsRoutingDecision = WmsRoutingRecord & {
  decision: "active" | "inactive" | "unconfigured";
};

/**
 * Keep production onboarding honest: an absent row is different from an
 * intentional inactive route. This is pure so the admin API and contract
 * tests can use the same readiness rules without touching the database.
 */
export function summarizeWmsRouting(routes: WmsRoutingRecord[]): WmsRoutingDecision[] {
  return WMS_MARKETS.map((market) => {
    const route = routes.find((candidate) => candidate.market === market);
    if (!route) {
      return { market, partnerId: null, isActive: false, decision: "unconfigured" };
    }
    return {
      market,
      partnerId: route.partnerId,
      isActive: route.isActive,
      decision: route.isActive ? "active" : "inactive",
    };
  });
}

export type WmsAuthContext = {
  apiKeyId: number;
  partnerId: number;
  partnerCode: string;
  partnerName: string;
  environment: string;
  scopes: string[];
  markets: string[];
};

const fulfillmentRank: Record<string, number> = {
  unassigned: 0,
  ready: 10,
  acknowledged: 20,
  picking: 30,
  packed: 40,
  shipped: 50,
  delivered: 60,
  cancelled: 70,
  returned: 80,
  on_hold: 15,
};

export function hasScope(context: WmsAuthContext, scope: WmsScope): boolean {
  return context.scopes.includes(scope) || context.scopes.includes("*");
}

export function hashWmsApiKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createPlaintextWmsApiKey(environment: "sandbox" | "production"): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const prefix = environment === "sandbox" ? "wms_test_" : "wms_live_";
  const plaintext = `${prefix}${crypto.randomBytes(24).toString("base64url")}`;
  return { plaintext, prefix: plaintext.slice(0, 16), hash: hashWmsApiKey(plaintext) };
}

export async function authenticateWmsApiKey(rawKey: string): Promise<WmsAuthContext | null> {
  if (!rawKey || rawKey.length < 20) return null;
  const keyHash = hashWmsApiKey(rawKey);
  const [row] = await db
    .select({
      apiKeyId: wmsApiKeys.id,
      partnerId: fulfillmentPartners.id,
      partnerCode: fulfillmentPartners.code,
      partnerName: fulfillmentPartners.name,
      environment: wmsApiKeys.environment,
      scopes: wmsApiKeys.scopes,
    })
    .from(wmsApiKeys)
    .innerJoin(fulfillmentPartners, eq(wmsApiKeys.partnerId, fulfillmentPartners.id))
    .where(and(
      eq(wmsApiKeys.keyHash, keyHash),
      eq(wmsApiKeys.isRevoked, false),
      eq(fulfillmentPartners.isActive, true),
    ))
    .limit(1);
  if (!row) return null;
  const storedHash = Buffer.from(keyHash, "hex");
  const providedHash = Buffer.from(hashWmsApiKey(rawKey), "hex");
  if (storedHash.length !== providedHash.length || !crypto.timingSafeEqual(storedHash, providedHash)) return null;

  const routes = await db
    .select({ market: marketFulfillment.market })
    .from(marketFulfillment)
    .where(and(
      eq(marketFulfillment.partnerId, row.partnerId),
      eq(marketFulfillment.isActive, true),
    ));
  await db.update(wmsApiKeys).set({ lastUsedAt: new Date() }).where(eq(wmsApiKeys.id, row.apiKeyId));
  return { ...row, scopes: row.scopes || [], markets: routes.map(route => route.market) };
}

export function encodeWmsCursor(confirmedAt: Date, id: number): string {
  return Buffer.from(JSON.stringify({ confirmedAt: confirmedAt.toISOString(), id }), "utf8").toString("base64url");
}

export function decodeWmsCursor(value: string | undefined): { confirmedAt: Date; id: number } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const date = new Date(parsed.confirmedAt);
    if (!Number.isFinite(date.getTime()) || !Number.isInteger(parsed.id)) return null;
    return { confirmedAt: date, id: parsed.id };
  } catch {
    return null;
  }
}

export function encodeWmsCatalogCursor(updatedAt: Date, productId: number, market: string): string {
  return Buffer.from(JSON.stringify({
    updatedAt: updatedAt.toISOString(),
    productId,
    market,
  }), "utf8").toString("base64url");
}

export function decodeWmsCatalogCursor(value: string | undefined): {
  updatedAt: Date;
  productId: number;
  market: string;
} | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const updatedAt = new Date(parsed.updatedAt);
    if (
      !Number.isFinite(updatedAt.getTime())
      || !Number.isInteger(parsed.productId)
      || parsed.productId < 1
      || typeof parsed.market !== "string"
      || !WMS_MARKETS.includes(parsed.market as WmsMarket)
    ) return null;
    return { updatedAt, productId: parsed.productId, market: parsed.market };
  } catch {
    return null;
  }
}

export function isFulfillable(order: Pick<Order, "paymentStatus" | "paymentMethod" | "fulfillmentPartnerId" | "confirmedAt" | "fulfillmentStatus">): boolean {
  const paymentComplete = order.paymentStatus === "paid"
    || ["cash_on_delivery", "cod", "cash"].includes(String(order.paymentMethod).toLowerCase());
  return paymentComplete
    && Boolean(order.fulfillmentPartnerId)
    && Boolean(order.confirmedAt)
    && ["ready", "acknowledged", "picking", "packed", "shipped", "delivered"].includes(order.fulfillmentStatus);
}

export function normalizeEventStatus(eventType: string): string | null {
  const normalized = eventType.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    ack: "acknowledged",
    acknowledged: "acknowledged",
    picking: "picking",
    packed: "packed",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
    returned: "returned",
    on_hold: "on_hold",
  };
  return aliases[normalized] || null;
}

export function standardError(code: string, message: string, requestId: string, details?: unknown) {
  return { error: { code, message, request_id: requestId, ...(details === undefined ? {} : { details }) } };
}

export async function getWmsOrderForPartner(publicOrderRef: string, context: WmsAuthContext) {
  const [row] = await db
    .select({
      order: orders,
      item: orderItems,
      product: products,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(
      eq(orders.publicOrderRef, publicOrderRef),
      eq(orders.fulfillmentPartnerId, context.partnerId),
    ));
  if (!row || !isFulfillable(row.order)) return null;

  const rows = await db
    .select()
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, row.order.id));
  const shipments = await db.select().from(wmsShipments).where(and(
    eq(wmsShipments.orderId, row.order.id),
    eq(wmsShipments.partnerId, context.partnerId),
  ));
  const events = await db.select().from(wmsOrderEvents).where(and(
    eq(wmsOrderEvents.orderId, row.order.id),
    eq(wmsOrderEvents.partnerId, context.partnerId),
  )).orderBy(asc(wmsOrderEvents.occurredAt));

  return serializeWmsOrder(row.order, rows.map(item => ({
    ...item.order_items,
    product: item.products,
  })), shipments, events);
}

export async function listWmsOrders(params: {
  context: WmsAuthContext;
  market?: string;
  statuses?: string[];
  updatedSince?: Date;
  cursor?: string;
  limit: number;
}) {
  const { context } = params;
  const allowedMarkets = params.market ? [params.market] : context.markets;
  if (allowedMarkets.length === 0) return { orders: [], nextCursor: null };
  const cursor = decodeWmsCursor(params.cursor);
  if (params.cursor && !cursor) {
    const error = new Error("cursor is invalid");
    (error as any).code = "INVALID_CURSOR";
    throw error;
  }
  const conditions = [
    eq(orders.fulfillmentPartnerId, context.partnerId),
    inArray(orders.market, allowedMarkets),
    isNotNull(orders.confirmedAt),
    ne(orders.paymentStatus, "pending"),
    inArray(orders.fulfillmentStatus, ["ready", "acknowledged", "picking", "packed", "shipped", "delivered"]),
  ];
  if (params.statuses?.length) conditions.push(inArray(orders.fulfillmentStatus, params.statuses));
  if (params.updatedSince) conditions.push(gt(orders.updatedAt, params.updatedSince));
  if (cursor) {
    conditions.push(or(
      gt(orders.confirmedAt, cursor.confirmedAt),
      and(eq(orders.confirmedAt, cursor.confirmedAt), gt(orders.id, cursor.id)),
    )!);
  }

  const orderRows = await db.select().from(orders).where(and(...conditions))
    .orderBy(asc(orders.confirmedAt), asc(orders.id))
    .limit(params.limit + 1);
  const page = orderRows.slice(0, params.limit);
  const result = [];
  for (const order of page) {
    const items = await db.select().from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, order.id));
    const shipments = await db.select().from(wmsShipments).where(and(
      eq(wmsShipments.orderId, order.id),
      eq(wmsShipments.partnerId, context.partnerId),
    ));
    result.push(serializeWmsOrder(order, items.map(item => ({
      ...item.order_items,
      product: item.products,
    })), shipments, []));
  }
  const last = page[page.length - 1];
  return {
    orders: result,
    nextCursor: orderRows.length > params.limit && last?.confirmedAt ? encodeWmsCursor(last.confirmedAt, last.id) : null,
  };
}

function catalogLanguageForMarket(market: string): string {
  if (market === "fr") return "fr";
  if (market === "com") return "en";
  return "ro";
}

export function buildWmsCatalogDesignation(
  fallbackName: string,
  market: string,
  translations: Array<{ language: string; name: string | null | undefined }>,
): Record<string, string> {
  const designation: Record<string, string> = {};
  for (const translation of translations) {
    if (translation.language && translation.name?.trim()) {
      designation[translation.language] = translation.name.trim();
    }
  }
  const marketLanguage = catalogLanguageForMarket(market);
  if (!designation[marketLanguage] && fallbackName.trim()) {
    designation[marketLanguage] = fallbackName.trim();
  }
  return designation;
}

export function buildWmsCatalogIdentifiers(product: {
  id: number;
  slug: string;
  productCode: string | null;
  ncCode: string | null;
  cpvCode: string | null;
}): Record<string, string> {
  const identifiers: Record<string, string> = {
    xhaccp_product_id: `prod_${product.id}`,
    slug: product.slug,
  };
  if (product.productCode) identifiers.product_code = product.productCode;
  if (product.ncCode) identifiers.nc_code = product.ncCode;
  if (product.cpvCode) identifiers.cpv_code = product.cpvCode;
  return identifiers;
}

export async function listWmsCatalog(params: {
  context: WmsAuthContext;
  market?: string;
  updatedSince?: Date;
  cursor?: string;
  limit: number;
}) {
  const allowedMarkets = params.market ? [params.market] : params.context.markets;
  if (allowedMarkets.length === 0) return { products: [], nextCursor: null };

  const cursor = decodeWmsCatalogCursor(params.cursor);
  if (params.cursor && !cursor) {
    const error = new Error("cursor is invalid");
    (error as any).code = "INVALID_CURSOR";
    throw error;
  }

  const catalogUpdatedAt = sql<Date>`greatest(
    coalesce(${products.updatedAt}, ${products.createdAt}, to_timestamp(0)),
    coalesce(${productMarkets.updatedAt}, ${productMarkets.createdAt}, to_timestamp(0))
  )`;
  const conditions = [
    inArray(productMarkets.market, allowedMarkets),
    eq(productMarkets.isActive, true),
    eq(products.status, "active"),
    isNotNull(products.productCode),
  ];
  if (params.updatedSince) conditions.push(gt(catalogUpdatedAt, params.updatedSince));
  if (cursor) {
    conditions.push(or(
      gt(catalogUpdatedAt, cursor.updatedAt),
      and(
        eq(catalogUpdatedAt, cursor.updatedAt),
        or(
          gt(products.id, cursor.productId),
          and(eq(products.id, cursor.productId), gt(productMarkets.market, cursor.market)),
        ),
      ),
    )!);
  }

  const rows = await db.select({
    product: products,
    marketProduct: productMarkets,
    category: categories,
    updatedAt: catalogUpdatedAt,
  })
    .from(productMarkets)
    .innerJoin(products, eq(products.id, productMarkets.productId))
    .leftJoin(categories, eq(categories.id, productMarkets.categoryId))
    .where(and(...conditions))
    .orderBy(asc(catalogUpdatedAt), asc(products.id), asc(productMarkets.market))
    .limit(params.limit + 1);

  const page = rows.slice(0, params.limit);
  const productIds = [...new Set(page.map(row => row.product.id))];
  const translations = productIds.length
    ? await db.select().from(productTranslations).where(and(
      inArray(productTranslations.productId, productIds),
    ))
    : [];
  const translationsByProductId = new Map<number, typeof translations>();
  for (const translation of translations) {
    const current = translationsByProductId.get(translation.productId) || [];
    current.push(translation);
    translationsByProductId.set(translation.productId, current);
  }
  const settings = await db.select({
    market: marketSettings.market,
    currency: marketSettings.currency,
  }).from(marketSettings).where(inArray(marketSettings.market, allowedMarkets));
  const currencyByMarket = new Map(settings.map(setting => [setting.market, setting.currency]));

  const result = page.map(row => {
    const market = row.marketProduct.market;
    const productTranslationsForProduct = translationsByProductId.get(row.product.id) || [];
    const designation = buildWmsCatalogDesignation(
      row.product.name,
      market,
      productTranslationsForProduct,
    );
    const category = row.category?.marketCode === market
      ? {
          id: `cat_${row.category.id}`,
          name: row.category.name,
          slug: row.category.slug,
        }
      : null;
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
    return {
      id: `prod_${row.product.id}`,
      sku: row.product.productCode!,
      identifiers: buildWmsCatalogIdentifiers(row.product),
      designation,
      market,
      name: translation?.name || row.product.name,
      slug: translation?.slug || row.product.slug,
      description: translation?.description ?? row.product.description ?? null,
      category,
      price: row.marketProduct.price ?? row.product.price,
      compare_at_price: row.marketProduct.compareAtPrice ?? row.product.compareAtPrice ?? null,
      currency: row.marketProduct.currency ?? currencyByMarket.get(market) ?? row.product.currency,
      vat_percentage: row.product.vatPercentage,
      product_type: row.product.productType,
      is_service: Boolean(row.product.isService || row.product.productType === "service"),
      is_composite: Boolean(row.product.isComposite),
      availability: {
        in_stock: row.marketProduct.inStock ?? row.product.inStock ?? false,
        stock_quantity: row.marketProduct.stockQuantity ?? row.product.stockQuantity ?? 0,
      },
      logistics: {
        weight: row.product.weight,
        length: row.product.length,
        width: row.product.width,
        height: row.product.height,
        pieces_per_package: row.product.piecesPerPackage,
        product_quantity: row.product.productQuantity,
      },
      specs: row.product.specs || [],
      updated_at: updatedAt.toISOString(),
    };
  });
  const last = page[page.length - 1];
  const nextCursor = rows.length > params.limit && last
    ? encodeWmsCatalogCursor(
        last.updatedAt instanceof Date ? last.updatedAt : new Date(last.updatedAt),
        last.product.id,
        last.marketProduct.market,
      )
    : null;
  return { products: result, nextCursor };
}

function serializeWmsOrder(order: Order, items: any[], shipments: any[], events: any[]) {
  return {
    id: order.publicOrderRef,
    market: order.market,
    currency: order.currency,
    status: order.status,
    fulfillment_status: order.fulfillmentStatus,
    confirmed_at: order.confirmedAt?.toISOString() || null,
    updated_at: order.updatedAt?.toISOString() || null,
    totals: {
      total: order.totalAmount,
      shipping: order.shippingCost || "0.00",
    },
    payment: { method: order.paymentMethod, status: order.paymentStatus },
    customer: {
      email: (order.shippingAddress as any)?.email || (order.billingAddress as any)?.email || null,
      first_name: (order.shippingAddress as any)?.firstName || null,
      last_name: (order.shippingAddress as any)?.lastName || null,
      phone: (order.shippingAddress as any)?.phone || null,
    },
    shipping_address: order.shippingAddress,
    billing_address: order.billingAddress,
    notes: order.notes,
    items: items.map(item => ({
      sku: item.product?.productCode || null,
      name: item.product?.name || null,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.totalPrice,
      weight: item.product?.weight || null,
      configuration: item.compositeConfiguration || null,
    })),
    shipments: shipments.map(shipment => ({
      parcel_id: shipment.parcelId,
      tracking_number: shipment.trackingNumber,
      carrier: shipment.carrier,
      status: shipment.status,
      updated_at: shipment.updatedAt?.toISOString() || null,
    })),
    events: events.map(event => ({
      event_id: event.eventId,
      type: event.eventType,
      status: event.status,
      occurred_at: event.occurredAt.toISOString(),
    })),
  };
}

export async function getIdempotencyRecord(context: WmsAuthContext, key: string, requestHash: string) {
  const [record] = await db.select().from(wmsIdempotencyKeys).where(and(
    eq(wmsIdempotencyKeys.partnerId, context.partnerId),
    eq(wmsIdempotencyKeys.idempotencyKey, key),
  ));
  if (!record) return null;
  if (record.requestHash !== requestHash) {
    const error = new Error("idempotency key was already used with a different request body");
    (error as any).statusCode = 409;
    (error as any).code = "IDEMPOTENCY_KEY_REUSED";
    throw error;
  }
  return record.responseStatus && record.responseBody ? record : null;
}

export async function reserveIdempotency(context: WmsAuthContext, key: string, requestHash: string) {
  const [created] = await db.insert(wmsIdempotencyKeys).values({
    partnerId: context.partnerId,
    idempotencyKey: key,
    requestHash,
  }).onConflictDoNothing().returning();
  if (created) return { state: "new" as const };
  const [record] = await db.select().from(wmsIdempotencyKeys).where(and(
    eq(wmsIdempotencyKeys.partnerId, context.partnerId),
    eq(wmsIdempotencyKeys.idempotencyKey, key),
  ));
  if (!record) return { state: "new" as const };
  if (record.requestHash !== requestHash) {
    const error = new Error("idempotency key was already used with a different request body");
    (error as any).statusCode = 409;
    (error as any).code = "IDEMPOTENCY_KEY_REUSED";
    throw error;
  }
  if (record.responseStatus && record.responseBody) return { state: "replay" as const, record };
  return { state: "in_progress" as const };
}

export async function rememberIdempotency(context: WmsAuthContext, key: string, requestHash: string, status: number, body: unknown) {
  await db.update(wmsIdempotencyKeys).set({
    responseStatus: status,
    responseBody: body,
  }).where(and(
    eq(wmsIdempotencyKeys.partnerId, context.partnerId),
    eq(wmsIdempotencyKeys.idempotencyKey, key),
    eq(wmsIdempotencyKeys.requestHash, requestHash),
  ));
}

export async function acknowledgeWmsOrder(publicOrderRef: string, context: WmsAuthContext, payload: any) {
  const [order] = await db.select().from(orders).where(and(
    eq(orders.publicOrderRef, publicOrderRef),
    eq(orders.fulfillmentPartnerId, context.partnerId),
  ));
  if (!order || !isFulfillable(order)) return null;
  const status = fulfillmentRank[order.fulfillmentStatus] >= fulfillmentRank.acknowledged
    ? order.fulfillmentStatus
    : "acknowledged";
  await db.update(orders).set({ fulfillmentStatus: status, updatedAt: new Date() })
    .where(eq(orders.id, order.id));
  return { id: order.publicOrderRef, fulfillment_status: status, acknowledged_at: new Date().toISOString(), metadata: payload?.metadata || null };
}

export async function recordWmsEvent(publicOrderRef: string, context: WmsAuthContext, payload: any) {
  const eventId = String(payload?.event_id || "");
  const status = normalizeEventStatus(String(payload?.event_type || payload?.status || ""));
  if (!eventId || !status) return { kind: "invalid" as const };
  const [order] = await db.select().from(orders).where(and(
    eq(orders.publicOrderRef, publicOrderRef),
    eq(orders.fulfillmentPartnerId, context.partnerId),
  ));
  if (!order || !isFulfillable(order)) return { kind: "not_found" as const };

  const occurredAt = payload.occurred_at ? new Date(payload.occurred_at) : new Date();
  if (!Number.isFinite(occurredAt.getTime())) return { kind: "invalid" as const };
  const [existingEvent] = await db.select().from(wmsOrderEvents).where(and(
    eq(wmsOrderEvents.partnerId, context.partnerId),
    eq(wmsOrderEvents.eventId, eventId),
  ));
  if (existingEvent) return { kind: "duplicate" as const, event: existingEvent };

  await db.insert(wmsOrderEvents).values({
    orderId: order.id,
    partnerId: context.partnerId,
    eventId,
    eventType: String(payload.event_type || status),
    status,
    occurredAt,
    payload,
  });
  const shouldAdvance = fulfillmentRank[status] > fulfillmentRank[order.fulfillmentStatus];
  if (shouldAdvance) {
    await db.update(orders).set({
      fulfillmentStatus: status,
      status: status === "shipped" ? "shipped" : status === "delivered" ? "delivered" : order.status,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
  }

  const parcels = Array.isArray(payload.shipments) ? payload.shipments : [];
  for (const parcel of parcels) {
    if (!parcel?.parcel_id) continue;
    await db.insert(wmsShipments).values({
      orderId: order.id,
      partnerId: context.partnerId,
      parcelId: String(parcel.parcel_id),
      trackingNumber: parcel.tracking_number ? String(parcel.tracking_number) : null,
      carrier: parcel.carrier ? String(parcel.carrier) : null,
      status,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [wmsShipments.orderId, wmsShipments.parcelId],
      set: {
        trackingNumber: parcel.tracking_number ? String(parcel.tracking_number) : null,
        carrier: parcel.carrier ? String(parcel.carrier) : null,
        status,
        updatedAt: new Date(),
      },
    });
  }

  if (status === "shipped") {
    queueShipmentEmail(order, parcels).catch(error => console.error("[WMS] shipment email failed", error));
  }
  return { kind: "created" as const, status, event_id: eventId };
}

async function queueShipmentEmail(order: Order, parcels: any[]) {
  const address = order.shippingAddress as any;
  const email = address?.email || (order.billingAddress as any)?.email;
  if (!email) return;
  const tracking = parcels.map(parcel => parcel?.tracking_number).filter(Boolean).join(", ");
  await sendEmail({
    to: email,
    from: getSenderForMarket(order.market || "ro"),
    subject: `Shipment update for order ${order.publicOrderRef}`,
    text: `Your order ${order.publicOrderRef} has shipped.${tracking ? ` Tracking: ${tracking}` : ""}`,
    html: `<p>Your order <strong>${order.publicOrderRef}</strong> has shipped.</p>${tracking ? `<p>Tracking: ${tracking}</p>` : ""}`,
  });
}

export async function updateInventory(context: WmsAuthContext, entries: any[]) {
  const skuValues = entries.map(entry => String(entry?.sku || "")).filter(Boolean);
  const known = skuValues.length
    ? await db.select({ sku: products.productCode }).from(products).where(inArray(products.productCode, skuValues))
    : [];
  const knownSkus = new Set(known.map(row => row.sku).filter(Boolean));
  const unknownSkus = [...new Set(skuValues.filter(sku => !knownSkus.has(sku)))];
  const accepted: string[] = [];
  const ignored: string[] = [];
  for (const entry of entries) {
    const sku = String(entry?.sku || "");
    const sourceUpdatedAt = new Date(entry?.updated_at || entry?.source_updated_at || "");
    if (!sku || !knownSkus.has(sku) || !Number.isFinite(sourceUpdatedAt.getTime())) continue;
    const quantity = Number(entry.quantity);
    const availableQuantity = Number(entry.available_quantity ?? entry.available ?? entry.quantity);
    if (!Number.isInteger(quantity) || !Number.isInteger(availableQuantity) || quantity < 0 || availableQuantity < 0) continue;
    const [current] = await db.select().from(wmsInventory).where(and(
      eq(wmsInventory.partnerId, context.partnerId),
      eq(wmsInventory.sku, sku),
    ));
    if (current && current.sourceUpdatedAt >= sourceUpdatedAt) {
      ignored.push(sku);
      continue;
    }
    await db.insert(wmsInventory).values({
      partnerId: context.partnerId,
      sku,
      quantity,
      availableQuantity,
      sourceUpdatedAt,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [wmsInventory.partnerId, wmsInventory.sku],
      set: { quantity, availableQuantity, sourceUpdatedAt, updatedAt: new Date() },
    });
    accepted.push(sku);
  }
  return { accepted_skus: [...new Set(accepted)], ignored_stale_skus: [...new Set(ignored)], unknown_skus: unknownSkus };
}

export async function writeWmsAuditLog(context: WmsAuthContext | null, request: {
  requestId: string; method: string; path: string; statusCode: number;
}) {
  await db.insert(wmsAuditLogs).values({
    partnerId: context?.partnerId ?? null,
    apiKeyId: context?.apiKeyId ?? null,
    requestId: request.requestId,
    method: request.method,
    path: request.path,
    statusCode: request.statusCode,
  });
}

export function requestBodyHash(body: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}