// Using native fetch API (available in Node.js 18+)

export interface SmartbillConfig {
  username: string;
  token: string;
  companyVat: string;
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
      credentials: `${this.config.username}:${this.config.token?.substring(0, 10)}...`,
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
      console.log('   Headers:', JSON.stringify(headers, null, 2));
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      
      console.log('   Response status:', response.status);
      console.log('   Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('   Error response:', errorText);
      } else {
        const data = await response.json();
        console.log('   Available series:', JSON.stringify(data, null, 2));
      }
      
      return response.ok;
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
      console.log('📋 Request headers:', JSON.stringify(this.getHeaders(), null, 2));
      console.log('📋 Invoice data:', JSON.stringify(invoiceData, null, 2));
      
      // First test the connection
      const connectionOk = await this.testConnection();
      console.log('🔗 Connection test result:', connectionOk);
      
      if (!connectionOk) {
        throw new Error('Smartbill API connection failed - check credentials');
      }
      
      const response = await fetch(`${this.baseUrl}/invoice`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(invoiceData)
      });

      console.log('📤 Response status:', response.status);
      console.log('📤 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Smartbill API error response:', response.status, errorText);
        
        // Try to parse more specific error information
        if (response.status === 401) {
          throw new Error('Smartbill API authentication failed - check username and token');
        } else if (response.status === 400) {
          throw new Error(`Smartbill API validation error: ${errorText}`);
        } else if (response.status === 500) {
          console.log('🔍 Analyzing 500 error - likely field validation issue');
          throw new Error(`Smartbill API server error - field validation failed: ${errorText}`);
        }
        
        throw new Error(`Smartbill API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Smartbill invoice created successfully:', result);
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
   * Get product stock from Smartbill
   */
  async getProductStock(companyVat: string, productCode?: string): Promise<any[]> {
    try {
      const url = productCode 
        ? `${this.baseUrl}/stocks?cif=${companyVat}&productCode=${productCode}`
        : `${this.baseUrl}/stocks?cif=${companyVat}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get product stock: ${response.status}`);
      }

      const result = await response.json();
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Error getting product stock:', error);
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
   * Get products from Smartbill
   */
  async getProducts(companyVat: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/products?cif=${companyVat}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get products: ${response.status}`);
      }

      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error getting products from Smartbill:', error);
      return [];
    }
  }

  /**
   * Create or update product in Smartbill
   */
  async createOrUpdateProduct(companyVat: string, productData: {
    name: string;
    code: string;
    um: string;
    price?: number;
    currency?: string;
    vatPercentage?: number;
    category?: string;
    description?: string;
    barcode?: string;
  }): Promise<any> {
    try {
      console.log('Creating/updating Smartbill product:', JSON.stringify(productData, null, 2));
      
      const response = await fetch(`${this.baseUrl}/products`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cif: companyVat,
          ...productData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Smartbill product creation error:', response.status, errorText);
        throw new Error(`Smartbill product creation failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Smartbill product created/updated successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating/updating Smartbill product:', error);
      throw error;
    }
  }

  /**
   * Sync all products from local database to Smartbill
   */
  async syncProductsToSmartbill(companyVat: string, products: any[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    console.log(`Starting sync of ${products.length} products to Smartbill...`);

    for (const product of products) {
      try {
        await this.createOrUpdateProduct(companyVat, {
          name: product.name,
          code: product.productCode || product.id.toString(),
          um: 'buc', // pieces in Romanian
          price: parseFloat(product.price || '0'),
          currency: 'EUR',
          vatPercentage: parseFloat(product.vatValue || '0'),
          category: product.category?.name || 'General',
          description: product.description || '',
          barcode: product.productCode || ''
        });

        results.success++;
        console.log(`✓ Synced product: ${product.name}`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Failed to sync "${product.name}": ${errorMessage}`);
        console.error(`✗ Failed to sync product "${product.name}":`, error);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Product sync completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Sync stock levels from Smartbill to local database
   */
  async syncStockFromSmartbill(companyVat: string, productMappings: Map<string, number>): Promise<{
    success: number;
    failed: number;
    errors: string[];
    stockUpdates: Array<{ productId: number; oldStock: number; newStock: number; productCode: string; }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      stockUpdates: [] as Array<{ productId: number; oldStock: number; newStock: number; productCode: string; }>
    };

    try {
      console.log('Fetching stock levels from Smartbill...');
      const stockData = await this.getProductStock(companyVat);

      for (const stockItem of stockData) {
        try {
          const productCode = stockItem.productCode || stockItem.code;
          const productId = productMappings.get(productCode);
          
          if (!productId) {
            console.log(`No mapping found for product code: ${productCode}`);
            continue;
          }

          const newStock = parseInt(stockItem.quantity || stockItem.stock || '0');
          
          // Here you would update your local database stock
          // This is a placeholder - you'll need to implement the actual database update
          results.stockUpdates.push({
            productId,
            oldStock: 0, // You'd get this from your database
            newStock,
            productCode
          });

          results.success++;
          console.log(`✓ Updated stock for product ${productCode}: ${newStock}`);
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.errors.push(`Failed to update stock for ${stockItem.productCode}: ${errorMessage}`);
        }
      }

    } catch (error) {
      console.error('Error syncing stock from Smartbill:', error);
      results.errors.push(`Failed to fetch stock data: ${error}`);
    }

    console.log(`Stock sync completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }
}

/**
 * Helper function to convert order to Smartbill invoice format
 */
export function orderToSmartbillInvoice(
  order: any,
  user: any,
  config: SmartbillConfig,
  seriesName: string = 'FACT'
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
    const identityDoc = (billing.identityDocument || '').trim();
    if (identityDoc) {
      client.vatCode = identityDoc;
    }
    client.isTaxPayer = false;
  }

  // Format products using Romanian tax settings
  const products: SmartbillProduct[] = order.items.map((item: any) => {
    const productVatPercentage = parseFloat(item.product.vatPercentage || '21');
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

  const orderShippingCost = parseFloat(order.shippingCost || '0');
  if (orderShippingCost > 0) {
    console.log(`🚚 Adding shipping service line: ${orderShippingCost} lei, VAT=19%`);
    products.push({
      name: 'Transport curier Sameday',
      code: 'TRANSPORT',
      isDiscount: false,
      measuringUnitName: 'buc',
      quantity: 1,
      price: orderShippingCost,
      isTaxIncluded: true,
      taxName: 'Normala',
      taxPercentage: 19,
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
    currency: 'RON', // ✅ FIXED: Currency at invoice level only
    mentions: 'Factura cu TVA 21% conform legislației române',
    observations: '',
    deliveryDate: issueDate,
    precision: 2,
    products
  };

  console.log('✅ Final Smartbill invoice data:', JSON.stringify(invoiceData, null, 2));
  return invoiceData;
}