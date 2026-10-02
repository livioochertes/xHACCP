export type PriceDisplayMode = "net" | "gross";

export interface MarketPricePairInput {
  market?: string;
  price?: unknown;
  priceNet?: unknown;
  priceGross?: unknown;
  priceDisplayMode?: unknown;
  vatPercentage?: unknown;
}

export interface MarketPricePair {
  priceNet: number;
  priceGross: number;
  displayPrice: number;
  priceDisplayMode: PriceDisplayMode;
  vatPercentage: number;
}

export interface TaxableOrderLine {
  priceDisplayMode: PriceDisplayMode;
  displayTotalPrice: number | string;
  totalPriceNet: number | string;
  totalPriceGross: number | string;
}

export interface OrderTaxSnapshot {
  subtotalDisplay: string;
  subtotalNet: string;
  subtotalGross: string;
  totalNetAmount: string;
  discountAmount: string;
  discountNetAmount: string;
  discountGrossAmount: string;
  shippingNetAmount: string;
  shippingVatAmount: string;
  vatAmount: string;
  totalAmount: string;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function moneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

export function defaultPriceDisplayMode(market: string): PriceDisplayMode {
  return market.toLowerCase() === "fr" ? "net" : "gross";
}

export function normalizePriceDisplayMode(value: unknown, market = "ro"): PriceDisplayMode {
  return value === "net" || value === "gross" ? value : defaultPriceDisplayMode(market);
}

export function resolveMarketPricePair(input: MarketPricePairInput): MarketPricePair {
  const vat = Number(input.vatPercentage);
  const vatPercentage = Number.isFinite(vat) ? Math.max(0, vat) : 0;
  const priceDisplayMode = normalizePriceDisplayMode(input.priceDisplayMode, input.market);
  const netProvided = input.priceNet !== null && input.priceNet !== undefined && input.priceNet !== "";
  const grossProvided = input.priceGross !== null && input.priceGross !== undefined && input.priceGross !== "";
  const net = netProvided ? Number(input.priceNet) : Number.NaN;
  const gross = grossProvided ? Number(input.priceGross) : Number.NaN;
  const legacyPrice = Number(input.price);
  const rate = 1 + vatPercentage / 100;

  let priceNet: number;
  let priceGross: number;
  if (netProvided && grossProvided) {
    priceNet = roundMoney(net);
    priceGross = roundMoney(gross);
  } else if (netProvided) {
    priceNet = roundMoney(net);
    priceGross = roundMoney(priceNet * rate);
  } else if (grossProvided) {
    priceGross = roundMoney(gross);
    priceNet = rate === 0 ? priceGross : roundMoney(priceGross / rate);
  } else if (priceDisplayMode === "net") {
    priceNet = roundMoney(legacyPrice);
    priceGross = roundMoney(priceNet * rate);
  } else {
    priceGross = roundMoney(legacyPrice);
    priceNet = rate === 0 ? priceGross : roundMoney(priceGross / rate);
  }

  return {
    priceNet,
    priceGross,
    displayPrice: priceDisplayMode === "net" ? priceNet : priceGross,
    priceDisplayMode,
    vatPercentage,
  };
}

export function pricePairFromDisplayPrice(
  displayPrice: number,
  priceDisplayMode: PriceDisplayMode,
  vatPercentage: number,
): Pick<MarketPricePair, "priceNet" | "priceGross" | "displayPrice"> {
  const safeDisplayPrice = roundMoney(displayPrice);
  const rate = 1 + Math.max(0, vatPercentage) / 100;
  if (priceDisplayMode === "net") {
    return {
      priceNet: safeDisplayPrice,
      priceGross: roundMoney(safeDisplayPrice * rate),
      displayPrice: safeDisplayPrice,
    };
  }
  return {
    priceNet: rate === 0 ? safeDisplayPrice : roundMoney(safeDisplayPrice / rate),
    priceGross: safeDisplayPrice,
    displayPrice: safeDisplayPrice,
  };
}

const toCents = (value: number | string): number => Math.round((Number(value) + Number.EPSILON) * 100);
const fromCents = (value: number): string => (value / 100).toFixed(2);

export function calculateOrderTaxSnapshot(
  lines: TaxableOrderLine[],
  requestedDiscountAmount: number,
  shippingGrossAmount: number,
  vatPercentage: number,
): OrderTaxSnapshot {
  const displayCents = lines.reduce((sum, line) => sum + toCents(line.displayTotalPrice), 0);
  const netCents = lines.reduce((sum, line) => sum + toCents(line.totalPriceNet), 0);
  const grossCents = lines.reduce((sum, line) => sum + toCents(line.totalPriceGross), 0);
  const discountCents = Math.min(displayCents, Math.max(0, toCents(requestedDiscountAmount)));
  const shippingGrossCents = Math.max(0, toCents(shippingGrossAmount));

  let discountNetCents = 0;
  let discountGrossCents = 0;
  let remainingDiscountCents = discountCents;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineDisplayCents = Math.max(0, toCents(line.displayTotalPrice));
    if (lineDisplayCents === 0 || displayCents === 0) continue;
    const allocated = index === lines.length - 1
      ? Math.min(lineDisplayCents, remainingDiscountCents)
      : Math.min(
          lineDisplayCents,
          Math.round(discountCents * lineDisplayCents / displayCents),
          remainingDiscountCents,
        );
    remainingDiscountCents -= allocated;
    const rate = 1 + Math.max(0, vatPercentage) / 100;
    if (line.priceDisplayMode === "net") {
      discountNetCents += allocated;
      discountGrossCents += Math.round(allocated * rate);
    } else {
      discountGrossCents += allocated;
      discountNetCents += rate === 0 ? allocated : Math.round(allocated / rate);
    }
  }

  // Any rounding remainder is assigned using the final line's display basis.
  if (remainingDiscountCents > 0 && lines.length > 0) {
    const lastMode = lines[lines.length - 1].priceDisplayMode;
    const rate = 1 + Math.max(0, vatPercentage) / 100;
    if (lastMode === "net") {
      discountNetCents += remainingDiscountCents;
      discountGrossCents += Math.round(remainingDiscountCents * rate);
    } else {
      discountGrossCents += remainingDiscountCents;
      discountNetCents += rate === 0 ? remainingDiscountCents : Math.round(remainingDiscountCents / rate);
    }
  }

  discountNetCents = Math.min(netCents, discountNetCents);
  discountGrossCents = Math.min(grossCents, discountGrossCents);
  const finalGoodsNetCents = Math.max(0, netCents - discountNetCents);
  const finalGoodsGrossCents = Math.max(0, grossCents - discountGrossCents);
  const rate = 1 + Math.max(0, vatPercentage) / 100;
  const shippingNetCents = rate === 0 ? shippingGrossCents : Math.round(shippingGrossCents / rate);
  const shippingVatCents = shippingGrossCents - shippingNetCents;
  const totalNetCents = finalGoodsNetCents + shippingNetCents;
  const totalVatCents = (finalGoodsGrossCents - finalGoodsNetCents) + shippingVatCents;
  const totalGrossCents = finalGoodsGrossCents + shippingGrossCents;

  return {
    subtotalDisplay: fromCents(displayCents),
    subtotalNet: fromCents(netCents),
    subtotalGross: fromCents(grossCents),
    totalNetAmount: fromCents(totalNetCents),
    discountAmount: fromCents(discountCents),
    discountNetAmount: fromCents(discountNetCents),
    discountGrossAmount: fromCents(discountGrossCents),
    shippingNetAmount: fromCents(shippingNetCents),
    shippingVatAmount: fromCents(shippingVatCents),
    vatAmount: fromCents(totalVatCents),
    totalAmount: fromCents(totalGrossCents),
  };
}

export function getOrderTaxSummary(
  order: Record<string, unknown>,
  fallbackVatPercentage = 0,
): OrderTaxSnapshot {
  const numberOr = (value: unknown, fallback: number): number => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const totalAmount = Math.max(0, numberOr(order.totalAmount, 0));
  const vatPercentage = Math.max(0, numberOr(order.vatPercentage, fallbackVatPercentage));
  const rate = 1 + vatPercentage / 100;
  const vatAmount = Math.max(
    0,
    numberOr(order.vatAmount, rate === 0 ? 0 : totalAmount * vatPercentage / (100 + vatPercentage)),
  );
  const totalNetAmount = Math.max(0, totalAmount - vatAmount);
  const shippingGross = Math.max(0, numberOr(order.shippingCost, 0));
  const shippingNetAmount = Math.max(
    0,
    numberOr(order.shippingNetAmount, rate === 0 ? shippingGross : shippingGross / rate),
  );
  const shippingVatAmount = Math.max(
    0,
    numberOr(order.shippingVatAmount, shippingGross - shippingNetAmount),
  );
  const discountAmount = Math.max(0, numberOr(order.discountAmount, 0));
  const discountNetAmount = Math.max(
    0,
    numberOr(order.discountNetAmount, rate === 0 ? discountAmount : discountAmount / rate),
  );
  const discountGrossAmount = Math.max(
    0,
    numberOr(order.discountGrossAmount, discountAmount),
  );
  const subtotalNet = Math.max(
    0,
    numberOr(order.subtotalNet, totalNetAmount + discountNetAmount - shippingNetAmount),
  );
  const subtotalGross = Math.max(
    0,
    numberOr(order.subtotalGross, subtotalNet + (vatAmount - shippingVatAmount) + discountGrossAmount - discountNetAmount),
  );
  const subtotalDisplay = Math.max(0, numberOr(order.subtotalDisplay, subtotalGross));

  return {
    subtotalDisplay: moneyString(subtotalDisplay),
    subtotalNet: moneyString(subtotalNet),
    subtotalGross: moneyString(subtotalGross),
    totalNetAmount: moneyString(totalNetAmount),
    discountAmount: moneyString(discountAmount),
    discountNetAmount: moneyString(discountNetAmount),
    discountGrossAmount: moneyString(discountGrossAmount),
    shippingNetAmount: moneyString(shippingNetAmount),
    shippingVatAmount: moneyString(shippingVatAmount),
    vatAmount: moneyString(vatAmount),
    totalAmount: moneyString(totalAmount),
  };
}