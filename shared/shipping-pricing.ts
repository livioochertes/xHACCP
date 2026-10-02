export interface ShippingPricedItem {
  productType?: unknown;
  isService?: unknown;
  displayTotalPrice?: number | string | null;
}

export interface ShippingQuote {
  hasShippableItems: boolean;
  shippableSubtotal: number;
  shippingCost: number;
}

export function isShippableProduct(
  product: Pick<ShippingPricedItem, "productType" | "isService"> | null | undefined,
): boolean {
  if (!product) return false;

  const productType = String(product.productType ?? "").trim().toLowerCase();
  return productType !== "service" && product.isService !== true;
}

export function calculateShippingQuote(
  items: readonly ShippingPricedItem[],
  freeShippingThreshold: number,
  standardShippingCost: number,
): ShippingQuote {
  let hasShippableItems = false;
  let shippableSubtotal = 0;

  for (const item of items) {
    if (!isShippableProduct(item)) continue;
    hasShippableItems = true;

    const amount = Number(item.displayTotalPrice ?? 0);
    if (Number.isFinite(amount)) shippableSubtotal += amount;
  }

  return {
    hasShippableItems,
    shippableSubtotal,
    shippingCost: !hasShippableItems || shippableSubtotal > freeShippingThreshold
      ? 0
      : standardShippingCost,
  };
}