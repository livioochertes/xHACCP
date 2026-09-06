import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, varchar, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  isAdmin: boolean("is_admin").default(false),
  adminMarkets: text("admin_markets").array().default([]),
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
};

// Products table
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
  volumeDiscounts: jsonb("volume_discounts").default([]), // Volume discount tiers: [{minQty, discountPercent}, ...]
  isService: boolean("is_service").default(false), // True for service/subscription products — hides volume discounts on storefront
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
  vatPercentage: decimal("default_vat_percentage", { precision: 5, scale: 2 }).default("19.00"),
  freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }).default("1000.00"),
  standardShippingCost: decimal("standard_shipping_cost", { precision: 10, scale: 2 }).default("35.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }), // null = inherit from marketSettings.currency
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
  market: varchar("market", { length: 10 }).default("ro"), // which market the order was placed on
  currency: varchar("currency", { length: 3 }).default("RON"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  billingAddress: jsonb("billing_address").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"),
  notes: text("notes"),
  // AWB (Air Waybill) fields for shipping
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0.00"),
  voucherCode: varchar("voucher_code", { length: 100 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
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
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  compositeConfiguration: jsonb("composite_configuration").$type<CompositeConfiguration | null>(),
});

// Cart items table (for persistent cart)
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  compositeConfiguration: jsonb("composite_configuration").$type<CompositeConfiguration | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  userId: integer("user_id").references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  orderId: integer("order_id").references(() => orders.id).unique(),
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

// Shipping settings table for parcel company configuration
export const shippingSettings = pgTable("shipping_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 100 }).notNull().default("Sameday Courier"),
  pickupPointCode: varchar("pickup_point_code", { length: 50 }).notNull().default("447249"),
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
  marketCode: varchar("market_code", { length: 10 }).default("ro").notNull(), // ro, fr, com
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  reviews: many(reviews),
  invoices: many(invoices),
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
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
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
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = Omit<typeof cartItems.$inferInsert, "compositeConfiguration"> & {
  compositeConfiguration?: CompositeConfiguration | null;
};
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
export type ShippingSettings = typeof shippingSettings.$inferSelect;
export type InsertShippingSettings = z.infer<typeof insertShippingSettingsSchema>;
export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type MarketSettings = typeof marketSettings.$inferSelect;
export type InsertMarketSettings = z.infer<typeof insertMarketSettingsSchema>;
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
