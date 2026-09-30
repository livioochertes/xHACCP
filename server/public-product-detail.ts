import type { Request, Response } from "express";

export interface PublicProductDetailDependencies {
  getProduct: (productId: number) => Promise<any>;
  getMarket: (req: Request) => string;
  applyMarketOverlay: (product: any, market: string) => any;
  decorateCompositeProduct: (product: any, market: string) => Promise<any>;
}

export interface PublicProductSlugDependencies {
  getCachedProductBySlug: (slug: string) => any;
  getProductBySlug: (slug: string) => Promise<any>;
  getActiveProducts: () => any[];
  getMarket: (req: Request) => string;
  applyMarketOverlay: (product: any, market: string) => any;
  decorateCompositeProduct: (product: any, market: string) => Promise<any>;
}

export function createPublicProductDetailHandler(dependencies: PublicProductDetailDependencies) {
  return async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      const product = await dependencies.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      // Hide inactive products from public access (case-insensitive).
      if (product.status?.toLowerCase() !== "active") {
        return res.status(404).json({ message: "Product not found" });
      }
      const market = dependencies.getMarket(req);
      const overlaid = dependencies.applyMarketOverlay(product, market);
      if (overlaid === null) {
        return res.status(404).json({ message: "Product not available in this market" });
      }
      return res.json(await dependencies.decorateCompositeProduct(overlaid, market));
    } catch (error) {
      console.error("Get product error:", error);
      return res.status(500).json({ message: "Failed to get product" });
    }
  };
}

export function createPublicProductSlugHandler(dependencies: PublicProductSlugDependencies) {
  return async (req: Request, res: Response) => {
    try {
      const requestedSlug = req.params.slug;
      const market = dependencies.getMarket(req);
      let product = dependencies.getCachedProductBySlug(requestedSlug);

      if (product && product.status?.toLowerCase() === "active") {
        const overlaid = dependencies.applyMarketOverlay(product, market);
        if (overlaid === null) {
          return res.status(404).json({ message: "Product not available in this market" });
        }
        return res.json(await dependencies.decorateCompositeProduct(overlaid, market));
      }

      // Fall back to storage for products added since the in-memory cache was
      // loaded.
      if (!product) {
        product = await dependencies.getProductBySlug(requestedSlug);
        if (product && product.status?.toLowerCase() === "active") {
          const overlaid = dependencies.applyMarketOverlay(product, market);
          if (overlaid === null) {
            return res.status(404).json({ message: "Product not available in this market" });
          }
          return res.json(await dependencies.decorateCompositeProduct(overlaid, market));
        }
      }

      // Preserve the existing fuzzy slug fallback for legacy product URLs.
      const words = requestedSlug
        .split("-")
        .filter(word => word.length > 2 && !["rol", "set", "de", "si", "cu"].includes(word));
      if (words.length > 0) {
        const activeProducts = dependencies.getActiveProducts()
          .filter(candidate => candidate.status?.toLowerCase() === "active");
        const scored = activeProducts.map(candidate => {
          const haystack = `${candidate.slug || ""} ${candidate.name || ""}`.toLowerCase();
          const score = words.filter(word => haystack.includes(word)).length;
          return { product: candidate, score };
        }).filter(candidate => candidate.score > 0)
          .sort((left, right) => right.score - left.score);

        if (scored.length > 0) {
          const overlaid = dependencies.applyMarketOverlay(scored[0].product, market);
          if (overlaid === null) {
            return res.status(404).json({ message: "Product not available in this market" });
          }
          return res.json({
            ...(await dependencies.decorateCompositeProduct(overlaid, market)),
            _redirected: true,
            _originalSlug: requestedSlug,
          });
        }
      }

      return res.status(404).json({ message: "Product not found" });
    } catch (error) {
      console.error("Get product by slug error:", error);
      return res.status(500).json({ message: "Failed to get product" });
    }
  };
}