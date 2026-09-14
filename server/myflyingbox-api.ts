export interface MyFlyingBoxConfig {
  baseUrl: string;
  apiIdentifier: string;
  password: string;
  productCode?: string;
}

export interface MyFlyingBoxParcel {
  type: "package" | "document";
  length: number;
  width: number;
  height: number;
  weight: number;
}

export interface MyFlyingBoxAddress {
  name: string;
  company?: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  country: string;
}

export interface MyFlyingBoxQuoteInput {
  parcel_type: "package" | "document";
  shipper: {
    country: string;
    postal_code: string;
    city: string;
  };
  recipient: {
    is_a_company: boolean;
    country: string;
    postal_code: string;
    city: string;
  };
  parcels: MyFlyingBoxParcel[];
  insured_value?: number;
  insured_currency?: string;
}

export interface MyFlyingBoxOrderInput {
  offer_id: string;
  ecommerce_order_platform?: string;
  ecommerce_order_identifier?: string;
  ecommerce_order_reference?: string;
  shipper: MyFlyingBoxAddress;
  recipient: MyFlyingBoxAddress & { is_a_company: boolean };
  parcels: Array<{
    shipper_reference?: string;
    recipient_reference?: string;
    value?: number;
    currency?: string;
    description?: string;
    country_of_origin?: string;
  }>;
}

export interface MyFlyingBoxOffer {
  id: string;
  product?: {
    code?: string;
    name?: string;
    carrier_code?: string;
  };
  total_price?: {
    amount?: number;
    currency?: string;
  };
  price?: {
    amount?: number;
    currency?: string;
  };
}

export interface MyFlyingBoxQuoteResponse {
  id?: string;
  offers?: MyFlyingBoxOffer[];
}

export interface MyFlyingBoxOrderResponse {
  uuid?: string;
  id?: string;
}

const DEFAULT_BASE_URL = "https://api.myflyingbox.com/v2";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; type?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.error?.type) return parsed.error.type;
    if (parsed.message) return parsed.message;
  } catch {
    // Keep the provider response opaque if it is not JSON.
  }
  return body.slice(0, 300);
}

export class MyFlyingBoxAPI {
  private readonly config: MyFlyingBoxConfig;

  constructor(config: MyFlyingBoxConfig) {
    this.config = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.config.apiIdentifier}:${this.config.password}`).toString("base64")}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers as Record<string, string> | undefined),
        },
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`MyFlyingBox API ${response.status}: ${parseErrorBody(body)}`);
      }

      if (contentType.includes("application/json")) {
        return await response.json() as T;
      }
      return await response.text() as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`MyFlyingBox API timeout for ${endpoint}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createQuote(input: MyFlyingBoxQuoteInput): Promise<MyFlyingBoxQuoteResponse> {
    return this.request<MyFlyingBoxQuoteResponse>("/quotes", {
      method: "POST",
      body: JSON.stringify({ quote: input }),
    });
  }

  async createOrder(input: MyFlyingBoxOrderInput): Promise<MyFlyingBoxOrderResponse> {
    return this.request<MyFlyingBoxOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify({ order: input }),
    });
  }

  async getLabels(orderUuid: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.config.baseUrl}/orders/${encodeURIComponent(orderUuid)}/labels`, {
        signal: controller.signal,
        headers: {
          Accept: "application/pdf",
          Authorization: `Basic ${Buffer.from(`${this.config.apiIdentifier}:${this.config.password}`).toString("base64")}`,
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`MyFlyingBox labels ${response.status}: ${parseErrorBody(body)}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("MyFlyingBox labels request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTracking(orderUuid: string): Promise<unknown> {
    return this.request(`/orders/${encodeURIComponent(orderUuid)}/tracking`);
  }

  selectOffer(offers: MyFlyingBoxOffer[]): MyFlyingBoxOffer {
    const eligibleOffers = offers.filter((offer) => offer.id);
    if (eligibleOffers.length === 0) {
      throw new Error("MyFlyingBox returned no usable shipping offers");
    }

    if (this.config.productCode) {
      const configuredOffer = eligibleOffers.find(
        (offer) => offer.product?.code === this.config.productCode,
      );
      if (!configuredOffer) {
        throw new Error(`MyFlyingBox product code "${this.config.productCode}" was not returned by the quote`);
      }
      return configuredOffer;
    }

    return [...eligibleOffers].sort((left, right) => {
      const leftAmount = left.total_price?.amount ?? left.price?.amount ?? Number.POSITIVE_INFINITY;
      const rightAmount = right.total_price?.amount ?? right.price?.amount ?? Number.POSITIVE_INFINITY;
      return leftAmount - rightAmount;
    })[0];
  }
}

let myFlyingBoxInstance: MyFlyingBoxAPI | null = null;

export function createMyFlyingBoxAPI(): MyFlyingBoxAPI | null {
  if (myFlyingBoxInstance) return myFlyingBoxInstance;

  const apiIdentifier = process.env.MYFLYINGBOX_API_IDENTIFIER;
  const password = process.env.MYFLYINGBOX_PASSWORD;
  if (!apiIdentifier || !password) {
    console.warn("MyFlyingBox API identifier and password are not configured");
    return null;
  }

  myFlyingBoxInstance = new MyFlyingBoxAPI({
    baseUrl: process.env.MYFLYINGBOX_BASE_URL || DEFAULT_BASE_URL,
    apiIdentifier,
    password,
    productCode: process.env.MYFLYINGBOX_PRODUCT_CODE || undefined,
  });
  return myFlyingBoxInstance;
}