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

/**
 * Keeps only campaign products that are already present in the active,
 * market-filtered catalog. Featured products rank first, followed by positive
 * display priorities (1 is highest); selection order breaks remaining ties.
 */
export function rankAIPromotionProducts(
  products: AIMarketProduct[],
  selectedProductIds: Array<number | string>,
): AIMarketProduct[] {
  const selectionOrder = new Map(
    selectedProductIds.map((id, index) => [String(id), index]),
  );
  const displayPriority = (product: AIMarketProduct): number => {
    const priority = Number(product.priority);
    return Number.isFinite(priority) && priority > 0 ? priority : Number.POSITIVE_INFINITY;
  };

  return products
    .filter((product) => selectionOrder.has(String(product.id)))
    .sort((a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured))
      || displayPriority(a) - displayPriority(b)
      || (selectionOrder.get(String(a.id)) ?? 0) - (selectionOrder.get(String(b.id)) ?? 0),
    )
    .slice(0, 3);
}