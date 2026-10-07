import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, varchar, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  passwordSetupRequired: boolean("password_setup_required").notNull().default(false),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  isAdmin: boolean("is_admin").default(false),
  adminMarkets: text("admin_markets").array().default([]),
  isSuspended: boolean("is_suspended").notNull().default(false),
  // 2FA fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorBackupCodes: jsonb("two_factor_backup_codes").default([]),
  // Invoice details fields
  companyName: varchar("company_name", { length: 255 }),
  vatNumber: varchar("vat_number", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  taxId: varchar("tax_id", { length: 50 }),
  companyAddress: text("company_address"),
  companyCity: varchar("company_city", { length: 100 }),
  companyState: varchar("company_state", { length: 100 }), // Județ for Romania
  companyCounty: varchar("company_county", { length: 100 }), // Added for Romanian Județ
  companyZip: varchar("company_zip", { length: 20 }),
  companyCountry: varchar("company_country", { length: 100 }),
  billingEmail: varchar("billing_email", { length: 255 }),
  billingPhone: varchar("billing_phone", { length: 30 }),
  // Delivery address (if different from company address)
  deliveryAddress: text("delivery_address"),
  deliveryCity: varchar("delivery_city", { length: 100 }),
  deliveryState: varchar("delivery_state", { length: 100 }), // Județ for Romania
  deliveryCounty: varchar("delivery_county", { length: 100 }), // Added for Romanian Județ
  deliveryZip: varchar("delivery_zip", { length: 20 }),
  deliveryCountry: varchar("delivery_country", { length: 100 }),
  deliveryInstructions: text("delivery_instructions"),
  // Notification preferences
  emailNotifications: boolean("email_notifications").default(true),
  orderUpdates: boolean("order_updates").default(true),
  productRestocks: boolean("product_restocks").default(false),
  priceDrops: boolean("price_drops").default(false),
  promotions: boolean("promotions").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(), // unique per market — see unique constraint below
  description: text("description"),
  imageUrl: text("image_url"),
  // Homepage positioning fields
  showOnMainTop: boolean("show_on_main_top").default(false),
  showOnMainShop: boolean("show_on_main_shop").default(false),
  sortOrder: integer("sort_order").default(0),
  marketCode: varchar("market_code", { length: 10 }).default("ro").notNull(), // ro, fr, com
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  slugMarketUnique: uniqueIndex("categories_slug_market_unique").on(t.slug, t.marketCode),
}));

export type CompositeSelectionItem = {
  componentProductId: number;
  quantity: number;
  name?: string;
  productCode?: string | null;
  unitPrice?: string;
  totalPrice?: string;
};

export type CompositeConfiguration = {
  components: CompositeSelectionItem[];
  currency?: string;
  totalPrice?: string;
  totalPriceNet?: string;
  totalPriceGross?: string;
  priceDisplayMode?: "net" | "gross";
  vatPercentage?: string;
};

export type ProductType = "standard" | "service" | "subscription";

// Products table
export type ProductCertification = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
};

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  imageUrl: text("image_url"),
  images: jsonb("images").default([]),
  inStock: boolean("in_stock").default(true),
  stockQuantity: integer("stock_quantity").default(0),
  featured: boolean("featured").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  vatValue: decimal("vat_value", { precision: 5, scale: 2 }).default("0"),
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }).default("19.00"), // VAT % for each product
  currency: varchar("currency", { length: 3 }).default("EUR"), // Currency for each product
  productCode: varchar("product_code", { length: 50 }),
  ean: varchar("ean", { length: 14 }),
  ncCode: varchar("nc_code", { length: 50 }),
  cpvCode: varchar("cpv_code", { length: 50 }),
  status: varchar("status", { length: 20 }).default("active"),
  // Logistics details for shipping
  weight: decimal("weight", { precision: 8, scale: 3 }), // Weight in kg
  length: decimal("length", { precision: 8, scale: 2 }), // Length in cm
  width: decimal("width", { precision: 8, scale: 2 }), // Width in cm
  height: decimal("height", { precision: 8, scale: 2 }), // Height in cm
  piecesPerPackage: integer("pieces_per_package").default(1), // Maximum pieces per package for shipping
  productQuantity: text("product_quantity"), // Net content / quantity e.g. "5L", "500g", "1 set"
  specs: jsonb("specs").default([]), // Flexible product specs: [{label, value}, ...]
  certifications: jsonb("certifications").$type<ProductCertification[]>().notNull().default([]),
  volumeDiscounts: jsonb("volume_discounts").default([]), // Volume discount tiers: [{minQty, discountPercent}, ...]
  productType: varchar("product_type", { length: 20 }).notNull().default("standard"), // standard | service | subscription
  isService: boolean("is_service").default(false), // Legacy service flag; new products should use productType
  isComposite: boolean("is_composite").default(false), // Configurable parent product whose price comes from selected components
  descriptionHtml: text("description_html"), // AI-formatted HTML description (generated once, stored permanently)
  priority: integer("priority").default(0), // Display priority: 1 = highest, 2, 3 = lower priorities, 0 = default order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product translations table for multilingual support
export const productTranslations = pgTable("product_translations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  language: varchar("language", { length: 10 }).notNull(), // ro, en, de, fr, etc.
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 255 }),
  sourceUrl: text("source_url"), // URL from which this translation was imported
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Category translations table for multilingual support
export const categoryTranslations = pgTable("category_translations", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market settings table — one row per market (ro, com, fr)
export const marketSettings = pgTable("market_settings", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull().unique(), // ro, com, fr
  label: varchar("label", { length: 100 }).notNull(), // e.g. "România", "International", "France"
  currency: varchar("currency", { length: 3 }).notNull().default("RON"), // RON, EUR
  invoiceProvider: varchar("invoice_provider", { length: 30 }), // smartbill, pennylane, local; null keeps the market default
  vatPercentage: decimal("default_vat_percentage", { precision: 5, scale: 2 }).default("19.00"),
  freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }).default("1000.00"),
  standardShippingCost: decimal("standard_shipping_cost", { precision: 10, scale: 2 }).default("35.00"),
  // Up to five optional abandoned-cart reminder thresholds, expressed in
  // hours after the cart/checkout flow was last changed. Null means disabled.
  abandonedCartReminderHours: jsonb("abandoned_cart_reminder_hours")
    .$type<Array<number | null>>()
    .default([24, null, null, null, null]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MarketingSegmentCriteria = {
  market?: "all" | "ro" | "fr" | "com";
  hasOrders?: "any" | "yes" | "no";
  hasAbandonedCart?: "any" | "yes" | "no";
  eventVoucherCampaign?: "any" | "chef-event-fr";
  prospectListId?: number;
  prospectAudience?: "invitation" | "newsletter";
};

export const marketingSegments = pgTable("marketing_segments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  market: varchar("market", { length: 10 }).notNull().default("all"),
  criteria: jsonb("criteria").$type<MarketingSegmentCriteria>().notNull().default({}),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  marketingSegmentMarketIdx: index("marketing_segments_market_idx").on(table.market),
}));

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  market: varchar("market", { length: 10 }).notNull(),
  segmentId: integer("segment_id").references(() => marketingSegments.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  marketingCampaignMarketIdx: index("marketing_campaigns_market_idx").on(table.market),
}));

export const aiRecommendationCampaigns = pgTable("ai_recommendation_campaigns", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull(),
  productIds: jsonb("product_ids").$type<number[]>().notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  aiRecommendationCampaignMarketDatesIdx: index("ai_recommendation_campaign_market_dates_idx")
    .on(table.market, table.startsAt, table.endsAt),
}));

// Product markets table — which products are available in which markets + optional overrides
export const productMarkets = pgTable("product_markets", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  market: varchar("market", { length: 10 }).notNull(), // ro, com, fr
  // Category assignment is marketplace-specific. A product may belong to a
  // different independent category row on RO, FR, and COM.
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true),
  // Price overrides — null means fall back to product.price / product.compareAtPrice
  price: decimal("price", { precision: 10, scale: 2 }),
  priceNet: decimal("price_net", { precision: 10, scale: 2 }),
  priceGross: decimal("price_gross", { precision: 10, scale: 2 }),
  priceDisplayMode: varchar("price_display_mode", { length: 10 }),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }), // null = inherit from marketSettings.currency
  // Pennylane mappings are market/company specific and are intentionally
  // nullable: sandbox and production IDs are not portable.
  pennylaneProductId: varchar("pennylane_product_id", { length: 100 }),
  pennylaneAccountingAccountId: varchar("pennylane_accounting_account_id", { length: 100 }),
  // Stock overrides — null means fall back to product-level stock
  inStock: boolean("in_stock"),
  stockQuantity: integer("stock_quantity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  productMarketUnique: uniqueIndex("product_markets_product_id_market_unique").on(table.productId, table.market),
}));

// Google Merchant Center feed configuration — one independently configurable
// feed per marketplace. Category/product selections are stored in the two
// junction tables below and are combined with OR semantics.
export const googleMerchantFeeds = pgTable("google_merchant_feeds", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  includeOutOfStock: boolean("include_out_of_stock").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const googleMerchantFeedCategories = pgTable("google_merchant_feed_categories", {
  feedId: integer("feed_id").references(() => googleMerchantFeeds.id, { onDelete: "cascade" }).notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  feedCategoryUnique: uniqueIndex("google_merchant_feed_categories_unique").on(table.feedId, table.categoryId),
}));

export const googleMerchantFeedProducts = pgTable("google_merchant_feed_products", {
  feedId: integer("feed_id").references(() => googleMerchantFeeds.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  feedProductUnique: uniqueIndex("google_merchant_feed_products_unique").on(table.feedId, table.productId),
}));

export const compositeProductComponents = pgTable("composite_product_components", {
  id: serial("id").primaryKey(),
  parentProductId: integer("parent_product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  componentProductId: integer("component_product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  market: varchar("market", { length: 10 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  parentComponentMarketUnique: uniqueIndex("composite_components_parent_component_market_unique")
    .on(table.parentProductId, table.componentProductId, table.market),
  parentMarketOrderIndex: index("composite_components_parent_market_order_idx")
    .on(table.parentProductId, table.market, table.sortOrder),
}));

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  publicOrderRef: varchar("public_order_ref", { length: 80 }).unique(),
  market: varchar("market", { length: 10 }).default("ro"), // which market the order was placed on
  currency: varchar("currency", { length: 3 }).default("RON"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  fulfillmentStatus: varchar("fulfillment_status", { length: 40 }).notNull().default("unassigned"),
  fulfillmentPartnerId: integer("fulfillment_partner_id"),
  fulfillmentAssignedAt: timestamp("fulfillment_assigned_at"),
  confirmedAt: timestamp("confirmed_at"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  subtotalNet: decimal("subtotal_net", { precision: 10, scale: 2 }),
  subtotalGross: decimal("subtotal_gross", { precision: 10, scale: 2 }),
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  shippingNetAmount: decimal("shipping_net_amount", { precision: 10, scale: 2 }),
  shippingVatAmount: decimal("shipping_vat_amount", { precision: 10, scale: 2 }),
  shippingAddress: jsonb("shipping_address").notNull(),
  billingAddress: jsonb("billing_address").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentProviderOrderId: varchar("payment_provider_order_id", { length: 120 }),
  paypalCheckoutAttemptId: varchar("paypal_checkout_attempt_id", { length: 36 }),
  paypalCheckoutFingerprint: varchar("paypal_checkout_fingerprint", { length: 64 }),
  paymentTransactionId: varchar("payment_transaction_id", { length: 120 }),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"),
  notes: text("notes"),
  // AWB (Air Waybill) fields for shipping
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0.00"),
  voucherCode: varchar("voucher_code", { length: 100 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountNetAmount: decimal("discount_net_amount", { precision: 10, scale: 2 }),
  discountGrossAmount: decimal("discount_gross_amount", { precision: 10, scale: 2 }),
  awbNumber: varchar("awb_number", { length: 100 }),
  awbCourier: varchar("awb_courier", { length: 50 }).default("sameday"),
  awbCost: decimal("awb_cost", { precision: 10, scale: 2 }),
  awbCurrency: varchar("awb_currency", { length: 3 }).default("RON"),
  awbPdfUrl: text("awb_pdf_url"),
  awbTrackingUrl: text("awb_tracking_url"),
  awbCreatedAt: timestamp("awb_created_at"),
  estimatedDelivery: timestamp("estimated_delivery"),
  source: varchar("source", { length: 50 }).default("website"), // 'website' | 'manual_admin'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  paymentProviderOrderIdUnique: uniqueIndex("orders_payment_provider_order_id_unique").on(table.paymentProviderOrderId),
  paypalCheckoutAttemptIdUnique: uniqueIndex("orders_paypal_checkout_attempt_id_unique").on(table.paypalCheckoutAttemptId),
  paymentTransactionIdUnique: uniqueIndex("orders_payment_transaction_id_unique").on(table.paymentTransactionId),
}));

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  priceNet: decimal("price_net", { precision: 10, scale: 2 }),
  totalPriceNet: decimal("total_price_net", { precision: 10, scale: 2 }),
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  displayPrice: decimal("display_price", { precision: 10, scale: 2 }),
  priceDisplayMode: varchar("price_display_mode", { length: 10 }),
  compositeConfiguration: jsonb("composite_configuration").$type<CompositeConfiguration | null>(),
});

// Inbound WMS integration. API keys are never stored in plaintext.
export const fulfillmentPartners = pgTable("fulfillment_partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 60 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketFulfillment = pgTable("market_fulfillment", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull().unique(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "restrict" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wmsOriginAddresses = pgTable("wms_origin_addresses", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull().unique(),
  // Provider-owned pickup point used by the Romanian Sameday account.
  // It is intentionally stored with the market-scoped logistics origin,
  // rather than using a global or hardcoded courier setting.
  samedayPickupPointId: integer("sameday_pickup_point_id"),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wmsApiKeys = pgTable("wms_api_keys", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "cascade" }).notNull(),
  environment: varchar("environment", { length: 20 }).notNull().default("production"),
  keyPrefix: varchar("key_prefix", { length: 32 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  scopes: text("scopes").array().notNull().default([]),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});

export const wmsShipments = pgTable("wms_shipments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "restrict" }).notNull(),
  parcelId: varchar("parcel_id", { length: 100 }).notNull(),
  trackingNumber: varchar("tracking_number", { length: 160 }),
  carrier: varchar("carrier", { length: 100 }),
  status: varchar("status", { length: 40 }).notNull().default("created"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orderParcelUnique: uniqueIndex("wms_shipments_order_parcel_unique").on(table.orderId, table.parcelId),
  partnerOrderIdx: index("wms_shipments_partner_order_idx").on(table.partnerId, table.orderId),
}));

export const wmsOrderEvents = pgTable("wms_order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "restrict" }).notNull(),
  eventId: varchar("event_id", { length: 160 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  partnerEventUnique: uniqueIndex("wms_order_events_partner_event_unique").on(table.partnerId, table.eventId),
  orderOccurredIdx: index("wms_order_events_order_occurred_idx").on(table.orderId, table.occurredAt),
}));

export const wmsInventory = pgTable("wms_inventory", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "cascade" }).notNull(),
  sku: varchar("sku", { length: 160 }).notNull(),
  quantity: integer("quantity").notNull(),
  availableQuantity: integer("available_quantity").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  partnerSkuUnique: uniqueIndex("wms_inventory_partner_sku_unique").on(table.partnerId, table.sku),
}));

export const wmsIdempotencyKeys = pgTable("wms_idempotency_keys", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "cascade" }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  partnerKeyUnique: uniqueIndex("wms_idempotency_partner_key_unique").on(table.partnerId, table.idempotencyKey),
}));

export const wmsAuditLogs = pgTable("wms_audit_logs", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => fulfillmentPartners.id, { onDelete: "set null" }),
  apiKeyId: integer("api_key_id").references(() => wmsApiKeys.id, { onDelete: "set null" }),
  requestId: varchar("request_id", { length: 120 }).notNull(),
  method: varchar("method", { length: 12 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  createdIdx: index("wms_audit_logs_created_idx").on(table.createdAt),
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  initialOrderId: integer("initial_order_id").references(() => orders.id),
  market: varchar("market", { length: 10 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"), // active | past_due | canceled
  initialTransactionId: varchar("initial_transaction_id", { length: 120 }).notNull(),
  nextBillingAt: timestamp("next_billing_at").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at"),
  consentAt: timestamp("consent_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subscriptionUserIdx: index("subscriptions_user_idx").on(table.userId),
  subscriptionBillingIdx: index("subscriptions_billing_idx").on(table.status, table.nextBillingAt),
  subscriptionInitialTransactionUnique: uniqueIndex("subscriptions_initial_transaction_unique")
    .on(table.initialTransactionId),
}));

export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  billingKey: varchar("billing_key", { length: 80 }).notNull(),
  initialTransactionId: varchar("initial_transaction_id", { length: 120 }).notNull(),
  vivaTransactionId: varchar("viva_transaction_id", { length: 120 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"), // pending | succeeded | failed
  attemptNumber: integer("attempt_number").notNull().default(1),
  dueAt: timestamp("due_at").notNull(),
  paidAt: timestamp("paid_at"),
  failureReason: text("failure_reason"),
  failureNotifiedAt: timestamp("failure_notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subscriptionBillingKeyUnique: uniqueIndex("subscription_payments_subscription_billing_key_unique")
    .on(table.subscriptionId, table.billingKey),
  subscriptionVivaTransactionUnique: uniqueIndex("subscription_payments_viva_transaction_unique")
    .on(table.vivaTransactionId),
  subscriptionPaymentStatusIdx: index("subscription_payments_status_idx").on(table.status, table.dueAt),
}));

// Cart items table (for persistent cart)
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  // A user's cart is independent per marketplace. Existing rows remain
  // Romanian carts through the database default during the migration.
  market: varchar("market", { length: 10 }).notNull().default("ro"),
  quantity: integer("quantity").notNull(),
  compositeConfiguration: jsonb("composite_configuration").$type<CompositeConfiguration | null>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One reminder state per authenticated user and marketplace. The cart snapshot
// prevents a scheduler restart from sending the same reminder repeatedly.
export const abandonedCartReminders = pgTable("abandoned_cart_reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  market: varchar("market", { length: 10 }).notNull(),
  cartUpdatedAt: timestamp("cart_updated_at").notNull(),
  lastSentAt: timestamp("last_sent_at").notNull(),
  // Existing one-reminder records predate the five-threshold model, so they
  // represent the first reminder after the migration.
  lastSentThreshold: integer("last_sent_threshold").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userMarketUnique: uniqueIndex("abandoned_cart_reminders_user_market_unique").on(table.userId, table.market),
}));

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).unique(),
  // An order can have an earlier local/fallback invoice and a later
  // SmartBill or reissued invoice, so this relationship is not unique.
  orderId: integer("order_id").references(() => orders.id),
  userId: integer("user_id").references(() => users.id),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  supplyDate: timestamp("supply_date"),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, paid, overdue, cancelled, issued
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // card, wire_transfer, cash
  paymentLink: text("payment_link"), // For wire transfer QR codes
  notes: text("notes"),
  // Smartbill integration fields
  smartbillSeries: varchar("smartbill_series", { length: 50 }), // Smartbill document series
  smartbillNumber: varchar("smartbill_number", { length: 50 }), // Smartbill document number
  smartbillId: varchar("smartbill_id", { length: 100 }), // Smartbill internal ID
  smartbillUrl: text("smartbill_url"), // Direct link to Smartbill invoice
  // Multi-market & local PDF fields
  market: varchar("market", { length: 10 }).default("ro"), // ro, fr, com
  pdfPath: text("pdf_path"), // local PDF file path for fr/com
  efacturaStatus: varchar("efactura_status", { length: 50 }), // stub: pending, submitted, accepted
  efacturaRef: text("efactura_ref"), // stub: e-factura reference number
  externalRef: text("external_ref"), // external API reference (.com integrations, Chorus Pro tx ID, etc.)
  provider: varchar("provider", { length: 30 }), // local, smartbill, pennylane
  providerStatus: varchar("provider_status", { length: 30 }), // pending, failed, issued
  providerInvoiceId: varchar("provider_invoice_id", { length: 120 }),
  providerInvoiceUrl: text("provider_invoice_url"),
  providerPdfUrl: text("provider_pdf_url"),
  providerError: text("provider_error"),
  providerLastAttemptAt: timestamp("provider_last_attempt_at"),
  providerNextRetryAt: timestamp("provider_next_retry_at"),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoice items table
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCode: varchar("product_code", { length: 100 }),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0.00"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  county: varchar("county", { length: 100 }), // Added for Romanian Județ
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiKey: varchar("api_key", { length: 255 }),
  integrationType: varchar("integration_type", { length: 50 }).default("email"), // email, api, manual
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  marketCode: varchar("market_code", { length: 10 }).default("ro").notNull(), // ro, fr, com
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company settings table
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  marketCode: varchar("market_code", { length: 10 }).notNull().default("ro").unique(), // per-market row; 'ro' is default/global
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  logisticsEmail: varchar("logistics_email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  county: varchar("county", { length: 100 }), // Added for Romanian Județ
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  website: varchar("website", { length: 255 }),
  vatNumber: varchar("vat_number", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  bankName: varchar("bank_name", { length: 255 }),
  iban: varchar("iban", { length: 50 }),
  description: text("description"),
  // New fields for currency and VAT management
  defaultCurrency: varchar("default_currency", { length: 3 }).default("EUR"),
  defaultVatPercentage: decimal("default_vat_percentage", { precision: 5, scale: 2 }).default("19.00"),
  reverseChargeVat: decimal("reverse_charge_vat", { precision: 5, scale: 2 }).default("0.00"), // For international invoices
  // Shipping settings
  freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }).default("500.00"),
  standardShippingCost: decimal("standard_shipping_cost", { precision: 10, scale: 2 }).default("25.00"),
  // Invoice numbering settings (per-market row)
  invoiceSeries: varchar("invoice_series", { length: 20 }).default("FACT"),
  invoiceNumberFormat: varchar("invoice_number_format", { length: 50 }).default("YYYY-NNNNNN"),
  invoiceCurrentNumber: integer("invoice_current_number").default(0),
  // Per-market contact data (ro / fr / com)
  marketContacts: jsonb("market_contacts").$type<{
    ro?: { name?: string; address?: string; city?: string; zipCode?: string; country?: string; phone?: string; email?: string; vatNumber?: string; registrationNumber?: string; };
    fr?: { name?: string; address?: string; city?: string; zipCode?: string; country?: string; phone?: string; email?: string; vatNumber?: string; registrationNumber?: string; };
    com?: { name?: string; address?: string; city?: string; zipCode?: string; country?: string; phone?: string; email?: string; vatNumber?: string; registrationNumber?: string; };
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Per-market homepage promotional hero slides
export const homepageHeroSlides = pgTable("homepage_hero_slides", {
  id: serial("id").primaryKey(),
  marketCode: varchar("market_code", { length: 10 }).notNull(),
  slideType: varchar("slide_type", { length: 20 }).notNull().default("text"), // text | image
  imageUrl: varchar("image_url", { length: 1000 }),
  mobileImageUrl: varchar("mobile_image_url", { length: 1000 }),
  imageAlt: varchar("image_alt", { length: 255 }),
  title: varchar("title", { length: 500 }),
  subtitle: text("subtitle"),
  ctaLabel: varchar("cta_label", { length: 255 }),
  ctaUrl: varchar("cta_url", { length: 1000 }),
  ctaType: varchar("cta_type", { length: 20 }).notNull().default("link"), // link | quote
  destinationType: varchar("destination_type", { length: 20 }).notNull().default("none"), // none | category | product | custom
  destinationId: integer("destination_id"),
  destinationUrl: varchar("destination_url", { length: 1000 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  marketOrderIdx: index("homepage_hero_slides_market_order_idx").on(table.marketCode, table.sortOrder),
}));

export const homepageHeroSettings = pgTable("homepage_hero_settings", {
  id: serial("id").primaryKey(),
  marketCode: varchar("market_code", { length: 10 }).notNull().unique(),
  autoplaySeconds: integer("autoplay_seconds").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipping settings table for parcel company configuration
export const shippingSettings = pgTable("shipping_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 100 }).notNull().default("Sameday Courier"),
  // Kept for compatibility with the legacy shipping-settings screen.
  // Romanian AWB creation uses wms_origin_addresses.samedayPickupPointId.
  pickupPointCode: varchar("pickup_point_code", { length: 50 }).notNull().default(""),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  apiBaseUrl: varchar("api_base_url", { length: 255 }).default("https://api.sameday.ro"),
  isActive: boolean("is_active").default(true),
  serviceId: integer("service_id").default(7), // Default service for shipping
  defaultPackageType: varchar("default_package_type", { length: 50 }).default("PARCEL"),
  defaultPaymentMethod: varchar("default_payment_method", { length: 50 }).default("SENDER"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vouchers table for discount codes
export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  discountType: varchar("discount_type", { length: 20 }).notNull().default("fixed"), // fixed or percentage
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  activationDeadline: timestamp("activation_deadline"),
  activatedAt: timestamp("activated_at"),
  activationMonths: integer("activation_months"),
  ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "restrict" }),
  ownerEmail: varchar("owner_email", { length: 255 }),
  marketCode: varchar("market_code", { length: 10 }).default("ro").notNull(), // ro, fr, com
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerPasswordSetupTokens = pgTable("customer_password_setup_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  customerPasswordSetupUserIdx: index("customer_password_setup_tokens_user_idx").on(table.userId),
}));

// Public event voucher campaigns and registrations
export const eventVoucherCampaigns = pgTable("event_voucher_campaigns", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  marketCode: varchar("market_code", { length: 10 }).notNull().default("fr"),
  discountType: varchar("discount_type", { length: 20 }).notNull().default("percentage"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull().default("20.00"),
  validMonths: integer("valid_months").notNull().default(12),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventVoucherRegistrations = pgTable("event_voucher_registrations", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => eventVoucherCampaigns.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  restaurant: varchar("restaurant", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  voucherId: integer("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
  consentAt: timestamp("consent_at").notNull(),
  emailStatus: varchar("email_status", { length: 20 }).notNull().default("pending"),
  emailSentAt: timestamp("email_sent_at"),
  emailError: text("email_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  campaignEmailUnique: uniqueIndex("event_voucher_campaign_email_unique").on(table.campaignId, table.email),
}));

export const marketingProspectLists = pgTable("marketing_prospect_lists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  market: varchar("market", { length: 10 }).notNull().default("fr"),
  sourceFile: varchar("source_file", { length: 255 }).notNull(),
  contactBasis: varchar("contact_basis", { length: 60 }).notNull(),
  basisConfirmedAt: timestamp("basis_confirmed_at").notNull(),
  basisConfirmedBy: integer("basis_confirmed_by").references(() => users.id, { onDelete: "set null" }),
  totalContacts: integer("total_contacts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  marketingProspectListMarketIdx: index("marketing_prospect_lists_market_idx").on(table.market),
}));

export const marketingProspects = pgTable("marketing_prospects", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  market: varchar("market", { length: 10 }).notNull().default("fr"),
  restaurantName: varchar("restaurant_name", { length: 255 }),
  city: varchar("city", { length: 160 }),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  website: text("website"),
  foodSafetyNote: text("food_safety_note"),
  legalRepresentative: varchar("legal_representative", { length: 255 }),
  siret: varchar("siret", { length: 32 }),
  source: text("source"),
  subscriptionStatus: varchar("subscription_status", { length: 24 }).notNull().default("not_subscribed"),
  invitationSentAt: timestamp("invitation_sent_at"),
  newsletterConsentAt: timestamp("newsletter_consent_at"),
  newsletterConsentVersion: varchar("newsletter_consent_version", { length: 60 }),
  newsletterVoucherId: integer("newsletter_voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
  voucherEmailSentAt: timestamp("voucher_email_sent_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  marketingProspectEmailMarketUnique: uniqueIndex("marketing_prospects_email_market_unique").on(table.email, table.market),
  marketingProspectMarketStatusIdx: index("marketing_prospects_market_status_idx").on(table.market, table.subscriptionStatus),
}));

export const marketingProspectListContacts = pgTable("marketing_prospect_list_contacts", {
  listId: integer("list_id").notNull().references(() => marketingProspectLists.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => marketingProspects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  marketingProspectListContactPk: primaryKey({ columns: [table.listId, table.prospectId] }),
  marketingProspectListContactProspectIdx: index("marketing_prospect_list_contacts_prospect_idx").on(table.prospectId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  reviews: many(reviews),
  invoices: many(invoices),
  subscriptions: many(subscriptions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  reviews: many(reviews),
  translations: many(productTranslations),
  subscriptions: many(subscriptions),
  compositeParents: many(compositeProductComponents, { relationName: "compositeParent" }),
  compositeComponents: many(compositeProductComponents, { relationName: "compositeComponent" }),
}));

export const compositeProductComponentsRelations = relations(compositeProductComponents, ({ one }) => ({
  parentProduct: one(products, {
    fields: [compositeProductComponents.parentProductId],
    references: [products.id],
    relationName: "compositeParent",
  }),
  componentProduct: one(products, {
    fields: [compositeProductComponents.componentProductId],
    references: [products.id],
    relationName: "compositeComponent",
  }),
}));

export const productTranslationsRelations = relations(productTranslations, ({ one }) => ({
  product: one(products, {
    fields: [productTranslations.productId],
    references: [products.id],
  }),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  subscriptions: many(subscriptions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [subscriptions.productId],
    references: [products.id],
  }),
  initialOrder: one(orders, {
    fields: [subscriptions.initialOrderId],
    references: [orders.id],
  }),
  payments: many(subscriptionPayments),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionPayments.subscriptionId],
    references: [subscriptions.id],
  }),
  order: one(orders, {
    fields: [subscriptionPayments.orderId],
    references: [orders.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordSetupRequired: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products, {
  certifications: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    url: z.string().min(1),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().positive().max(10 * 1024 * 1024),
  })).max(10).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductTranslationSchema = createInsertSchema(productTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategoryTranslationSchema = createInsertSchema(categoryTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Invoice counters — per-market sequential numbering (fr, com; ro uses Smartbill)
export const invoiceCounters = pgTable("invoice_counters", {
  id: serial("id").primaryKey(),
  market: varchar("market", { length: 10 }).notNull().unique(), // ro, fr, com
  series: varchar("series", { length: 20 }).notNull().default("FACT"),
  currentNumber: integer("current_number").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type InvoiceCounter = typeof invoiceCounters.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHomepageHeroSlideSchema = createInsertSchema(homepageHeroSlides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHomepageHeroSettingsSchema = createInsertSchema(homepageHeroSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShippingSettingsSchema = createInsertSchema(shippingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoucherSchema = createInsertSchema(vouchers).omit({
  id: true,
  usedCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventVoucherCampaignSchema = createInsertSchema(eventVoucherCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventVoucherRegistrationSchema = createInsertSchema(eventVoucherRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketSettingsSchema = createInsertSchema(marketSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductMarketsSchema = createInsertSchema(productMarkets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoogleMerchantFeedSchema = createInsertSchema(googleMerchantFeeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompositeProductComponentSchema = createInsertSchema(compositeProductComponents).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductTranslation = typeof productTranslations.$inferSelect;
export type InsertProductTranslation = z.infer<typeof insertProductTranslationSchema>;
export type CategoryTranslation = typeof categoryTranslations.$inferSelect;
export type InsertCategoryTranslation = z.infer<typeof insertCategoryTranslationSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = Omit<typeof orderItems.$inferInsert, "compositeConfiguration"> & {
  compositeConfiguration?: CompositeConfiguration | null;
};
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = Omit<typeof cartItems.$inferInsert, "compositeConfiguration"> & {
  compositeConfiguration?: CompositeConfiguration | null;
};
export type AbandonedCartReminder = typeof abandonedCartReminders.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type HomepageHeroSlide = typeof homepageHeroSlides.$inferSelect;
export type InsertHomepageHeroSlide = z.infer<typeof insertHomepageHeroSlideSchema>;
export type HomepageHeroSettings = typeof homepageHeroSettings.$inferSelect;
export type InsertHomepageHeroSettings = z.infer<typeof insertHomepageHeroSettingsSchema>;
export type ShippingSettings = typeof shippingSettings.$inferSelect;
export type InsertShippingSettings = z.infer<typeof insertShippingSettingsSchema>;
export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type EventVoucherCampaign = typeof eventVoucherCampaigns.$inferSelect;
export type InsertEventVoucherCampaign = z.infer<typeof insertEventVoucherCampaignSchema>;
export type EventVoucherRegistration = typeof eventVoucherRegistrations.$inferSelect;
export type InsertEventVoucherRegistration = z.infer<typeof insertEventVoucherRegistrationSchema>;
export type MarketSettings = typeof marketSettings.$inferSelect;
export type InsertMarketSettings = z.infer<typeof insertMarketSettingsSchema>;
export type MarketingSegment = typeof marketingSegments.$inferSelect;
export type InsertMarketingSegment = typeof marketingSegments.$inferInsert;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;
export type MarketingProspectList = typeof marketingProspectLists.$inferSelect;
export type MarketingProspect = typeof marketingProspects.$inferSelect;
export type ProductMarket = typeof productMarkets.$inferSelect;
export type InsertProductMarket = z.infer<typeof insertProductMarketsSchema>;
export type GoogleMerchantFeed = typeof googleMerchantFeeds.$inferSelect;
export type InsertGoogleMerchantFeed = z.infer<typeof insertGoogleMerchantFeedSchema>;
export type CompositeProductComponent = typeof compositeProductComponents.$inferSelect;
export type InsertCompositeProductComponent = z.infer<typeof insertCompositeProductComponentSchema>;

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  author: varchar("author", { length: 100 }).notNull().default("xHACCP Team"),
  category: varchar("category", { length: 100 }).notNull(),
  tags: text("tags").array().notNull().default([]),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(true),
  language: varchar("language", { length: 5 }).notNull().default("ro"),
  marketCode: varchar("market_code", { length: 10 }).default("ro"),
  readTimeMinutes: integer("read_time_minutes"),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

// Blog post translations table (multilingual reading)
export const blogPostTranslations = pgTable("blog_post_translations", {
  id: serial("id").primaryKey(),
  blogPostId: integer("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  language: varchar("language", { length: 5 }).notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueLang: uniqueIndex("blog_post_translations_unique").on(table.blogPostId, table.language),
}));

export const insertBlogPostTranslationSchema = createInsertSchema(blogPostTranslations).omit({
  id: true,
  createdAt: true,
});

export type BlogPostTranslation = typeof blogPostTranslations.$inferSelect;
export type InsertBlogPostTranslation = z.infer<typeof insertBlogPostTranslationSchema>;

// Additional types for API responses
export type ProductWithCategory = Product & { category: Category | null; supplier: Supplier | null };
export type OrderWithItems = Order & { items: (OrderItem & { product: Product })[] };
export type CartItemWithProduct = CartItem & { product: Product };
export type InvoiceWithItems = Invoice & { items: (InvoiceItem & { product?: Product })[], user: User };
