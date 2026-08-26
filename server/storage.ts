import {
  users,
  categories,
  products,
  productTranslations,
  categoryTranslations,
  orders,
  orderItems,
  cartItems,
  reviews,
  suppliers,
  invoices,
  invoiceItems,
  companySettings,
  shippingSettings,
  vouchers,
  marketSettings,
  productMarkets,
  compositeProductComponents,
  type User,
  type InsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type ProductWithCategory,
  type ProductTranslation,
  type InsertProductTranslation,
  type CategoryTranslation,
  type InsertCategoryTranslation,
  type Order,
  type InsertOrder,
  type OrderWithItems,
  type OrderItem,
  type InsertOrderItem,
  type CartItem,
  type InsertCartItem,
  type CartItemWithProduct,
  type Review,
  type InsertReview,
  type Supplier,
  type InsertSupplier,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type InvoiceWithItems,
  type CompanySettings,
  type InsertCompanySettings,
  type ShippingSettings,
  type InsertShippingSettings,
  type Voucher,
  type InsertVoucher,
  type MarketSettings,
  type InsertMarketSettings,
  type ProductMarket,
  type InsertProductMarket,
  type CompositeProductComponent,
  type CompositeConfiguration,
  blogPosts,
  blogPostTranslations,
  type BlogPost,
  type InsertBlogPost,
  type BlogPostTranslation,
} from "@shared/schema";
import { db } from "./db";
import { compositeConfigurationKey } from "./composite-products";
import { eq, desc, like, and, or, sql, inArray, isNull, ne } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Category operations
  getCategories(market?: string): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product operations
  getProducts(options?: { categoryId?: number; featured?: boolean; search?: string; limit?: number; offset?: number }): Promise<ProductWithCategory[]>;
  getProduct(id: number): Promise<ProductWithCategory | undefined>;
  getProductBySlug(slug: string): Promise<ProductWithCategory | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  updateProductStock(id: number, stockQuantity: number): Promise<Product>;
  saveProductDescriptionHtml(id: number, html: string): Promise<void>;
  deleteProduct(id: number): Promise<void>;

  // Product translation operations
  getProductTranslations(productId: number): Promise<ProductTranslation[]>;
  getProductTranslation(productId: number, language: string): Promise<ProductTranslation | undefined>;
  createProductTranslation(translation: InsertProductTranslation): Promise<ProductTranslation>;
  updateProductTranslation(id: number, translation: Partial<InsertProductTranslation>): Promise<ProductTranslation>;
  deleteProductTranslation(id: number): Promise<void>;

  // Category translation operations
  getCategoryTranslation(categoryId: number, language: string): Promise<CategoryTranslation | undefined>;
  getCategoryTranslations(categoryId: number): Promise<CategoryTranslation[]>;
  getCategoryTranslationsBatch(categoryIds: number[], language: string): Promise<CategoryTranslation[]>;
  getAllCategoryTranslations(): Promise<CategoryTranslation[]>;
  createCategoryTranslation(translation: InsertCategoryTranslation): Promise<CategoryTranslation>;
  updateCategoryTranslation(id: number, translation: Partial<InsertCategoryTranslation>): Promise<CategoryTranslation>;
  deleteCategoryTranslation(id: number): Promise<void>;

  // Order operations
  getOrders(userId?: number): Promise<OrderWithItems[]>;
  getOrder(id: number): Promise<OrderWithItems | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  acceptOrder(id: number): Promise<Order | null>;
  linkGuestOrdersToUser(email: string, userId: number): Promise<number>;

  // Cart operations
  getCartItems(userId: number): Promise<CartItemWithProduct[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: number, userId: number, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: number, userId: number): Promise<boolean>;
  clearCart(userId: number): Promise<void>;

  // Review operations
  getProductReviews(productId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  // Supplier operations
  getSuppliers(market?: string): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;

  // Invoice operations
  getInvoices(userId?: number): Promise<Invoice[]>;
  getInvoice(id: number): Promise<InvoiceWithItems | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceWithItems | undefined>;
  createInvoice(invoice: InsertInvoice, items: Omit<InsertInvoiceItem, "invoiceId">[]): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: number): Promise<void>;

  // Admin stats operations
  getTotalUsers(): Promise<number>;
  getTotalOrders(markets?: string[]): Promise<number>;
  getTotalProducts(): Promise<number>;
  getRecentOrders(limit: number, markets?: string[]): Promise<OrderWithItems[]>;

  // Company settings operations
  getCompanySettings(): Promise<CompanySettings | undefined>;
  getCompanySettingsByMarket(market: string): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;

  // Shipping settings operations
  getShippingSettings(): Promise<ShippingSettings | undefined>;
  updateShippingSettings(settings: Partial<InsertShippingSettings>): Promise<ShippingSettings>;
  createShippingSettings(settings: InsertShippingSettings): Promise<ShippingSettings>;

  // Voucher operations
  getVouchers(market?: string): Promise<Voucher[]>;
  getVoucher(id: number): Promise<Voucher | undefined>;
  getVoucherByCode(code: string, market?: string): Promise<Voucher | undefined>;
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  updateVoucher(id: number, voucher: Partial<InsertVoucher>): Promise<Voucher>;
  deleteVoucher(id: number): Promise<void>;
  incrementVoucherUsage(id: number): Promise<Voucher>;

  // Blog post operations
  getBlogPosts(options?: { published?: boolean; language?: string; marketCode?: string; limit?: number; offset?: number }): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  getBlogPostTranslations(blogPostId: number): Promise<BlogPostTranslation[]>;
  getBlogPostTranslation(blogPostId: number, language: string): Promise<BlogPostTranslation | undefined>;
  upsertBlogPostTranslation(blogPostId: number, language: string, data: { title: string; excerpt: string; content: string }): Promise<BlogPostTranslation>;

  // Market settings operations
  getMarketSettings(): Promise<MarketSettings[]>;
  getMarketSetting(market: string): Promise<MarketSettings | undefined>;
  upsertMarketSettings(market: string, settings: Partial<InsertMarketSettings>): Promise<MarketSettings>;
  deleteMarketSettings(market: string): Promise<void>;

  // Product market operations
  getProductMarkets(productId: number): Promise<ProductMarket[]>;
  getProductMarketsByMarket(market: string): Promise<ProductMarket[]>;
  setProductMarket(data: InsertProductMarket): Promise<ProductMarket>;
  updateProductMarket(productId: number, market: string, data: Partial<InsertProductMarket>): Promise<ProductMarket>;
  deleteProductMarket(productId: number, market: string): Promise<void>;
  getProductsForMarket(market: string): Promise<number[]>;

  // Composite product operations
  getCompositeProductComponents(parentProductId: number, market: string): Promise<Array<CompositeProductComponent & { product: Product; marketPrice: string | null; marketCurrency: string | null; marketIsActive: boolean | null }>>;
  replaceCompositeProductComponents(parentProductId: number, market: string, componentProductIds: number[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Category operations
  async getCategories(market?: string): Promise<Category[]> {
    if (market && market !== 'all') {
      return await db.select().from(categories).where(eq(categories.marketCode, market)).orderBy(categories.name);
    }
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product operations
  async getProducts(options?: { categoryId?: number; featured?: boolean; search?: string; limit?: number; offset?: number }): Promise<ProductWithCategory[]> {
    // Super minimal query - only essential fields
    const query = db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        categoryId: products.categoryId,
        supplierId: products.supplierId,
        imageUrl: products.imageUrl,
        images: products.images,
        inStock: products.inStock,
        stockQuantity: products.stockQuantity,
        featured: products.featured,
        rating: products.rating,
        reviewCount: products.reviewCount,
        vatValue: products.vatValue,
        vatPercentage: products.vatPercentage,
        currency: products.currency,
        productCode: products.productCode,
        ncCode: products.ncCode,
        cpvCode: products.cpvCode,
        status: products.status,
        weight: products.weight,
        length: products.length,
        width: products.width,
        height: products.height,
        piecesPerPackage: products.piecesPerPackage,
        productQuantity: products.productQuantity,
        specs: products.specs,
        volumeDiscounts: products.volumeDiscounts,
        isService: products.isService,
        isComposite: products.isComposite,
        descriptionHtml: products.descriptionHtml,
        priority: products.priority,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          description: categories.description,
          imageUrl: categories.imageUrl,
          showOnMainTop: categories.showOnMainTop,
          showOnMainShop: categories.showOnMainShop,
          sortOrder: categories.sortOrder,
          createdAt: categories.createdAt,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          address: suppliers.address,
          city: suppliers.city,
          state: suppliers.state,
          zipCode: suppliers.zipCode,
          country: suppliers.country,
          contactPerson: suppliers.contactPerson,
          apiEndpoint: suppliers.apiEndpoint,
          apiKey: suppliers.apiKey,
          integrationType: suppliers.integrationType,
          notes: suppliers.notes,
          isActive: suppliers.isActive,
          createdAt: suppliers.createdAt,
          updatedAt: suppliers.updatedAt,
        },
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id));

    // Apply filters directly without building conditions array
    if (options?.categoryId) {
      query.where(eq(products.categoryId, options.categoryId));
    }
    if (options?.featured) {
      query.where(eq(products.featured, true));
    }
    if (options?.search) {
      query.where(like(products.name, `%${options.search}%`));
    }

    // Remove ordering for maximum speed
    if (options?.limit) {
      query.limit(options.limit);
    }

    return (await query) as unknown as ProductWithCategory[];
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        categoryId: products.categoryId,
        supplierId: products.supplierId,
        imageUrl: products.imageUrl,
        images: products.images,
        inStock: products.inStock,
        stockQuantity: products.stockQuantity,
        featured: products.featured,
        rating: products.rating,
        reviewCount: products.reviewCount,
        vatValue: products.vatValue,
        vatPercentage: products.vatPercentage,
        currency: products.currency,
        productCode: products.productCode,
        ncCode: products.ncCode,
        cpvCode: products.cpvCode,
        status: products.status,
        weight: products.weight,
        length: products.length,
        width: products.width,
        height: products.height,
        piecesPerPackage: products.piecesPerPackage,
        productQuantity: products.productQuantity,
        specs: products.specs,
        volumeDiscounts: products.volumeDiscounts,
        isService: products.isService,
        isComposite: products.isComposite,
        descriptionHtml: products.descriptionHtml,
        priority: products.priority,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          description: categories.description,
          imageUrl: categories.imageUrl,
          showOnMainTop: categories.showOnMainTop,
          showOnMainShop: categories.showOnMainShop,
          sortOrder: categories.sortOrder,
          createdAt: categories.createdAt,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          address: suppliers.address,
          city: suppliers.city,
          state: suppliers.state,
          zipCode: suppliers.zipCode,
          country: suppliers.country,
          contactPerson: suppliers.contactPerson,
          apiEndpoint: suppliers.apiEndpoint,
          apiKey: suppliers.apiKey,
          integrationType: suppliers.integrationType,
          notes: suppliers.notes,
          isActive: suppliers.isActive,
          createdAt: suppliers.createdAt,
          updatedAt: suppliers.updatedAt,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(eq(products.id, id));
    
    return product as unknown as ProductWithCategory | undefined;
  }

  async getProductBySlug(slug: string): Promise<ProductWithCategory | undefined> {
    const productSelect = {
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      categoryId: products.categoryId,
      supplierId: products.supplierId,
      imageUrl: products.imageUrl,
      images: products.images,
      inStock: products.inStock,
      stockQuantity: products.stockQuantity,
      featured: products.featured,
      rating: products.rating,
      reviewCount: products.reviewCount,
      vatValue: products.vatValue,
      vatPercentage: products.vatPercentage,
      currency: products.currency,
      productCode: products.productCode,
      ncCode: products.ncCode,
      cpvCode: products.cpvCode,
      status: products.status,
      weight: products.weight,
      length: products.length,
      width: products.width,
      height: products.height,
      piecesPerPackage: products.piecesPerPackage,
      productQuantity: products.productQuantity,
      specs: products.specs,
      volumeDiscounts: products.volumeDiscounts,
      isService: products.isService,
      isComposite: products.isComposite,
      priority: products.priority,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      category: {
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        imageUrl: categories.imageUrl,
        showOnMainTop: categories.showOnMainTop,
        showOnMainShop: categories.showOnMainShop,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
      },
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
        email: suppliers.email,
        phone: suppliers.phone,
        address: suppliers.address,
        city: suppliers.city,
        state: suppliers.state,
        zipCode: suppliers.zipCode,
        country: suppliers.country,
        contactPerson: suppliers.contactPerson,
        apiEndpoint: suppliers.apiEndpoint,
        apiKey: suppliers.apiKey,
        integrationType: suppliers.integrationType,
        notes: suppliers.notes,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
        updatedAt: suppliers.updatedAt,
      },
    };

    // 1. Try global slug first
    const [product] = await db
      .select(productSelect)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(eq(products.slug, slug));

    if (product) return product as unknown as ProductWithCategory;

    // 2. Fallback: look up by localized slug stored in product_translations
    const [translation] = await db
      .select({ productId: productTranslations.productId })
      .from(productTranslations)
      .where(eq(productTranslations.slug, slug))
      .limit(1);

    if (!translation) return undefined;

    const [localizedProduct] = await db
      .select(productSelect)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(eq(products.id, translation.productId));

    return localizedProduct as unknown as ProductWithCategory | undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async updateProductStock(id: number, stockQuantity: number): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ stockQuantity, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async saveProductDescriptionHtml(id: number, html: string): Promise<void> {
    await db
      .update(products)
      .set({ descriptionHtml: html } as any)
      .where(eq(products.id, id));
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Product translation operations
  async getProductTranslations(productId: number): Promise<ProductTranslation[]> {
    return await db.select().from(productTranslations).where(eq(productTranslations.productId, productId));
  }

  async getProductTranslation(productId: number, language: string): Promise<ProductTranslation | undefined> {
    const [translation] = await db.select().from(productTranslations)
      .where(and(eq(productTranslations.productId, productId), eq(productTranslations.language, language)));
    return translation;
  }

  async createProductTranslation(translation: InsertProductTranslation): Promise<ProductTranslation> {
    const [newTranslation] = await db.insert(productTranslations).values(translation).returning();
    return newTranslation;
  }

  async updateProductTranslation(id: number, translation: Partial<InsertProductTranslation>): Promise<ProductTranslation> {
    const [updatedTranslation] = await db
      .update(productTranslations)
      .set({ ...translation, updatedAt: new Date() })
      .where(eq(productTranslations.id, id))
      .returning();
    return updatedTranslation;
  }

  async deleteProductTranslation(id: number): Promise<void> {
    await db.delete(productTranslations).where(eq(productTranslations.id, id));
  }

  async getCategoryTranslation(categoryId: number, language: string): Promise<CategoryTranslation | undefined> {
    const [translation] = await db.select().from(categoryTranslations)
      .where(and(eq(categoryTranslations.categoryId, categoryId), eq(categoryTranslations.language, language)));
    return translation;
  }

  async getCategoryTranslations(categoryId: number): Promise<CategoryTranslation[]> {
    return await db.select().from(categoryTranslations).where(eq(categoryTranslations.categoryId, categoryId));
  }

  async getCategoryTranslationsBatch(categoryIds: number[], language: string): Promise<CategoryTranslation[]> {
    if (categoryIds.length === 0) return [];
    return await db.select().from(categoryTranslations)
      .where(and(
        inArray(categoryTranslations.categoryId, categoryIds),
        eq(categoryTranslations.language, language)
      ));
  }

  async getAllCategoryTranslations(): Promise<CategoryTranslation[]> {
    return await db.select().from(categoryTranslations);
  }

  async createCategoryTranslation(translation: InsertCategoryTranslation): Promise<CategoryTranslation> {
    const [newTranslation] = await db.insert(categoryTranslations).values(translation).returning();
    return newTranslation;
  }

  async updateCategoryTranslation(id: number, translation: Partial<InsertCategoryTranslation>): Promise<CategoryTranslation> {
    const [updatedTranslation] = await db
      .update(categoryTranslations)
      .set({ ...translation, updatedAt: new Date() })
      .where(eq(categoryTranslations.id, id))
      .returning();
    return updatedTranslation;
  }

  async deleteCategoryTranslation(id: number): Promise<void> {
    await db.delete(categoryTranslations).where(eq(categoryTranslations.id, id));
  }

  // Order operations
  async getOrders(userId?: number): Promise<OrderWithItems[]> {
    const query = db
      .select({
        id: orders.id,
        userId: orders.userId,
        market: orders.market,
        currency: orders.currency,
        status: orders.status,
        totalAmount: orders.totalAmount,
        shippingCost: orders.shippingCost,
        shippingAddress: orders.shippingAddress,
        billingAddress: orders.billingAddress,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        notes: orders.notes,
        awbNumber: orders.awbNumber,
        awbCourier: orders.awbCourier,
        awbCost: orders.awbCost,
        awbCurrency: orders.awbCurrency,
        awbPdfUrl: orders.awbPdfUrl,
        awbTrackingUrl: orders.awbTrackingUrl,
        awbCreatedAt: orders.awbCreatedAt,
        estimatedDelivery: orders.estimatedDelivery,
        source: orders.source,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        items: sql`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${orderItems.id},
                'orderId', ${orderItems.orderId},
                'productId', ${orderItems.productId},
                'quantity', ${orderItems.quantity},
                'price', ${orderItems.price},
                'totalPrice', ${orderItems.totalPrice},
                'compositeConfiguration', ${orderItems.compositeConfiguration},
                'product', json_build_object(
                  'id', ${products.id},
                  'name', ${products.name},
                  'slug', ${products.slug},
                  'imageUrl', ${products.imageUrl}
                )
              )
            ) FILTER (WHERE ${orderItems.id} IS NOT NULL),
            '[]'
          )
        `.as('items'),
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt));

    if (userId) {
      query.where(eq(orders.userId, userId));
    }

    const results = await query;
    return results as OrderWithItems[];
  }

  async getOrder(id: number): Promise<OrderWithItems | undefined> {
    const [order] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        market: orders.market,
        currency: orders.currency,
        status: orders.status,
        totalAmount: orders.totalAmount,
        shippingCost: orders.shippingCost,
        shippingAddress: orders.shippingAddress,
        billingAddress: orders.billingAddress,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        notes: orders.notes,
        awbNumber: orders.awbNumber,
        awbCourier: orders.awbCourier,
        awbCost: orders.awbCost,
        awbCurrency: orders.awbCurrency,
        awbPdfUrl: orders.awbPdfUrl,
        awbTrackingUrl: orders.awbTrackingUrl,
        awbCreatedAt: orders.awbCreatedAt,
        estimatedDelivery: orders.estimatedDelivery,
        source: orders.source,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        items: sql`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${orderItems.id},
                'orderId', ${orderItems.orderId},
                'productId', ${orderItems.productId},
                'quantity', ${orderItems.quantity},
                'price', ${orderItems.price},
                'totalPrice', ${orderItems.totalPrice},
                'compositeConfiguration', ${orderItems.compositeConfiguration},
                'product', json_build_object(
                  'id', ${products.id},
                  'name', ${products.name},
                  'slug', ${products.slug},
                  'imageUrl', ${products.imageUrl}
                )
              )
            ) FILTER (WHERE ${orderItems.id} IS NOT NULL),
            '[]'
          )
        `.as('items'),
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.id, id))
      .groupBy(orders.id);

    return order as OrderWithItems | undefined;
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    const orderItemsWithOrderId = items.map(item => ({
      ...item,
      orderId: newOrder.id,
    }));
    
    await db.insert(orderItems).values(orderItemsWithOrderId);
    
    return newOrder;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async acceptOrder(id: number): Promise<Order | null> {
    // Conditional claim: only succeeds when the order has NOT been claimed by manual processing.
    // This makes Accept and Manual mutually exclusive — the first one atomically wins.
    const [updatedOrder] = await db
      .update(orders)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(
        and(
          eq(orders.id, id),
          sql`(source IS NULL OR source = 'website')`
        )
      )
      .returning();
    return updatedOrder || null;
  }

  async linkGuestOrdersToUser(email: string, userId: number): Promise<number> {
    const { pool } = await import('./db.js');
    try {
      const result = await pool.query(
        `UPDATE orders SET user_id = $1, updated_at = NOW()
         WHERE user_id IS NULL 
         AND shipping_address->>'email' = $2
         RETURNING id`,
        [userId, email]
      );
      const linkedOrderIds = result.rows.map((r: any) => r.id);
      if (linkedOrderIds.length > 0) {
        await pool.query(
          `UPDATE invoices SET user_id = $1
           WHERE order_id = ANY($2) AND (user_id IS NULL OR user_id = 0)`,
          [userId, linkedOrderIds]
        );
        console.log(`🔗 Linked ${linkedOrderIds.length} guest order(s) to user ${userId} (${email}): order IDs ${linkedOrderIds.join(', ')}`);
      }
      return linkedOrderIds.length;
    } catch (error) {
      console.error('Error linking guest orders to user:', error);
      return 0;
    }
  }

  // Cart operations
  async getCartItems(userId: number): Promise<CartItemWithProduct[]> {
    const results = await db
      .select({
        id: cartItems.id,
        userId: cartItems.userId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        compositeConfiguration: cartItems.compositeConfiguration,
        createdAt: cartItems.createdAt,
        product: products,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));
    
    return results as CartItemWithProduct[];
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    // Merge only identical configurations. Different selections of the same
    // composite product must remain separate cart lines.
    const candidateItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, item.userId!), eq(cartItems.productId, item.productId!)));
    const requestedConfiguration = compositeConfigurationKey(item.compositeConfiguration);
    const existingItem = candidateItems.find(candidate =>
      compositeConfigurationKey(candidate.compositeConfiguration) === requestedConfiguration
    );

    if (existingItem) {
      // Update quantity if item exists
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + item.quantity })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      // Create new item
      const [newItem] = await db.insert(cartItems).values(item).returning();
      return newItem;
    }
  }

  async updateCartItem(id: number, userId: number, quantity: number): Promise<CartItem | undefined> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return updatedItem;
  }

  async removeFromCart(id: number, userId: number): Promise<boolean> {
    const deleted = await db.delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning({ id: cartItems.id });
    return deleted.length > 0;
  }

  async clearCart(userId: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  // Review operations
  async getProductReviews(productId: number): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    
    // Update product rating and review count
    const productReviews = await this.getProductReviews(review.productId!);
    const averageRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    
    await db
      .update(products)
      .set({ 
        rating: averageRating.toFixed(2),
        reviewCount: productReviews.length,
        updatedAt: new Date()
      })
      .where(eq(products.id, review.productId!));
    
    return newReview;
  }

  // Supplier operations
  async getSuppliers(market?: string): Promise<Supplier[]> {
    if (market && market !== 'all') {
      return await db.select().from(suppliers).where(eq(suppliers.marketCode, market)).orderBy(suppliers.name);
    }
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // Invoice operations
  async getInvoices(userId?: number): Promise<Invoice[]> {
    if (userId) {
      const directInvoices = await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
      
      const userOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
      if (userOrders.length > 0) {
        const orderIds = userOrders.map(o => o.id);
        const orderInvoices = await db.select().from(invoices)
          .where(
            and(
              inArray(invoices.orderId, orderIds),
              or(isNull(invoices.userId), ne(invoices.userId, userId))
            )
          )
          .orderBy(desc(invoices.createdAt));
        
        for (const inv of orderInvoices) {
          await db.update(invoices).set({ userId }).where(eq(invoices.id, inv.id));
          inv.userId = userId;
        }
        
        if (orderInvoices.length > 0) {
          const allInvoices = [...directInvoices, ...orderInvoices];
          allInvoices.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          return allInvoices;
        }
      }
      
      return directInvoices;
    }
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: number): Promise<InvoiceWithItems | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;

    let user = null;
    if (invoice.userId) {
      const [foundUser] = await db.select().from(users).where(eq(users.id, invoice.userId));
      user = foundUser || null;
    }

    // Get invoice items
    const items = await db.select({
      id: invoiceItems.id,
      invoiceId: invoiceItems.invoiceId,
      productId: invoiceItems.productId,
      productName: invoiceItems.productName,
      productCode: invoiceItems.productCode,
      quantity: invoiceItems.quantity,
      unitPrice: invoiceItems.unitPrice,
      vatRate: invoiceItems.vatRate,
      lineTotal: invoiceItems.lineTotal,
    }).from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

    return {
      ...invoice,
      user: user as User,
      items,
    };
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceWithItems | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber));
    if (!invoice) return undefined;

    let user = null;
    if (invoice.userId) {
      const [foundUser] = await db.select().from(users).where(eq(users.id, invoice.userId));
      user = foundUser || null;
    }

    // Get invoice items
    const items = await db.select({
      id: invoiceItems.id,
      invoiceId: invoiceItems.invoiceId,
      productId: invoiceItems.productId,
      productName: invoiceItems.productName,
      productCode: invoiceItems.productCode,
      quantity: invoiceItems.quantity,
      unitPrice: invoiceItems.unitPrice,
      vatRate: invoiceItems.vatRate,
      lineTotal: invoiceItems.lineTotal,
    }).from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));

    return {
      ...invoice,
      user: user as User,
      items,
    };
  }

  async createInvoice(invoice: InsertInvoice, items: Omit<InsertInvoiceItem, "invoiceId">[]): Promise<Invoice> {
    // Create the invoice
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    
    // Create invoice items with the invoice ID
    const itemsWithInvoiceId = items.map(item => ({
      ...item,
      invoiceId: newInvoice.id,
    }));
    
    await db.insert(invoiceItems).values(itemsWithInvoiceId);
    
    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<void> {
    // Delete invoice items first
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    // Delete the invoice
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Admin stats operations
  async getTotalUsers(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(users);
    return result.count;
  }

  async getTotalOrders(markets?: string[]): Promise<number> {
    if (markets && markets.length > 0) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(inArray(orders.market, markets));
      return result.count;
    }
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    return result.count;
  }

  async getTotalProducts(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(products);
    return result.count;
  }

  async getRecentOrders(limit: number, markets?: string[]): Promise<OrderWithItems[]> {
    const baseQuery = db.select({
      id: orders.id,
      userId: orders.userId,
      market: orders.market,
      currency: orders.currency,
      status: orders.status,
      totalAmount: orders.totalAmount,
      shippingCost: orders.shippingCost,
      shippingAddress: orders.shippingAddress,
      billingAddress: orders.billingAddress,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    }).from(orders);

    const ordersWithItems = await (markets && markets.length > 0
      ? baseQuery.where(inArray(orders.market, markets)).orderBy(desc(orders.createdAt)).limit(limit)
      : baseQuery.orderBy(desc(orders.createdAt)).limit(limit));

    const result: OrderWithItems[] = [];
    for (const order of ordersWithItems) {
      const items = await db.select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        totalPrice: orderItems.totalPrice,
        compositeConfiguration: orderItems.compositeConfiguration,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          price: products.price,
          compareAtPrice: products.compareAtPrice,
          categoryId: products.categoryId,
          supplierId: products.supplierId,
          imageUrl: products.imageUrl,
          images: products.images,
          inStock: products.inStock,
          stockQuantity: products.stockQuantity,
          featured: products.featured,
          rating: products.rating,
          reviewCount: products.reviewCount,
          vatValue: products.vatValue,
          vatPercentage: products.vatPercentage,
          currency: products.currency,
          productCode: products.productCode,
          ncCode: products.ncCode,
          cpvCode: products.cpvCode,
          status: products.status,
          weight: products.weight,
          length: products.length,
          width: products.width,
          height: products.height,
          piecesPerPackage: products.piecesPerPackage,
          productQuantity: products.productQuantity,
          specs: products.specs,
          volumeDiscounts: products.volumeDiscounts,
          isService: products.isService,
          isComposite: products.isComposite,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        }
      }).from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          compositeConfiguration: item.compositeConfiguration as CompositeConfiguration | null,
          product: item.product as unknown as Product
        }))
      } as unknown as OrderWithItems);
    }

    return result;
  }

  // Company settings operations
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings;
  }

  async getCompanySettingsByMarket(market: string): Promise<CompanySettings | undefined> {
    // Exact-match only — no cross-market fallback to preserve per-market data isolation
    const [marketRow] = await db.select().from(companySettings).where(eq(companySettings.marketCode, market)).limit(1);
    return marketRow;
  }

  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    // Check if settings exist
    const existing = await this.getCompanySettings();
    
    if (existing) {
      // Update existing settings
      const [updatedSettings] = await db
        .update(companySettings)
        .set({ ...settings, updatedAt: new Date() } as any)
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updatedSettings;
    } else {
      // Create new settings if none exist
      const [newSettings] = await db.insert(companySettings).values([settings] as any).returning();
      return newSettings;
    }
  }

  // Shipping settings operations
  async getShippingSettings(): Promise<ShippingSettings | undefined> {
    const [settings] = await db.select().from(shippingSettings).limit(1);
    return settings;
  }

  async updateShippingSettings(settings: Partial<InsertShippingSettings>): Promise<ShippingSettings> {
    // Check if settings exist
    const existing = await this.getShippingSettings();
    
    if (existing) {
      // Update existing settings
      const [updatedSettings] = await db
        .update(shippingSettings)
        .set({ ...settings, updatedAt: new Date() } as any)
        .where(eq(shippingSettings.id, existing.id))
        .returning();
      return updatedSettings;
    } else {
      // Create new settings if none exist
      const [newSettings] = await db.insert(shippingSettings).values([settings] as any).returning();
      return newSettings;
    }
  }

  async createShippingSettings(settings: InsertShippingSettings): Promise<ShippingSettings> {
    const [newSettings] = await db.insert(shippingSettings).values([settings]).returning();
    return newSettings;
  }

  // Voucher operations
  async getVouchers(market?: string): Promise<Voucher[]> {
    if (market && market !== 'all') {
      return db.select().from(vouchers).where(eq(vouchers.marketCode, market)).orderBy(desc(vouchers.createdAt));
    }
    return db.select().from(vouchers).orderBy(desc(vouchers.createdAt));
  }

  async getVoucher(id: number): Promise<Voucher | undefined> {
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return voucher;
  }

  async getVoucherByCode(code: string, market?: string): Promise<Voucher | undefined> {
    if (market && market !== 'all') {
      // Strict market match — no cross-market fallback
      const [voucher] = await db.select().from(vouchers).where(
        and(eq(vouchers.code, code.toUpperCase()), eq(vouchers.marketCode, market))
      );
      return voucher;
    }
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.code, code.toUpperCase()));
    return voucher;
  }

  async createVoucher(voucher: InsertVoucher): Promise<Voucher> {
    const [newVoucher] = await db.insert(vouchers).values({
      ...voucher,
      code: voucher.code.toUpperCase(),
    }).returning();
    return newVoucher;
  }

  async updateVoucher(id: number, voucher: Partial<InsertVoucher>): Promise<Voucher> {
    const updateData = {
      ...voucher,
      updatedAt: new Date(),
    };
    if (voucher.code) {
      updateData.code = voucher.code.toUpperCase();
    }
    const [updated] = await db.update(vouchers).set(updateData).where(eq(vouchers.id, id)).returning();
    return updated;
  }

  async deleteVoucher(id: number): Promise<void> {
    await db.delete(vouchers).where(eq(vouchers.id, id));
  }

  async incrementVoucherUsage(id: number): Promise<Voucher> {
    const [updated] = await db.update(vouchers)
      .set({ 
        usedCount: sql`${vouchers.usedCount} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(vouchers.id, id))
      .returning();
    return updated;
  }

  // Blog post operations
  async getBlogPosts(options?: { published?: boolean; language?: string; marketCode?: string; limit?: number; offset?: number }): Promise<BlogPost[]> {
    let query = db.select().from(blogPosts).$dynamic();
    const conditions = [];
    if (options?.published !== undefined) {
      conditions.push(eq(blogPosts.published, options.published));
    }
    if (options?.marketCode) {
      // Filter by market_code; legacy rows with NULL market_code are treated as 'ro'
      if (options.marketCode === 'ro') {
        conditions.push(
          or(eq(blogPosts.marketCode, 'ro'), isNull(blogPosts.marketCode))
        );
      } else {
        conditions.push(eq(blogPosts.marketCode, options.marketCode));
      }
    } else if (options?.language) {
      // Fallback: filter by language if no marketCode provided
      conditions.push(eq(blogPosts.language, options.language));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    query = query.orderBy(desc(blogPosts.publishedAt));
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }
    return query;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db.insert(blogPosts).values(post).returning();
    return created;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updated] = await db.update(blogPosts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogPostTranslations(blogPostId: number): Promise<BlogPostTranslation[]> {
    try {
      return await db.select().from(blogPostTranslations).where(eq(blogPostTranslations.blogPostId, blogPostId));
    } catch { return []; }
  }

  async getBlogPostTranslation(blogPostId: number, language: string): Promise<BlogPostTranslation | undefined> {
    try {
      const [t] = await db.select().from(blogPostTranslations)
        .where(and(eq(blogPostTranslations.blogPostId, blogPostId), eq(blogPostTranslations.language, language)));
      return t;
    } catch { return undefined; }
  }

  async upsertBlogPostTranslation(blogPostId: number, language: string, data: { title: string; excerpt: string; content: string }): Promise<BlogPostTranslation> {
    try {
      const [existing] = await db.select().from(blogPostTranslations)
        .where(and(eq(blogPostTranslations.blogPostId, blogPostId), eq(blogPostTranslations.language, language)));
      if (existing) {
        const [updated] = await db.update(blogPostTranslations)
          .set(data)
          .where(and(eq(blogPostTranslations.blogPostId, blogPostId), eq(blogPostTranslations.language, language)))
          .returning();
        return updated;
      }
      const [created] = await db.insert(blogPostTranslations)
        .values({ blogPostId, language, ...data })
        .returning();
      return created;
    } catch (err) {
      console.error("[Storage] upsertBlogPostTranslation error:", err);
      throw err;
    }
  }

  // Market settings operations
  async getMarketSettings(): Promise<MarketSettings[]> {
    return await db.select().from(marketSettings).orderBy(marketSettings.market);
  }

  async getMarketSetting(market: string): Promise<MarketSettings | undefined> {
    const [row] = await db.select().from(marketSettings).where(eq(marketSettings.market, market));
    return row;
  }

  async upsertMarketSettings(market: string, settings: Partial<InsertMarketSettings>): Promise<MarketSettings> {
    const existing = await this.getMarketSetting(market);
    if (existing) {
      const [updated] = await db.update(marketSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(marketSettings.market, market))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(marketSettings)
        .values({ market, label: settings.label || market, ...settings })
        .returning();
      return created;
    }
  }

  async deleteMarketSettings(market: string): Promise<void> {
    await db.delete(marketSettings).where(eq(marketSettings.market, market));
  }

  // Product market operations
  async getProductMarkets(productId: number): Promise<ProductMarket[]> {
    return await db.select().from(productMarkets).where(eq(productMarkets.productId, productId));
  }

  async getProductMarketsByMarket(market: string): Promise<ProductMarket[]> {
    return await db.select().from(productMarkets).where(eq(productMarkets.market, market));
  }

  async setProductMarket(data: InsertProductMarket): Promise<ProductMarket> {
    // Upsert: if entry exists update it, otherwise insert
    const [existing] = await db.select().from(productMarkets)
      .where(and(eq(productMarkets.productId, data.productId!), eq(productMarkets.market, data.market)));
    if (existing) {
      const [updated] = await db.update(productMarkets)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(productMarkets.productId, data.productId!), eq(productMarkets.market, data.market)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(productMarkets).values(data).returning();
      return created;
    }
  }

  async updateProductMarket(productId: number, market: string, data: Partial<InsertProductMarket>): Promise<ProductMarket> {
    const [updated] = await db.update(productMarkets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(productMarkets.productId, productId), eq(productMarkets.market, market)))
      .returning();
    return updated;
  }

  async deleteProductMarket(productId: number, market: string): Promise<void> {
    await db.delete(productMarkets)
      .where(and(eq(productMarkets.productId, productId), eq(productMarkets.market, market)));
  }

  async getProductsForMarket(market: string): Promise<number[]> {
    const rows = await db.select({ productId: productMarkets.productId })
      .from(productMarkets)
      .where(and(eq(productMarkets.market, market), eq(productMarkets.isActive, true)));
    return rows.map(r => r.productId);
  }

  async getCompositeProductComponents(parentProductId: number, market: string): Promise<Array<CompositeProductComponent & { product: Product; marketPrice: string | null; marketCurrency: string | null; marketIsActive: boolean | null }>> {
    const rows = await db
      .select({
        relation: compositeProductComponents,
        product: products,
        marketPrice: productMarkets.price,
        marketCurrency: productMarkets.currency,
        marketIsActive: productMarkets.isActive,
      })
      .from(compositeProductComponents)
      .innerJoin(products, eq(compositeProductComponents.componentProductId, products.id))
      .innerJoin(productMarkets, and(
        eq(productMarkets.productId, products.id),
        eq(productMarkets.market, market),
      ))
      .where(and(
        eq(compositeProductComponents.parentProductId, parentProductId),
        eq(compositeProductComponents.market, market),
      ))
      .orderBy(compositeProductComponents.sortOrder, compositeProductComponents.id);

    return rows.map(row => ({
      ...row.relation,
      product: row.product,
      marketPrice: row.marketPrice,
      marketCurrency: row.marketCurrency,
      marketIsActive: row.marketIsActive,
    }));
  }

  async replaceCompositeProductComponents(parentProductId: number, market: string, componentProductIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(compositeProductComponents).where(and(
        eq(compositeProductComponents.parentProductId, parentProductId),
        eq(compositeProductComponents.market, market),
      ));
      if (componentProductIds.length > 0) {
        await tx.insert(compositeProductComponents).values(
          componentProductIds.map((componentProductId, sortOrder) => ({
            parentProductId,
            componentProductId,
            market,
            sortOrder,
          })),
        );
      }
    });
  }
}

export const storage = new DatabaseStorage();

// Server-side slug generation (same algorithm as client/src/lib/slug-utils.ts)
function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[''ʼ`'\u2018\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Backfill: generate slugs for any product_translations row that has none.
 * Safe to run on every startup — skips rows that already have a slug.
 */
export async function backfillTranslationSlugs(): Promise<void> {
  try {
    const rows = await db
      .select({ id: productTranslations.id, name: productTranslations.name })
      .from(productTranslations)
      .where(or(isNull(productTranslations.slug), eq(productTranslations.slug, '')));

    if (rows.length === 0) return;

    let count = 0;
    for (const row of rows) {
      const slug = toSlug(row.name);
      if (!slug) continue;
      await db
        .update(productTranslations)
        .set({ slug })
        .where(eq(productTranslations.id, row.id));
      count++;
    }
    console.log(`✅ Backfilled ${count} translation slugs`);
  } catch (err) {
    console.error('⚠️  backfillTranslationSlugs failed (non-fatal):', err);
  }
}
