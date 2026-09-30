export function getActiveProductMarketRow<TRow extends { isActive?: boolean | null }>(
  productMarketsByProduct: ReadonlyMap<number, ReadonlyMap<string, TRow>>,
  productId: number,
  market: string,
): TRow | null {
  const productMarketRows = productMarketsByProduct.get(productId);
  if (!productMarketRows || productMarketRows.size === 0) return null;

  const marketRow = productMarketRows.get(market);
  if (!marketRow || marketRow.isActive === false) return null;
  return marketRow;
}