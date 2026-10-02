import type { Request, Response } from "express";
import { moneyString, resolveMarketPricePair } from "@shared/market-pricing";

export interface AdminProductMarketRow {
  productId: number;
  [key: string]: any;
}

export interface AdminProductListRequest extends Request {
  adminMarkets?: string[];
}

export interface AdminProductListDependencies {
  canAccessMarket: (req: AdminProductListRequest, market: string) => boolean;
  getMarketRows: (markets: string[]) => Promise<AdminProductMarketRow[]>;
  getProducts: (options: {
    search?: string;
    categoryId?: number;
    featured?: boolean;
    limit: number;
    offset: number;
  }) => Promise<any[]>;
  getCategories: (market: string) => Promise<any[]>;
  getMarketSettings: () => Promise<any[]>;
  localizeCategories: (
    categories: any[],
    language: unknown,
    market?: string,
  ) => Promise<any[]>;
  getCompositeRows: (
    productIds: number[],
  ) => Promise<Array<{ id: number; isComposite: boolean | null }>>;
}

export function createAdminProductListHandler(dependencies: AdminProductListDependencies) {
  return async (req: Request, res: Response) => {
    try {
      const adminReq = req as AdminProductListRequest;
      const { search, categoryId, featured, limit = 50, offset = 0, supplierId, market, language } = req.query;
      if (market && market !== "all" && !dependencies.canAccessMarket(adminReq, market as string)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const allowedMarkets = adminReq.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;

      // Determine which markets we need to filter by before fetching products,
      // so market-scoped filtering happens before pagination.
      let marketProductIds: Set<number> | null = null;
      let marketRowByProduct: Map<number, AdminProductMarketRow> | null = null;
      if (!isSuperAdmin && (!market || market === "all")) {
        const marketRows = await dependencies.getMarketRows(allowedMarkets);
        marketProductIds = new Set(marketRows.map(row => row.productId));
        if (allowedMarkets.length === 1) {
          marketRowByProduct = new Map(marketRows.map(row => [row.productId, row]));
        }
      } else if (market && market !== "all") {
        const marketRows = await dependencies.getMarketRows([market as string]);
        marketProductIds = new Set(marketRows.map(row => row.productId));
        marketRowByProduct = new Map(marketRows.map(row => [row.productId, row]));
      }

      // Fetch all products when market filtering is active so pagination is
      // applied only after out-of-market products are removed.
      const needsMarketFilter = marketProductIds !== null;
      const fetchLimit = needsMarketFilter ? 100000 : parseInt(limit as string);
      const fetchOffset = needsMarketFilter ? 0 : parseInt(offset as string);
      let filteredProducts = await dependencies.getProducts({
        search: search as string,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        featured: featured === "true",
        limit: fetchLimit,
        offset: fetchOffset,
      });

      if (marketProductIds !== null) {
        filteredProducts = filteredProducts.filter(product => marketProductIds!.has(product.id));
      }
      if (supplierId) {
        filteredProducts = filteredProducts.filter(
          product => product.supplierId === parseInt(supplierId as string),
        );
      }
      if (needsMarketFilter) {
        const pageOffset = parseInt(offset as string);
        const pageLimit = parseInt(limit as string);
        filteredProducts = filteredProducts.slice(pageOffset, pageOffset + pageLimit);
      }

      // Apply selected-market price, currency, stock, and category overrides.
      if (marketRowByProduct) {
        const effectiveMarket = (market && market !== "all")
          ? market as string
          : allowedMarkets[0];
        const marketCategories = await dependencies.getCategories(effectiveMarket);
        const marketCategoriesById = new Map(marketCategories.map(category => [category.id, category]));
        const marketCategoriesBySlug = new Map(marketCategories.map(category => [category.slug, category]));
        let defaultCurrency: string | null = null;
        let vatPercentage = 0;
        try {
          const settings = await dependencies.getMarketSettings();
          const marketSettings = settings.find((setting: any) => setting.market === effectiveMarket);
          defaultCurrency = marketSettings?.currency || null;
          vatPercentage = Number(marketSettings?.vatPercentage ?? 0);
        } catch (error) {
          console.error("Could not load market settings for currency fallback:", error);
        }
        filteredProducts = filteredProducts.map(product => {
          const row = marketRowByProduct!.get(product.id);
          if (!row) return product;
          const marketCategory = row.categoryId != null
            ? marketCategoriesById.get(row.categoryId)
            : product.category?.slug
              ? marketCategoriesBySlug.get(product.category.slug)
              : undefined;
          const pricePair = resolveMarketPricePair({
            market: effectiveMarket,
            price: row.price ?? product.price,
            priceNet: row.priceNet,
            priceGross: row.priceGross,
            priceDisplayMode: row.priceDisplayMode,
            vatPercentage,
          });
          return {
            ...product,
            ...(marketCategory ? { categoryId: marketCategory.id, category: marketCategory } : {}),
            price: moneyString(pricePair.displayPrice),
            priceNet: moneyString(pricePair.priceNet),
            priceGross: moneyString(pricePair.priceGross),
            priceDisplayMode: pricePair.priceDisplayMode,
            vatPercentage: moneyString(pricePair.vatPercentage),
            compareAtPrice: row.compareAtPrice ?? product.compareAtPrice,
            currency: row.currency ?? defaultCurrency ?? product.currency,
            stockQuantity: row.stockQuantity ?? product.stockQuantity,
            marketIsActive: row.isActive,
          };
        });
      }

      const productCategories = filteredProducts.map(product => product.category).filter(Boolean);
      const localizedProductCategories = await dependencies.localizeCategories(
        productCategories,
        language,
        market && market !== "all"
          ? market as string
          : allowedMarkets.length === 1
            ? allowedMarkets[0]
            : undefined,
      );
      const localizedCategoryById = new Map(
        localizedProductCategories.map(category => [category.id, category]),
      );

      // The storage's lightweight projection omits this flag, which the
      // composite-product admin controls need.
      const compositeRows = filteredProducts.length
        ? await dependencies.getCompositeRows(filteredProducts.map(product => product.id))
        : [];
      const compositeById = new Map(compositeRows.map(row => [row.id, row.isComposite]));
      return res.json(filteredProducts.map(product => ({
        ...product,
        ...(product.category
          ? { category: localizedCategoryById.get(product.category.id) || product.category }
          : {}),
        isComposite: compositeById.get(product.id) ?? false,
      })));
    } catch (error) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ message: "Failed to fetch products" });
    }
  };
}