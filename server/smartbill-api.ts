// Using native fetch API (available in Node.js 18+)

export interface SmartbillConfig {
  username: string;
  token: string;
  companyVat: string;
  /**
   * Product writes are performed through the V1 invoice/v2 saveToDb
   * contract below. SmartBill is intentionally write-only for the
   * product catalog from this application.
   */
  v3Token?: string;
  invoiceSeries?: string;
}

export interface SmartbillProduct {
  name: string;
  code?: string;
  um?: string;
  measuringUnitName?: string;
  quantity: number;
  price: number;
  vatPercentage?: number;
  vatAmount?: number;
  currency?: string;
  isDiscount?: boolean;
  isTaxIncluded?: boolean;
  taxName?: string;
  taxPercentage?: number;
  productDescription?: string;
  saveToDb?: boolean;
  isService?: boolean;
}

export interface SmartbillClient {
  name: string;
  vatCode?: string;
  regCom?: string;
  address?: string;
  email?: string;
  phone?: string;
  contact?: string;
  country?: string;
  county?: string;
  city?: string;
  isTaxPayer?: boolean;
  saveToDb?: boolean;
}

export interface SmartbillInvoiceData {
  companyVatCode: string;
  seriesName: string;
  client: SmartbillClient;
  issueDate: string;
  dueDate?: string;
  products: SmartbillProduct[];
  language?: string;
  currency?: string;
  precision?: number;
  mentions?: string;
  observations?: string;
  deliveryDate?: string;
  isDraft?: boolean;
  paymentUrl?: string;
  sendEmail?: boolean;
}

export class SmartbillApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SmartbillApiError';
    this.status = status;
  }
}

export class SmartbillAPI {
  private baseUrl = 'https://ws.smartbill.ro/SBORO/api';
  private config: SmartbillConfig;

  constructor(config: SmartbillConfig) {
    this.config = config;
    console.log('🔧 SmartbillAPI initialized with config:', {
      username: config.username,
      tokenLength: config.token?.length || 0,
      companyVat: config.companyVat
    });
  }

  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.token}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    console.log('🔐 Auth header details:', {
      username: this.config.username,
      tokenLength: this.config.token?.length || 0,
      base64Length: base64Credentials.length
    });
    return `Basic ${base64Credentials}`;
  }

  private getHeaders(contentType: string = 'application/json'): Record<string, string> {
    return {
      'Content-Type': contentType,
      'Accept': 'application/json',
      'Authorization': this.getAuthHeader(),
      'X-SB-Access-Token': this.config.token, // Add the missing X-SB-Access-Token header
    };
  }

  private getV3Headers(): Record<string, string> {
    if (!this.config.v3Token) {
      throw new Error('SmartBill V3 product catalog token is not configured');
    }

    return {
      Accept: 'application/json',
      Authorization: `Bearer ${this.config.v3Token}`,
    };
  }

  private formatApiError(status: number, body: any): string {
    const errorText = typeof body?.errorText === 'string' ? body.errorText.trim() : '';
    const errors = Array.isArray(body?.errors)
      ? body.errors
          .map((entry: any) => [entry?.code, entry?.param, entry?.message].filter(Boolean).join(': '))
          .filter(Boolean)
          .join('; ')
      : '';
    const message = errorText || errors || (typeof body?.message === 'string' ? body.message : '');
    return message ? `Smartbill API error ${status}: ${message.replace(/<[^>]*>/g, '').slice(0, 500)}` : `Smartbill API error ${status}`;
  }

  /**
   * Get document series from Smartbill API
   */
  async getSeries(companyVat: string): Promise<any[]> {
    try {
      console.log('📋 Fetching Smartbill document series...');
      
      const url = `${this.baseUrl}/series?cif=${encodeURIComponent(companyVat)}`;
      const headers = this.getHeaders();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Series fetch error:', errorText);
        throw new Error(`Failed to fetch series: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Series data fetched successfully:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Failed to get Smartbill series:', error);
      throw error;
    }
  }

  /**
   * Test API connection by attempting to get document series
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Smartbill API connection...');
      console.log('   Base URL:', this.baseUrl);
      console.log('   Company VAT:', this.config.companyVat);
      console.log('   Username:', this.config.username);
      console.log('   Token length:', this.config.token?.length || 0);
      
      const url = `${this.baseUrl}/series?cif=${encodeURIComponent(this.config.companyVat)}`;
      const headers = this.getHeaders();
      
      console.log('🌐 Making test connection request:');
      console.log('   URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      
      console.log('   Response status:', response.status);
      console.log('   Response ok:', response.ok);
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok || (typeof data?.errorText === 'string' && data.errorText.trim())) {
        console.log('   SmartBill connection returned an error');
        return false;
      }

      console.log('   Available series count:', Array.isArray(data) ? data.length : 0);
      return true;
    } catch (error) {
      console.error('Smartbill connection test failed:', error);
      return false;
    }
  }

  /**
   * Create invoice via Smartbill API
   */
  async createInvoice(invoiceData: SmartbillInvoiceData): Promise<any> {
    try {
      console.log('🌐 Creating Smartbill invoice...');
      console.log('📋 Invoice data:', JSON.stringify(invoiceData, null, 2));
      
      // First test the connection
      const connectionOk = await this.testConnection();
      console.log('🔗 Connection test result:', connectionOk);
      
      if (!connectionOk) {
        throw new Error('Smartbill API connection failed - check credentials');
      }
      
      const response = await fetch(`${this.baseUrl}/invoice/v2`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(invoiceData)
      });

      console.log('📤 Response status:', response.status);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || (typeof result?.errorText === 'string' && result.errorText.trim())) {
        throw new Error(this.formatApiError(response.status, result));
      }
      console.log('✅ Smartbill invoice created successfully:', {
        message: result?.message,
        number: result?.number,
        series: result?.series,
        documentId: result?.documentId,
      });
      return result;
    } catch (error) {
      console.error('💥 Error creating Smartbill invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice PDF from Smartbill
   */
  async getInvoicePdf(companyVat: string, seriesName: string, number: string): Promise<Buffer> {
    try {
      const response = await fetch(`${this.baseUrl}/invoice/pdf`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Accept': 'application/octet-stream'
        },
        body: JSON.stringify({
          cif: companyVat,
          seriesname: seriesName,
          number: number
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get PDF: ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Error getting invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Check if invoice is paid
   */
  async isInvoicePaid(companyVat: string, seriesName: string, number: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/invoice/paymentstatus`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cif: companyVat,
          seriesname: seriesName,
          number: number
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to check payment status: ${response.status}`);
      }

      const result = await response.json();
      return result.paid === true;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return false;
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(companyVat: string, seriesName: string, number: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/invoice/cancel`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cif: companyVat,
          seriesname: seriesName,
          number: number
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel invoice: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error canceling invoice:', error);
      throw error;
    }
  }

  /**
   * Send invoice by email
   */
  async sendInvoiceByEmail(
    companyVat: string,
    seriesName: string,
    number: string,
    to: string,
    subject?: string,
    bodyText?: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/document/send`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cif: companyVat,
          type: 'factura',
          seriesname: seriesName,
          number: number,
          to: to,
          subject: subject || 'Invoice from xHACCP',
          bodyText: bodyText || 'Please find attached your invoice.'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send invoice by email: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending invoice by email:', error);
      throw error;
    }
  }

  /**
   * Get available VAT rates
   */
  async getVatRates(companyVat: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tax?cif=${companyVat}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get VAT rates: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting VAT rates:', error);
      return [];
    }
  }

  /**
   * Get available document series
   */
  async getDocumentSeries(companyVat: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/series?cif=${companyVat}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get document series: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting document series:', error);
      return [];
    }
  }

  /**
   * Update product stock in Smartbill
   */
  async updateProductStock(companyVat: string, stockUpdates: {
    productCode: string;
    quantity: number;
    operation: 'add' | 'subtract' | 'set';
    warehouseCode?: string;
    documentType?: string;
    documentSeries?: string;
    documentNumber?: string;
    notes?: string;
  }[]): Promise<boolean> {
    try {
      console.log('Updating Smartbill stock:', JSON.stringify(stockUpdates, null, 2));
      
      const response = await fetch(`${this.baseUrl}/stocks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cif: companyVat,
          stockMovements: stockUpdates
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Smartbill stock update error:', response.status, errorText);
        throw new Error(`Smartbill stock update failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Smartbill stock updated successfully:', result);
      return true;
    } catch (error) {
      console.error('Error updating Smartbill stock:', error);
      return false;
    }
  }

  /**
   * Create or update a product through SmartBill's supported V1 contract.
   *
   * SmartBill does not expose POST /products. saveToDb=true on a draft
   * invoice saves a missing product and updates an existing product matched by
   * code, without allocating an invoice number.
   */
  async createOrUpdateProduct(companyVat: string, productData: {
    name: string;
    code: string;
    um?: string;
    measuringUnitName?: string;
    price?: number;
    currency?: string;
    vatPercentage?: number;
    taxName?: string;
    description?: string;
    isService?: boolean;
  }): Promise<any> {
    return this.createProductSyncDraft(companyVat, [{
      name: productData.name,
      code: productData.code,
      quantity: 1,
      price: Number(productData.price ?? 0),
      measuringUnitName: productData.measuringUnitName || productData.um || 'buc',
      currency: productData.currency || 'RON',
      isTaxIncluded: true,
      taxName: productData.taxName || 'Normala',
      taxPercentage: Number(productData.vatPercentage ?? 21),
      productDescription: productData.description || '',
      saveToDb: true,
      isService: productData.isService === true,
    }]);
  }

  /**
   * Read the remote catalog only to preserve SmartBill's own names while
   * sending site-owned prices and tax data. Nothing from this response is
   * written to the local catalog or shown as a local product.
   */
  private async getProductNamesByCode(companyVat: string): Promise<Map<string, string>> {
    const remoteProducts: any[] = [];
    let nextUrl: string | null =
      `${this.baseUrl}/v3/companies/${encodeURIComponent(companyVat)}/products?limit=100`;
    const visitedUrls = new Set<string>();
    let pageCount = 0;

    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) {
        throw new Error('Smartbill product catalog pagination repeated the same page');
      }
      visitedUrls.add(nextUrl);
      pageCount += 1;
      if (pageCount > 100) {
        throw new Error('Smartbill product catalog pagination exceeded the safety limit');
      }

      const response: Response = await fetch(nextUrl, {
        method: 'GET',
        headers: this.getV3Headers(),
      });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new SmartbillApiError(response.status, this.formatApiError(response.status, result));
      }

      const pageItems = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.products)
            ? result.products
            : [];
      remoteProducts.push(...pageItems);

      const next = typeof result?.pagination?.next === 'string'
        ? result.pagination.next.trim()
        : '';
      nextUrl = next ? new URL(next, nextUrl).toString() : null;
    }

    const namesByCode = new Map<string, string>();
    for (const product of remoteProducts) {
      const code = String(
        product?.code
          ?? product?.productCode
          ?? product?.product?.code
          ?? '',
      ).trim();
      const name = String(
        product?.name
          ?? product?.productName
          ?? product?.product?.name
          ?? '',
      ).trim();
      if (code && name && !namesByCode.has(code)) {
        namesByCode.set(code, name);
      }
    }
    return namesByCode;
  }

  /**
   * Keep the remote nomenclature name on invoice lines for existing codes.
   * The local product name remains unchanged; this only adjusts the outbound
   * SmartBill request so saveToDb cannot overwrite the remote name.
   */
  async preserveExistingProductNames(
    companyVat: string,
    products: SmartbillProduct[],
  ): Promise<void> {
    const namesByCode = await this.getProductNamesByCode(companyVat);
    for (const product of products) {
      const code = String(product.code || '').trim();
      const remoteName = namesByCode.get(code);
      if (remoteName) {
        product.name = remoteName;
      }
    }
  }

  /**
   * Save all active products to SmartBill's nomenclature without creating
   * numbered invoices. SmartBill accepts at most 400 document lines, so large
   * catalogs are split into multiple draft documents.
   */
  async syncProductsToSmartbill(companyVat: string, products: any[]): Promise<{
    submitted: number;
    draftsCreated: number;
    failed: number;
    errors: string[];
    drafts: Array<{ documentId?: number; series?: string; number?: string; message?: string }>;
    skippedDuplicateCodes: string[];
  }> {
    const results = {
      submitted: 0,
      draftsCreated: 0,
      failed: 0,
      errors: [] as string[],
      drafts: [] as Array<{ documentId?: number; series?: string; number?: string; message?: string }>,
      skippedDuplicateCodes: [] as string[],
    };

    const remoteNamesByCode = await this.getProductNamesByCode(companyVat);
    const seenCodes = new Set<string>();
    const payloads = products.flatMap((product: any) => {
      const code = String(product.productCode || product.id || '').trim();
      if (!code || seenCodes.has(code)) {
        if (code) results.skippedDuplicateCodes.push(code);
        return [];
      }
      seenCodes.add(code);

      return [{
        // Keep SmartBill's independent nomenclature name for an existing
        // code. A new code is created using the site's product name.
        name: remoteNamesByCode.get(code) || String(product.name || code),
        code,
        quantity: 1,
        price: Number(product.marketPrice ?? product.price ?? 0),
        measuringUnitName: 'buc',
        currency: product.marketCurrency || 'RON',
        isTaxIncluded: true,
        taxName: 'Normala',
        taxPercentage: Number(product.marketVatPercentage ?? product.vatPercentage ?? 21) || 21,
        productDescription: product.description || '',
        saveToDb: true,
        isService: product.isService === true,
      }];
    });

    for (let offset = 0; offset < payloads.length; offset += 400) {
      const chunk = payloads.slice(offset, offset + 400);
      try {
        const draft = await this.createProductSyncDraft(companyVat, chunk);
        results.submitted += chunk.length;
        results.draftsCreated++;
        results.drafts.push({
          documentId: draft?.documentId,
          series: draft?.series,
          number: draft?.number,
          message: draft?.message,
        });
      } catch (error) {
        results.failed += chunk.length;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Failed to sync ${chunk.length} products: ${errorMessage}`);
      }
    }

    console.log(`Product sync completed: ${results.submitted} submitted, ${results.failed} failed`);
    return results;
  }

  private async createProductSyncDraft(companyVat: string, products: SmartbillProduct[]): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    return this.createInvoice({
      companyVatCode: companyVat,
      seriesName: this.config.invoiceSeries || 'KTO',
      issueDate: today,
      isDraft: true,
      client: {
        name: 'xHACCP product synchronization',
        country: 'Romania',
        saveToDb: false,
      },
      products,
    });
  }

}

/**
 * Helper function to convert order to Smartbill invoice format
 */
export function orderToSmartbillInvoice(
  order: any,
  user: any,
  config: SmartbillConfig,
  seriesName: string = 'FACT',
  defaultVatPercentage: number = 19
): SmartbillInvoiceData {
  console.log('🔧 Converting order to Smartbill format:', {
    orderId: order.id,
    userEmail: user.email,
    seriesName: seriesName,
    itemCount: order.items?.length || 0
  });

  const billing = order.billingAddress || {};
  const shipping = order.shippingAddress || {};
  const orderClientType = billing.clientType || (billing.vatNumber || billing.companyName ? 'company' : 'individual');

  const client: SmartbillClient = {
    name: orderClientType === 'company'
      ? (billing.companyName || user.companyName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0])
      : (`${billing.firstName || user.firstName || ''} ${billing.lastName || user.lastName || ''}`.trim() || user.email.split('@')[0]),
    address: billing.address || shipping.address || 'Strada Exemple 123',
    isTaxPayer: false,
    saveToDb: true,
    city: billing.city || shipping.city || 'Bucharest',
    county: billing.county || shipping.county || user.companyCounty || 'Bucuresti',
    country: billing.country || shipping.country || 'Romania',
    email: user.email
  };

  if (orderClientType === 'company') {
    const vatCode = (billing.vatNumber || user.vatNumber || '').trim();
    const regCom = (billing.registrationNumber || user.registrationNumber || '').trim();
    if (vatCode) {
      client.vatCode = vatCode;
      client.isTaxPayer = vatCode.toUpperCase().startsWith('RO');
    }
    if (regCom) {
      client.regCom = regCom;
    }
  } else {
    client.isTaxPayer = false;
  }

  // Format products using Romanian tax settings
  const products: SmartbillProduct[] = order.items.map((item: any) => {
    const productVatPercentage = parseFloat(
      item.vatPercentage || item.product.vatPercentage || String(defaultVatPercentage),
    );
    const isReverseCharge = false; // Use standard VAT for Romanian invoices
    
    console.log(`📦 Product ${item.product.name}: VAT=${productVatPercentage}%, ReverseCharge=${isReverseCharge}`);
    
    return {
      name: item.product.name,
      code: item.product.productCode || `KO-${item.productId}`,
      isDiscount: false,
      measuringUnitName: 'buc',
      // ✅ FIXED: Removed currency from product level (set at invoice level)
      quantity: item.quantity,
      price: parseFloat(item.price),
      isTaxIncluded: true, // VAT included in price for Romanian invoices
      taxName: 'Normala',
      taxPercentage: productVatPercentage,
      // ✅ FIXED: Removed vatPercentage and vatAmount (Smartbill calculates automatically)
      saveToDb: true, // Allow Smartbill to create products automatically
      isService: false
    };
  });

  // Add discount line BEFORE shipping (discount applies only to products, not transport)
  const orderDiscountAmount = parseFloat(
    order.discountGrossAmount != null
      ? String(order.discountGrossAmount)
      : order.discountAmount || '0',
  ) ||
    (() => {
      // Backward-compat: parse discount from notes for old orders without discountAmount column
      const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)\s*\(-?([\d.]+)\)/);
      return m ? parseFloat(m[2]) : 0;
    })();
  const orderVoucherCode = order.voucherCode ||
    (() => {
      const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)/);
      return m ? m[1] : '';
    })();

  if (orderDiscountAmount > 0) {
    console.log(`🎟️ Adding discount line: -${orderDiscountAmount} lei for voucher "${orderVoucherCode}"`);
    products.push({
      name: `Discount voucher${orderVoucherCode ? ' ' + orderVoucherCode : ''}`,
      code: 'DISCOUNT',
      isDiscount: true,
      measuringUnitName: 'buc',
      quantity: 1,
      price: -Math.abs(orderDiscountAmount),
      isTaxIncluded: true,
      taxName: 'Normala',
      taxPercentage: defaultVatPercentage,
      saveToDb: false,
      isService: false
    });
  }

  const orderShippingCost = parseFloat(order.shippingCost || '0');
  if (orderShippingCost > 0) {
    console.log(`🚚 Adding shipping service line: ${orderShippingCost} lei, VAT=${defaultVatPercentage}%`);
    products.push({
      name: 'Transport curier Sameday',
      code: 'TRANSPORT',
      isDiscount: false,
      measuringUnitName: 'buc',
      quantity: 1,
      price: orderShippingCost,
      isTaxIncluded: true,
      taxName: 'Normala',
      taxPercentage: defaultVatPercentage,
      saveToDb: true,
      isService: true
    });
  }

  console.log('📋 Smartbill client data:', client);
  console.log('📦 Smartbill products data:', products);

  // Format dates
  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const invoiceData = {
    companyVatCode: config.companyVat,
    client,
    issueDate,
    seriesName,
    isDraft: false,
    dueDate,
    currency: 'RON',
    mentions: 'Factura cu TVA 21% conform legislației române',
    observations: '',
    deliveryDate: issueDate,
    precision: 2,
    products
  };

  console.log('✅ Final Smartbill invoice data:', JSON.stringify(invoiceData, null, 2));
  return invoiceData;
}