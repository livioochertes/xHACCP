export interface AIMarketProduct {
  id: number | string;
  name?: string | null;
  slug?: string | null;
  price?: number | string | null;
  currency?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  [key: string]: unknown;
}

export type AIMarketOverlay = (
  product: AIMarketProduct,
  market: string,
) => AIMarketProduct | null;

/**
 * Returns every active product that is available in the requested market.
 * Market overlays are applied before the data is formatted for the model so
 * prices, currencies, and availability all come from the same source.
 */
export function buildAIMarketCatalog(
  products: AIMarketProduct[],
  market: string,
  applyMarketOverlay: AIMarketOverlay,
): AIMarketProduct[] {
  return products
    .filter((product) =>
      product.status?.toLowerCase() === "active" || product.isActive === true,
    )
    .map((product) => applyMarketOverlay(product, market))
    .filter((product): product is AIMarketProduct => product !== null);
}

export function formatAIMarketCatalog(
  products: AIMarketProduct[],
  fallbackCurrency: string,
): string {
  return products
    .map((product) =>
      `${product.name ?? "Unnamed product"} | ${product.price ?? "N/A"} ${product.currency || fallbackCurrency} | ID: ${product.id} | Slug: ${product.slug ?? ""}`,
    )
    .join("\n");
}