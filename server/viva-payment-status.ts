import { getVivaCredentials, type VivaMarket } from "./viva-config";

export type VivaPaymentOrderStatus = {
  MerchantTrns?: unknown;
  StateId?: unknown;
};

export type VivaPaymentOrderFetcher = (
  orderCode: string,
  market: VivaMarket,
) => Promise<VivaPaymentOrderStatus>;

export function isVivaOrderStateNonPayable(stateId: unknown): boolean {
  return Number(stateId) === 1 || Number(stateId) === 2;
}

export async function getVivaPaymentOrderStatus(
  orderCode: string,
  market: VivaMarket,
  fetcher: typeof fetch = fetch,
): Promise<VivaPaymentOrderStatus> {
  const { merchantId, apiKey } = getVivaCredentials(market);
  if (!merchantId?.trim() || !apiKey?.trim()) {
    throw new Error(`Viva ${market} order lookup credentials are incomplete`);
  }

  const response = await fetcher(
    `https://www.vivapayments.com/api/orders/${encodeURIComponent(orderCode)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Viva order status lookup failed (${response.status})`);
  }
  return await response.json() as VivaPaymentOrderStatus;
}

export async function isVivaPaymentOrderNonPayable(
  orderCode: string,
  market: VivaMarket,
  orderId: number,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const providerOrder = await getVivaPaymentOrderStatus(orderCode, market, fetcher);
  return providerOrder.MerchantTrns === `order_${orderId}` &&
    isVivaOrderStateNonPayable(providerOrder.StateId);
}
