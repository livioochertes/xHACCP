import {
  calculateOrderTaxSnapshot,
  normalizePriceDisplayMode,
  pricePairFromDisplayPrice,
  resolveMarketPricePair,
  type OrderTaxSnapshot,
  type PriceDisplayMode,
} from "@shared/market-pricing";
import { getVolumePrice } from "@/lib/volume-price";

export interface CartLinePrice {
  displayPrice: number;
  priceNet: number;
  priceGross: number;
  priceDisplayMode: PriceDisplayMode;
  vatPercentage: number;
}

export function getCartLinePrice(
  item: { product: any; quantity: number; compositeConfiguration?: any },
  market: string,
  defaultVatPercentage: number,
): CartLinePrice {
  const configuration = item.compositeConfiguration;
  const mode = normalizePriceDisplayMode(
    configuration?.priceDisplayMode ?? item.product?.priceDisplayMode,
    market,
  );
  const candidateVat = Number(
    configuration?.vatPercentage ??
      item.product?.vatPercentage ??
      defaultVatPercentage,
  );
  const vatPercentage = Number.isFinite(candidateVat) ? Math.max(0, candidateVat) : 0;

  if (configuration && (
    configuration.totalPriceNet != null ||
    configuration.totalPriceGross != null
  )) {
    const pair = resolveMarketPricePair({
      market,
      price: configuration.totalPrice,
      priceNet: configuration.totalPriceNet,
      priceGross: configuration.totalPriceGross,
      priceDisplayMode: mode,
      vatPercentage,
    });
    return {
      displayPrice: Number(configuration.totalPrice ?? pair.displayPrice),
      priceNet: pair.priceNet,
      priceGross: pair.priceGross,
      priceDisplayMode: mode,
      vatPercentage,
    };
  }

  const displayPrice = getVolumePrice(
    String(item.product?.price ?? "0"),
    item.quantity,
    item.product?.volumeDiscounts,
  );
  const pair = pricePairFromDisplayPrice(displayPrice, mode, vatPercentage);
  return {
    displayPrice: pair.displayPrice,
    priceNet: pair.priceNet,
    priceGross: pair.priceGross,
    priceDisplayMode: mode,
    vatPercentage,
  };
}

export function getCartTaxSnapshot(
  items: Array<{ product: any; quantity: number; compositeConfiguration?: any }>,
  market: string,
  defaultVatPercentage: number,
  discountAmount: number,
  shippingGrossAmount: number,
): OrderTaxSnapshot {
  const lines = items
    .filter(item => item.product && item.product.price != null)
    .map(item => {
      const price = getCartLinePrice(item, market, defaultVatPercentage);
      return {
        priceDisplayMode: price.priceDisplayMode,
        displayTotalPrice: price.displayPrice * item.quantity,
        totalPriceNet: price.priceNet * item.quantity,
        totalPriceGross: price.priceGross * item.quantity,
      };
    });
  return calculateOrderTaxSnapshot(
    lines,
    discountAmount,
    shippingGrossAmount,
    defaultVatPercentage,
  );
}