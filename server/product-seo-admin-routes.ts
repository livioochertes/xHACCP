import type { Express, Request, RequestHandler } from "express";
import { Response } from "express";
import rateLimit from "express-rate-limit";
import type { ProductSeoContext, ProductSeoDraft } from "./ai-product-seo";

type ProductSeoMarket = "ro" | "fr" | "com";

export interface ProductSeoAdminRouteDependencies {
  authenticateAdmin: RequestHandler;
  isGeneratorConfigured: () => boolean;
  canAccessMarket: (req: Request, market: string) => boolean;
  canAccessProductForMarket: (req: Request, productId: number, market?: string) => Promise<boolean>;
  getProduct: (productId: number) => Promise<any>;
  getProducts: (options: { categoryId: number; limit: number }) => Promise<any[]>;
  getProductTranslation: (productId: number, language: string) => Promise<any>;
  getActiveProductIdsForMarket: (market: ProductSeoMarket) => Promise<number[]>;
  getTranslationOwner: (translationId: number) => Promise<{ productId: number } | undefined>;
  createProductTranslation: (translation: Record<string, unknown>) => Promise<any>;
  updateProductTranslation: (translationId: number, translation: Record<string, unknown>) => Promise<any>;
  generateProductSeoDraft: (context: ProductSeoContext) => Promise<ProductSeoDraft>;
}

function normalizeProductSeoSources(value: unknown): Array<{ title: string; url: string }> {
  if (!Array.isArray(value)) return [];
  const sources: Array<{ title: string; url: string }> = [];
  const seenUrls = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rawUrl = (item as { url?: unknown }).url;
    if (typeof rawUrl !== "string" || rawUrl.length > 2048) continue;
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || seenUrls.has(url.href)) continue;
      seenUrls.add(url.href);
      const rawTitle = (item as { title?: unknown }).title;
      sources.push({
        title: typeof rawTitle === "string" && rawTitle.trim()
          ? rawTitle.trim().slice(0, 255)
          : url.href,
        url: url.href,
      });
      if (sources.length >= 8) break;
    } catch {
      // Ignore malformed source URLs; only external HTTPS references are useful provenance.
    }
  }
  return sources;
}

export function registerProductSeoAdminRoutes(
  app: Express,
  dependencies: ProductSeoAdminRouteDependencies,
) {
  const {
    authenticateAdmin,
    isGeneratorConfigured,
    canAccessMarket,
    canAccessProductForMarket,
    getProduct,
    getProducts,
    getProductTranslation,
    getActiveProductIdsForMarket,
    getTranslationOwner,
    createProductTranslation,
    updateProductTranslation,
    generateProductSeoDraft,
  } = dependencies;

  app.post("/admin/api/products/generate-seo", authenticateAdmin, rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
  }), async (req: Request, res: Response) => {
    try {
      if (!isGeneratorConfigured()) {
        return res.status(503).json({ message: "ANTHROPIC_API_KEY nu este configurat" });
      }
      const { productId: rawProductId, market: rawMarket, product: draftProduct } = req.body || {};
      const market: ProductSeoMarket | null = rawMarket === "fr" || rawMarket === "com" || rawMarket === "ro"
        ? rawMarket
        : null;
      if (!market) return res.status(400).json({ message: "Selectează o piață validă" });
      if (!canAccessMarket(req, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      let product: any = draftProduct && typeof draftProduct === "object" ? draftProduct : null;
      let productId: number | null = null;
      if (rawProductId !== undefined && rawProductId !== null) {
        productId = Number(rawProductId);
        if (!Number.isSafeInteger(productId) || productId <= 0) {
          return res.status(400).json({ message: "Invalid product ID" });
        }
        if (!await canAccessProductForMarket(req, productId, market)) {
          return res.status(403).json({ message: "Access denied for this product market" });
        }
        product = await getProduct(productId);
      }
      if (!product?.name) return res.status(400).json({ message: "Product name is required" });

      const language = market === "fr" ? "fr" : market === "ro" ? "ro" : "en";
      const currentTranslation = productId ? await getProductTranslation(productId, language) : null;
      if (currentTranslation?.name) product = { ...product, name: currentTranslation.name };
      if (currentTranslation?.description) product = { ...product, description: currentTranslation.description };

      const visibleIds = new Set(await getActiveProductIdsForMarket(market));
      const categoryId = Number(product.categoryId) || undefined;
      const candidates = categoryId
        ? (await getProducts({ categoryId, limit: 1000 }))
          .filter(candidate => candidate.id !== productId
            && candidate.status?.toLowerCase() === "active"
            && visibleIds.has(candidate.id))
          .slice(0, 5)
        : [];
      const relatedProducts = await Promise.all(candidates.map(async candidate => {
        const translation = await getProductTranslation(candidate.id, language);
        return {
          name: translation?.name || candidate.name,
          description: String(translation?.description || candidate.description || "")
            .replace(/<[^>]*>/g, "")
            .slice(0, 700),
        };
      }));

      const result = await generateProductSeoDraft({
        product: {
          name: product.name,
          description: product.descriptionHtml || product.description || "",
          category: product.category?.name || product.category || "",
          specs: product.specs || [],
          piecesPerPackage: product.piecesPerPackage || null,
          productQuantity: product.productQuantity || null,
          dimensions: { weight: product.weight, length: product.length, width: product.width, height: product.height },
          productCode: product.productCode || null,
        },
        language,
        market,
        relatedProducts,
        useWebSearch: relatedProducts.length === 0,
      });
      return res.json({ ...result, language, usedCatalogReferences: relatedProducts.length > 0 });
    } catch (error) {
      console.error("Generate product SEO draft error:", error);
      return res.status(500).json({ message: (error as Error).message || "Failed to generate SEO draft" });
    }
  });

  app.post("/admin/api/products/:id/translations", authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const { language, name, description, slug, sourceUrl, seoSources } = req.body;
      if (!await canAccessProductForMarket(req, productId, req.body?.market || req.query.market as string | undefined)) {
        return res.status(403).json({ message: "Access denied for this product market" });
      }
      if (!language || !name) {
        return res.status(400).json({ message: "Language and name are required" });
      }

      const existingTranslation = await getProductTranslation(productId, language);
      if (existingTranslation) {
        return res.status(400).json({ message: `Translation for language '${language}' already exists` });
      }
      const translation = await createProductTranslation({
        productId,
        language,
        name,
        description: description || null,
        slug: slug || null,
        sourceUrl: sourceUrl || null,
        ...(Array.isArray(seoSources) ? { seoSources: normalizeProductSeoSources(seoSources) } : {}),
      });
      return res.status(201).json(translation);
    } catch (error) {
      console.error("Error creating product translation:", error);
      return res.status(500).json({ message: "Failed to create translation" });
    }
  });

  app.put("/admin/api/products/translations/:id", authenticateAdmin, async (req: Request, res: Response) => {
    try {
      const translationId = parseInt(req.params.id);
      const { language, name, description, slug, sourceUrl, seoSources } = req.body;
      const translationOwner = await getTranslationOwner(translationId);
      if (!translationOwner || !await canAccessProductForMarket(
        req,
        translationOwner.productId,
        req.body?.market || req.query.market as string | undefined,
      )) {
        return res.status(403).json({ message: "Access denied for this product market" });
      }
      const translation = await updateProductTranslation(translationId, {
        language,
        name,
        description,
        slug,
        sourceUrl,
        ...(Array.isArray(seoSources) ? { seoSources: normalizeProductSeoSources(seoSources) } : {}),
      });
      return res.json(translation);
    } catch (error) {
      console.error("Error updating translation:", error);
      return res.status(500).json({ message: "Failed to update translation" });
    }
  });
}
