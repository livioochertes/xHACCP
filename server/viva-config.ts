export type VivaMarket = "ro" | "fr" | "com";

export type VivaCredentials = {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  merchantId?: string;
  sourceCode?: string;
};

const CREDENTIAL_FIELDS = [
  "API_KEY",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "MERCHANT_ID",
  "SOURCE_CODE",
] as const;

function hasAnyCredentials(prefix: string) {
  return CREDENTIAL_FIELDS.some((field) => Boolean(process.env[`${prefix}_${field}`]?.trim()));
}

/**
 * .com can use a dedicated Viva account when VIVA_COM_* is configured.
 * Until then it intentionally falls back to the shared VIVA_* account used
 * by the existing RO/COM checkout setup.
 */
function credentialPrefix(market: VivaMarket) {
  if (market === "fr") return "VIVA_FR";
  if (market === "com" && hasAnyCredentials("VIVA_COM")) return "VIVA_COM";
  return "VIVA";
}

export function getVivaCredentials(market: VivaMarket): VivaCredentials {
  const prefix = credentialPrefix(market);
  return {
    apiKey: process.env[`${prefix}_API_KEY`],
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    merchantId: process.env[`${prefix}_MERCHANT_ID`],
    sourceCode: process.env[`${prefix}_SOURCE_CODE`],
  };
}

export function getVivaCurrency(market: VivaMarket) {
  return market === "ro" ? "RON" : "EUR";
}

export function buildVivaCheckoutPayload(options: {
  market: VivaMarket;
  amountCents: number;
  orderId: number;
  baseUrl: string;
  hasSubscription: boolean;
}) {
  const { market, amountCents, orderId, baseUrl, hasSubscription } = options;
  const credentials = getVivaCredentials(market);
  return {
    amount: amountCents,
    currencyCode: getVivaCurrency(market) === "EUR" ? 978 : 946,
    customerTrns: `xHACCP Order #${orderId}`,
    merchantTrns: `order_${orderId}`,
    allowRecurring: hasSubscription,
    sourceCode: credentials.sourceCode,
    successRedirectUrl: `${baseUrl}/api/payments/viva/callback`,
    failureRedirectUrl: `${baseUrl}/api/payments/viva/callback`,
  };
}