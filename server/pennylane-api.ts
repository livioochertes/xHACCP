import crypto from "node:crypto";

export type PennylaneCustomer = {
  id: string;
  external_reference?: string;
  name?: string;
  email?: string;
};

export type PennylaneProduct = {
  id: string;
  label?: string;
  description?: string;
  external_reference?: string;
  price_before_tax?: string;
  vat_rate?: string;
  price?: string;
  unit?: string;
  currency?: string;
  reference?: string | null;
};

export type PennylaneInvoice = {
  id: string;
  invoice_number?: string;
  number?: string;
  status?: string;
  url?: string;
  pdf_url?: string;
  download_url?: string;
  customer_id?: string;
};

export type PennylaneLine = {
  label: string;
  quantity: number;
  unit?: string;
  raw_currency_unit_price: string;
  vat_rate: string;
  product_id?: number;
  ledger_account_id?: number;
};

export type PennylaneInvoiceInput = {
  external_reference: string;
  customer_id: number;
  date: string;
  currency: "EUR";
  line_items: PennylaneLine[];
  seller: {
    name: string;
    vat_number?: string;
    registration_number?: string;
    address?: string;
    city?: string;
    zip_code?: string;
    country?: string;
    email?: string;
  };
};

export interface PennylaneTransport {
  request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  download(path: string): Promise<Buffer>;
}

export class PennylaneError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "PennylaneError";
    this.retryable = options.retryable ?? true;
    this.status = options.status;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function unwrap<T>(value: any): T {
  return (value?.data ?? value?.customer ?? value?.invoice ?? value?.product ?? value) as T;
}

function responseId(value: any): string | undefined {
  return text(value?.id) || text(value?.data?.id) || text(value?.customer?.id) ||
    text(value?.invoice?.id) || text(value?.product?.id);
}

function responseUrl(value: any): string | undefined {
  return text(value?.pdf_url) || text(value?.download_url) || text(value?.url) ||
    text(value?.data?.pdf_url) || text(value?.data?.download_url) || text(value?.data?.url);
}

export function pennylaneExternalReference(orderId: number): string {
  return `xhaccp-fr-order-${orderId}`;
}

export function pennylaneProductExternalReference(market: string, productId: number): string {
  return `xhaccp-${market}-product-${productId}`;
}

export function pennylaneCustomerReference(input: {
  email?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const stable = input.email?.trim().toLowerCase() ||
    `${input.companyName || ""}:${input.firstName || ""}:${input.lastName || ""}`.toLowerCase();
  return `xhaccp-fr-customer-${crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32)}`;
}

export function pennylaneVatRateCode(rate: number): string {
  if (rate === 0) return "exempt";
  return `FR_${Math.round(rate * 10).toString().padStart(3, "0")}`;
}

export function buildPennylaneProductPayload(input: {
  market: string;
  productId: number;
  label: string;
  description?: string | null;
  priceBeforeTax: number;
  vatRate: number;
  unit?: string;
  currency?: string;
}) {
  return {
    label: input.label,
    description: (input.description || "").slice(0, 5000),
    external_reference: pennylaneProductExternalReference(input.market, input.productId),
    price_before_tax: input.priceBeforeTax.toFixed(2),
    vat_rate: pennylaneVatRateCode(input.vatRate),
    unit: input.unit || "piece",
    currency: input.currency || "EUR",
  };
}

export function buildPennylaneCustomerPayload(input: {
  externalReference: string;
  name: string;
  email?: string;
  companyName?: string;
  vatNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
}) {
  return {
    external_reference: input.externalReference,
    name: input.companyName || input.name,
    emails: input.email ? [input.email] : [],
    billing_address: {
      address: input.address || undefined,
      city: input.city || undefined,
      postal_code: input.zipCode || undefined,
      country: input.country || "FR",
    },
    ...(input.vatNumber ? { vat_number: input.vatNumber } : {}),
  };
}

export function buildPennylaneInvoicePayload(input: PennylaneInvoiceInput) {
  return {
    external_reference: input.external_reference,
    customer_id: input.customer_id,
    date: input.date,
    currency: input.currency,
    invoice_lines: input.line_items,
    // Official seller identity and numbering come from the Pennylane company
    // selected by the connected account. Keep the market-specific seller
    // details in the supported free-text field as a reconciliation aid.
    pdf_invoice_free_text: [
      input.seller.name,
      input.seller.vat_number ? `TVA ${input.seller.vat_number}` : "",
      input.seller.registration_number ? `SIREN ${input.seller.registration_number}` : "",
    ].filter(Boolean).join(" · "),
  };
}

export class PennylaneClient {
  constructor(private readonly transport: PennylaneTransport) {}

  async testConnection(): Promise<unknown> {
    return this.transport.request("GET", "/me");
  }

  async findCustomerByReference(externalReference: string): Promise<PennylaneCustomer | null> {
    const result = await this.transport.request<any>(
      "GET",
      `/customers?filter=${encodeURIComponent(JSON.stringify([
        { field: "external_reference", operator: "eq", value: externalReference },
      ]))}`,
    );
    const list = Array.isArray(result) ? result : result?.data || result?.customers || [];
    return (list[0] ? unwrap<PennylaneCustomer>(list[0]) : null);
  }

  async createCustomer(payload: Record<string, unknown>): Promise<PennylaneCustomer> {
    const result = await this.transport.request<any>("POST", "/company_customers", payload);
    const customer = unwrap<PennylaneCustomer>(result);
    const id = responseId(result);
    if (!id) throw new PennylaneError("Pennylane customer response had no ID", { retryable: false });
    return { ...customer, id };
  }

  async findOrCreateCustomer(externalReference: string, payload: Record<string, unknown>): Promise<PennylaneCustomer> {
    const existing = await this.findCustomerByReference(externalReference);
    return existing || this.createCustomer(payload);
  }

  async listProducts(): Promise<PennylaneProduct[]> {
    const products: PennylaneProduct[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({ limit: "100" });
      if (cursor) query.set("cursor", cursor);
      const result = await this.transport.request<any>("GET", `/products?${query.toString()}`);
      const items = Array.isArray(result) ? result : result?.items || result?.data || result?.products || [];
      products.push(...(Array.isArray(items) ? items.map((item: any) => unwrap<PennylaneProduct>(item)) : []));
      cursor = typeof result?.next_cursor === "string" && result.next_cursor ? result.next_cursor : undefined;
    } while (cursor);
    return products;
  }

  async createProduct(payload: Record<string, unknown>): Promise<PennylaneProduct> {
    const result = await this.transport.request<any>("POST", "/products", payload);
    const product = unwrap<PennylaneProduct>(result);
    const id = responseId(result);
    if (!id) throw new PennylaneError("Pennylane product response had no ID", { retryable: true });
    return { ...product, id };
  }

  async updateProduct(productId: string, payload: Record<string, unknown>): Promise<PennylaneProduct> {
    const result = await this.transport.request<any>(
      "PUT",
      `/products/${encodeURIComponent(productId)}`,
      payload,
    );
    const product = unwrap<PennylaneProduct>(result);
    const id = responseId(result) || product.id || productId;
    return { ...product, id };
  }

  async findInvoiceByReference(externalReference: string): Promise<PennylaneInvoice | null> {
    const result = await this.transport.request<any>(
      "GET",
      `/customer_invoices?filter=${encodeURIComponent(JSON.stringify([
        { field: "external_reference", operator: "eq", value: externalReference },
      ]))}`,
    );
    const list = Array.isArray(result) ? result : result?.data || result?.customer_invoices || [];
    return list[0] ? unwrap<PennylaneInvoice>(list[0]) : null;
  }

  async createInvoice(payload: PennylaneInvoiceInput): Promise<PennylaneInvoice> {
    const result = await this.transport.request<any>(
      "POST",
      "/customer_invoices",
      buildPennylaneInvoicePayload(payload),
      { "Idempotency-Key": payload.external_reference },
    );
    const invoice = unwrap<PennylaneInvoice>(result);
    const id = responseId(result);
    if (!id) throw new PennylaneError("Pennylane invoice response had no ID", { retryable: true });
    return { ...invoice, id, url: responseUrl(result) || invoice.url };
  }

  async finalizeInvoice(invoiceId: string): Promise<PennylaneInvoice> {
    const result = await this.transport.request<any>("POST", `/customer_invoices/${encodeURIComponent(invoiceId)}/finalize`);
    const invoice = unwrap<PennylaneInvoice>(result);
    return { ...invoice, id: responseId(result) || invoice.id, url: responseUrl(result) || invoice.url };
  }

  async getInvoice(invoiceId: string): Promise<PennylaneInvoice> {
    const result = await this.transport.request<any>("GET", `/customer_invoices/${encodeURIComponent(invoiceId)}`);
    const invoice = unwrap<PennylaneInvoice>(result);
    if (!responseId(result) && !invoice.id) throw new PennylaneError("Pennylane invoice response had no ID", { retryable: true });
    return { ...invoice, id: responseId(result) || invoice.id, url: responseUrl(result) || invoice.url };
  }

  async downloadInvoicePdf(invoice: PennylaneInvoice): Promise<Buffer | null> {
    const url = responseUrl(invoice);
    if (!url) return null;
    return this.transport.download(url);
  }
}

export function createPennylaneHttpTransport(): PennylaneTransport | null {
  const baseUrl = (process.env.PENNYLANE_API_BASE_URL || "https://app.pennylane.com/api/external/v2").trim();
  const token = process.env.PENNYLANE_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  const resolveApiUrl = (path: string) => new URL(
    path.replace(/^\/+/, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();

  const request = async <T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.PENNYLANE_TIMEOUT_MS || 10000));
    try {
      const response = await fetch(resolveApiUrl(path), {
        method,
        signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const responseText = await response.text();
      if (!response.ok) {
        const detail = responseText
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500);
        throw new PennylaneError(
          `Pennylane request failed (${response.status})${detail ? `: ${detail}` : ""}`,
          {
          status: response.status,
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
          },
        );
      }
      try {
        return JSON.parse(responseText) as T;
      } catch {
        throw new PennylaneError(
          `Pennylane returned a non-JSON response (${response.status})`,
          { status: response.status, retryable: true },
        );
      }
    } catch (error) {
      if (error instanceof PennylaneError) throw error;
      throw new PennylaneError(error instanceof Error && error.name === "AbortError" ? "Pennylane request timed out" : "Pennylane request failed");
    } finally {
      clearTimeout(timeout);
    }
  };
  return {
    request,
    async download(path: string) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(process.env.PENNYLANE_TIMEOUT_MS || 10000));
      try {
        const response = await fetch(resolveApiUrl(path), {
          headers: { Accept: "application/pdf", Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new PennylaneError(`Pennylane PDF request failed (${response.status})`, { status: response.status });
        return Buffer.from(await response.arrayBuffer());
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}