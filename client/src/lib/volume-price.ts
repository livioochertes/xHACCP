export interface VolumeTier {
  minQty: number;
  discountPercent: number;
}

/** Return the sorted (desc by minQty) valid tiers from a product */
export function getSortedTiers(volumeDiscounts: unknown): VolumeTier[] {
  if (!Array.isArray(volumeDiscounts)) return [];
  return (volumeDiscounts as VolumeTier[])
    .filter(t => t && t.minQty > 0 && t.discountPercent > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

/** Return the active tier for a given quantity (highest minQty that qty satisfies) */
export function getActiveTier(quantity: number, volumeDiscounts: unknown): VolumeTier | null {
  const tiers = getSortedTiers(volumeDiscounts);
  let active: VolumeTier | null = null;
  for (const t of tiers) {
    if (quantity >= t.minQty) active = t;
  }
  return active;
}

/** Return the effective unit price given base price, quantity and discount tiers */
export function getVolumePrice(basePrice: string | number, quantity: number, volumeDiscounts: unknown): number {
  const base = parseFloat(String(basePrice));
  const tier = getActiveTier(quantity, volumeDiscounts);
  if (!tier) return base;
  return parseFloat((base * (1 - tier.discountPercent / 100)).toFixed(2));
}

/** Return effective unit price as a formatted string (same precision as original) */
export function getVolumePriceStr(basePrice: string | number, quantity: number, volumeDiscounts: unknown): string {
  return getVolumePrice(basePrice, quantity, volumeDiscounts).toFixed(2);
}
