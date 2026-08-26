import type { CompositeConfiguration, CompositeSelectionItem, Product } from "@shared/schema";

export const MAX_COMPOSITE_COMPONENTS = 8;
export const MAX_COMPONENT_QUANTITY = 9999;

export type CompositeComponentSource = {
  product: Product;
  marketPrice: string | null;
  marketCurrency: string | null;
  marketStockQuantity?: number | null;
  sortOrder: number;
};

export type RequestedCompositeComponent = {
  componentProductId: number;
  quantity: number;
};

export function calculateCompositeStockQuantity(available: CompositeComponentSource[]): number {
  return available.reduce((total, source) => {
    const rawStock = source.marketStockQuantity ?? source.product.stockQuantity ?? 0;
    const stock = Number(rawStock);
    return total + (Number.isFinite(stock) && stock > 0 ? Math.trunc(stock) : 0);
  }, 0);
}

export function resolveCompositeStockQuantity(
  manualStockQuantity: unknown,
  available: CompositeComponentSource[],
): number {
  const manualStock = Number(manualStockQuantity);
  if (Number.isFinite(manualStock) && manualStock > 0) {
    return Math.trunc(manualStock);
  }
  return calculateCompositeStockQuantity(available);
}

export function normalizeRequestedCompositeComponents(input: unknown): RequestedCompositeComponent[] {
  if (!Array.isArray(input)) {
    throw new Error("Composite components are required");
  }

  const seen = new Set<number>();
  const normalized: RequestedCompositeComponent[] = [];
  for (const raw of input) {
    const componentProductId = Number((raw as any)?.componentProductId);
    const quantity = Number((raw as any)?.quantity);
    if (!Number.isInteger(componentProductId) || componentProductId <= 0) {
      throw new Error("Invalid composite component");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_COMPONENT_QUANTITY) {
      throw new Error(`Component quantity must be between 1 and ${MAX_COMPONENT_QUANTITY}`);
    }
    if (seen.has(componentProductId)) {
      throw new Error("A component can only be selected once");
    }
    seen.add(componentProductId);
    normalized.push({ componentProductId, quantity });
  }

  if (normalized.length === 0) {
    throw new Error("Select at least one component");
  }
  if (normalized.length > MAX_COMPOSITE_COMPONENTS) {
    throw new Error(`A composite product can contain at most ${MAX_COMPOSITE_COMPONENTS} components`);
  }
  return normalized;
}

export function calculateCompositeConfiguration(
  available: CompositeComponentSource[],
  requestedInput: unknown,
  defaultCurrency: string,
  applyDiscount: (basePrice: number, quantity: number, tiers: unknown) => number,
  compositePrice?: unknown,
): CompositeConfiguration {
  const requested = normalizeRequestedCompositeComponents(requestedInput);
  const requestedById = new Map(requested.map(item => [item.componentProductId, item.quantity]));
  const availableIds = new Set(available.map(item => item.product.id));

  for (const item of requested) {
    if (!availableIds.has(item.componentProductId)) {
      throw new Error(`Component ${item.componentProductId} is not configured for this product`);
    }
  }

  const currencies = new Set<string>();
  const components: CompositeSelectionItem[] = [];
  let total = 0;

  for (const source of [...available].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const quantity = requestedById.get(source.product.id);
    if (!quantity) continue;

    // Composite membership explicitly permits inactive simple products. We
    // intentionally use the market price row even when that row is inactive.
    const basePrice = Number(source.marketPrice ?? source.product.price);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw new Error(`Invalid price for component ${source.product.name}`);
    }
    const currency = source.marketCurrency || source.product.currency || defaultCurrency;
    if (source.marketPrice == null && source.product.currency !== currency) {
      throw new Error(`Component ${source.product.name} requires an explicit ${currency} market price`);
    }
    if (currency !== defaultCurrency) {
      throw new Error(`Component ${source.product.name} does not use the ${defaultCurrency} marketplace currency`);
    }
    currencies.add(currency);

    const unitPrice = applyDiscount(basePrice, quantity, source.product.volumeDiscounts);
    const lineTotal = unitPrice * quantity;
    total += lineTotal;
    components.push({
      componentProductId: source.product.id,
      quantity,
      name: source.product.name,
      productCode: source.product.productCode,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: lineTotal.toFixed(2),
    });
  }

  if (currencies.size > 1) {
    throw new Error("All composite components must use the same currency");
  }

  const configuredCompositePrice = Number(compositePrice);
  const totalPrice = compositePrice !== undefined && compositePrice !== null &&
    Number.isFinite(configuredCompositePrice) && configuredCompositePrice >= 0
    ? configuredCompositePrice.toFixed(2)
    : total.toFixed(2);

  return {
    components,
    currency: [...currencies][0] || defaultCurrency,
    totalPrice,
  };
}

export function compositeConfigurationKey(configuration: CompositeConfiguration | null | undefined): string {
  if (!configuration?.components?.length) return "";
  return configuration.components
    .map(item => `${item.componentProductId}:${item.quantity}`)
    .sort()
    .join("|");
}