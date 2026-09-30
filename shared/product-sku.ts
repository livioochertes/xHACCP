export type ProductSkuSource = {
  id: number;
  productCode?: string | null;
};

export function getProductSku(product: ProductSkuSource): string {
  const productCode = product.productCode?.trim();
  return productCode || `KP-${product.id}`;
}