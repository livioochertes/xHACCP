import { SmartbillAPI, SmartbillConfig, orderToSmartbillInvoice } from './smartbill-api.js';
import { storage } from './storage.js';
import { getNextInvoiceNumber } from './invoice-counter.js';
import { generateInvoicePdf, getInvoicePdfBuffer, pdfExists, type PdfInvoiceData } from './pdf-invoice-local.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildPennylaneCustomerPayload,
  createPennylaneHttpTransport,
  PennylaneClient,
  pennylaneCustomerReference,
  pennylaneExternalReference,
  pennylaneVatRateCode,
  type PennylaneInvoiceInput,
} from './pennylane-api.js';

function invoiceProductName(item: any): string {
  const productName = item.product?.name || item.productName || 'Product';
  const components = Array.isArray(item.compositeConfiguration?.components)
    ? item.compositeConfiguration.components
    : [];
  if (!components.length) return productName;
  return `${productName} (${components
    .map((component: any) => `${component.name || `#${component.componentProductId}`} x${component.quantity}`)
    .join(', ')})`;
}

export interface InvoiceServiceConfig {
  smartbill: SmartbillConfig;
  defaultSeries: string;
  enableSmartbill: boolean;
  companyInfo?: any;
  pennylane?: PennylaneClient;
}

export class InvoiceService {
  private smartbillApi: SmartbillAPI;
  private config: InvoiceServiceConfig;
  private pennylaneApi?: PennylaneClient;

  constructor(config: InvoiceServiceConfig) {
    this.config = config;
    console.log('🔧 InvoiceService constructor - Config received:', {
      enableSmartbill: config.enableSmartbill,
      defaultSeries: config.defaultSeries,
      smartbill: {
        username: config.smartbill.username,
        tokenLength: config.smartbill.token?.length || 0,
        companyVat: config.smartbill.companyVat
      }
    });
    this.smartbillApi = new SmartbillAPI(config.smartbill);
    this.pennylaneApi = config.pennylane;
  }

  /**
   * Test connection to Smartbill API
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enableSmartbill) {
      console.log('Smartbill integration disabled');
      return false;
    }

    return await this.smartbillApi.testConnection();
  }

  /**
   * Generate invoice automatically after payment completion
   */
  async generateInvoiceAfterPayment(orderId: number, paymentData: any): Promise<any> {
    try {
      console.log(`Starting automatic invoice generation for order ${orderId}`);
      
      // Get order details with items and user
      const order = await storage.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Resolve per-market company settings at runtime — immutable local variable,
      // never mutate this.config (shared singleton) to avoid concurrency issues.
      const orderMarket = (order.market as string) || 'ro';
      const resolvedCompanyInfo = await getCompanySettingsByMarket(orderMarket);
      if (resolvedCompanyInfo) {
        console.log(`📋 Using market '${orderMarket}' company settings for order ${orderId}: ${resolvedCompanyInfo.name}`);
      } else {
        console.log(`📋 No company settings found for market '${orderMarket}' on order ${orderId} — invoice generated with empty company details`);
      }

      let user = order.userId ? await storage.getUser(order.userId) : null;
      if (!user) {
        const billing = order.billingAddress as any || {};
        const shipping = order.shippingAddress as any || {};
        const guestEmail = billing.email || shipping.email || order.notes?.match(/Guest email:\s*([^\s,]+)/)?.[1] || 'guest@xhaccp.com';

        if (guestEmail && guestEmail !== 'guest@xhaccp.com') {
          const existingUser = await storage.getUserByEmail(guestEmail);
          if (existingUser) {
            user = existingUser;
            await storage.updateOrder(orderId, { userId: existingUser.id });
            (order as any).userId = existingUser.id;
            console.log(`🔗 Linked guest order #${orderId} to existing user ${existingUser.id} (${guestEmail}) before invoice generation`);
          }
        }

        if (!user) {
          user = {
            id: 0,
            email: guestEmail,
            firstName: billing.firstName || shipping.firstName || 'Guest',
            lastName: billing.lastName || shipping.lastName || 'Customer',
            companyName: billing.companyName || '',
            vatNumber: billing.vatNumber || '',
            registrationNumber: billing.registrationNumber || '',
            companyCounty: billing.county || shipping.county || '',
          } as any;
          console.log(`📋 Guest order #${orderId}: no registered user found for ${guestEmail}, saving invoice without userId`);
        }
      }

      // Update order status to 'paid' if payment successful
      if (paymentData.status === 'completed' || paymentData.status === 'succeeded') {
        await storage.updateOrder(orderId, { 
          paymentStatus: 'paid',
          status: 'processing' 
        });
      }

      let invoice;

      if (orderMarket === 'fr') {
        // Pennylane owns French invoice numbering. There is deliberately no
        // local-PDF fallback for this market.
        invoice = await this.generatePennylaneInvoice(order, user, paymentData, resolvedCompanyInfo);
      } else if (orderMarket === 'com') {
        // .com remains on the established local invoice flow.
        invoice = await this.generateLocalInvoiceForMarket(order, user, paymentData, resolvedCompanyInfo, orderMarket);
      } else if (this.config.enableSmartbill) {
        // ro: Generate invoice via Smartbill API
        invoice = await this.generateSmartbillInvoice(order, user, paymentData, resolvedCompanyInfo);
      } else {
        // ro fallback: local invoice generation
        invoice = await this.generateLocalInvoice(order, user, paymentData, resolvedCompanyInfo);
      }

      console.log(`Invoice generated successfully for order ${orderId}:`, invoice);
      return invoice;

    } catch (error) {
      console.error(`Error generating invoice for order ${orderId}:`, error);
      
      // SmartBill's established Romanian fallback remains unchanged. A
      // Pennylane failure is persisted as pending/failed by the adapter and
      // must never become a local official French invoice.
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.config.enableSmartbill && errorMessage.includes('Smartbill')) {
        console.log('Smartbill failed, falling back to local invoice generation');
        try {
          const order = await storage.getOrder(orderId);
          if (!order) {
            throw new Error(`Order ${orderId} not found`);
          }
          const fallbackMarket = (order.market as string) || 'ro';
          const fallbackCompanyInfo = await getCompanySettingsByMarket(fallbackMarket);
          let user = order.userId ? await storage.getUser(order.userId) : null;
          if (!user) {
            const billing = order.billingAddress as any || {};
            const shipping = order.shippingAddress as any || {};
            const guestEmail = billing.email || shipping.email || '';
            if (guestEmail) {
              const existingUser = await storage.getUserByEmail(guestEmail);
              if (existingUser) {
                user = existingUser;
                await storage.updateOrder(orderId, { userId: existingUser.id });
                (order as any).userId = existingUser.id;
              }
            }
            if (!user) {
              user = {
                id: 0,
                email: guestEmail || 'guest@xhaccp.com',
                firstName: billing.firstName || shipping.firstName || 'Guest',
                lastName: billing.lastName || shipping.lastName || 'Customer',
              } as any;
            }
          }
          return await this.generateLocalInvoice(order, user, paymentData, fallbackCompanyInfo);
        } catch (fallbackError) {
          console.error('Fallback invoice generation also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Create invoice for an order (main method for manual invoice creation)
   */
  async createInvoiceForOrder(order: any, user: any, options: { paymentMethod?: string } = {}): Promise<any> {
    try {
      console.log(`🧾 Creating invoice for order ${order.id}, Smartbill enabled: ${this.config.enableSmartbill}`);
      
      // Check if order has items
      if (!order.items || order.items.length === 0) {
        throw new Error(`Order ${order.id} has no items to create invoice`);
      }

      // Resolve per-market company settings — immutable local variable, never mutate this.config
      const orderMarket = (order.market as string) || 'ro';
      const resolvedCompanyInfo = await getCompanySettingsByMarket(orderMarket);
      console.log(`📋 Manual invoice for order ${order.id}: using market '${orderMarket}' company settings`);

      const paymentData = { 
        paymentMethod: options.paymentMethod || 'wire_transfer',
        status: 'manual_creation'
      };

      if (orderMarket === 'fr') {
        console.log(`📋 ✅ USING PENNYLANE INVOICE for market '${orderMarket}'`);
        return await this.generatePennylaneInvoice(order, user, paymentData, resolvedCompanyInfo);
      } else if (orderMarket === 'com') {
        console.log(`📋 ✅ USING LOCAL PDF INVOICE for market '${orderMarket}'`);
        return await this.generateLocalInvoiceForMarket(order, user, paymentData, resolvedCompanyInfo, orderMarket);
      } else if (this.config.enableSmartbill) {
        console.log(`📋 ✅ ATTEMPTING SMARTBILL INVOICE CREATION - Series: ${this.config.defaultSeries}`);
        return await this.generateSmartbillInvoice(order, user, paymentData, resolvedCompanyInfo);
      } else {
        console.log(`📋 ⚠️ USING LOCAL INVOICE GENERATION - Smartbill disabled`);
        return await this.generateLocalInvoice(order, user, paymentData, resolvedCompanyInfo);
      }

    } catch (error) {
      console.error(`❌ Error creating invoice for order ${order.id}:`, error);
      
      // If Smartbill fails, try local generation as fallback
      if (this.config.enableSmartbill) {
        console.log('🔄 ⚠️ SMARTBILL FAILED - FALLING BACK TO LOCAL GENERATION');
        console.log(`   Smartbill error: ${error instanceof Error ? error.message : String(error)}`);
        try {
          const fallbackMarket = (order.market as string) || 'ro';
          const fallbackCompanyInfo = await getCompanySettingsByMarket(fallbackMarket);
          const paymentData = { 
            paymentMethod: options.paymentMethod || 'wire_transfer',
            status: 'fallback_creation'
          };
          const localInvoice = await this.generateLocalInvoice(order, user, paymentData, fallbackCompanyInfo);
          console.log(`📋 ✅ FALLBACK INVOICE CREATED: ${localInvoice.invoiceNumber}`);
          return localInvoice;
        } catch (fallbackError) {
          console.error('❌ FALLBACK INVOICE GENERATION FAILED:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Issue a French invoice in Pennylane. The local row is created first with
   * a deterministic technical number so a timeout can be retried safely; the
   * official number is written only after Pennylane finalizes the document.
   */
  private async generatePennylaneInvoice(order: any, user: any, paymentData: any, companyInfo?: any): Promise<any> {
    const externalRef = pennylaneExternalReference(order.id);
    let invoice: any = await storage.getInvoiceByExternalRef(externalRef);
    if (invoice?.providerStatus === 'issued') return invoice;

    const vatRate = parseFloat(String(companyInfo?.defaultVatPercentage ?? 20));
    const totalAmount = Number(order.totalAmount || 0);
    const vatAmount = (totalAmount * vatRate) / (100 + vatRate);
    const items: any[] = (order.items || []).map((item: any) => ({
      productId: item.productId,
      productName: invoiceProductName(item),
      productCode: item.product?.productCode || null,
      quantity: Number(item.quantity),
      // Pennylane's raw_currency_unit_price is tax-exclusive. Order prices
      // are stored tax-inclusive, so remove the configured FR VAT first.
      unitPrice: Number(item.price) / (1 + vatRate / 100),
      vatRate,
      lineTotal: Number(item.totalPrice),
    }));
    const discountAmount = Number(order.discountAmount || 0) ||
      (() => {
        const match = String(order.notes || '').match(/Voucher:\s*[^\s(]+\s*\(-?([\d.]+)\)/);
        return match ? Number(match[1]) : 0;
      })();
    if (discountAmount > 0) {
      items.push({
        productId: null,
        productName: `Remise${order.voucherCode ? ` ${order.voucherCode}` : ''}`,
        productCode: 'DISCOUNT',
        quantity: 1,
        unitPrice: -Math.abs(discountAmount) / (1 + vatRate / 100),
        vatRate,
        lineTotal: -Math.abs(discountAmount),
      });
    }

    if (!invoice) {
      try {
        invoice = await storage.createInvoice({
          invoiceNumber: `PENDING-FR-${order.id}`,
          orderId: order.id,
          userId: order.userId || undefined,
          issueDate: new Date(),
          supplyDate: new Date(),
          subtotal: (totalAmount - vatAmount).toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          currency: 'EUR',
          paymentMethod: paymentData.paymentMethod || order.paymentMethod || 'card',
          notes: 'Facture Pennylane — émission en attente',
          status: 'pending',
          market: 'fr',
          provider: 'pennylane',
          providerStatus: 'pending',
          externalRef,
          providerLastAttemptAt: new Date(),
        } as any, items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          vatRate: item.vatRate.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })));
      } catch (error) {
        // A unique external_ref claim means another callback won the race.
        invoice = await storage.getInvoiceByExternalRef(externalRef);
        if (!invoice) throw error;
      }
    }
    if (!invoice) throw new Error('Unable to create local Pennylane invoice record');

    try {
      await storage.updateInvoice(invoice.id, {
        providerStatus: 'pending',
        providerError: null,
        providerLastAttemptAt: new Date(),
        providerNextRetryAt: null,
      } as any);
      const client = this.pennylaneApi;
      if (!client) throw new Error('Pennylane connector is not configured');

      const billing = (order.billingAddress as any) || {};
      const shipping = (order.shippingAddress as any) || {};
      const email = billing.email || shipping.email || user?.email || undefined;
      const firstName = billing.firstName || shipping.firstName || user?.firstName || '';
      const lastName = billing.lastName || shipping.lastName || user?.lastName || '';
      const customerExternalRef = pennylaneCustomerReference({
        email,
        companyName: billing.companyName || user?.companyName,
        firstName,
        lastName,
      });
      const customerPayload = buildPennylaneCustomerPayload({
        externalReference: customerExternalRef,
        name: `${firstName} ${lastName}`.trim() || 'Client',
        email,
        companyName: billing.companyName || user?.companyName,
        vatNumber: billing.vatNumber || user?.vatNumber,
        address: billing.address || shipping.address,
        city: billing.city || shipping.city,
        zipCode: billing.zipCode || shipping.zipCode,
        country: billing.country || shipping.country || 'FR',
      });
      const customer = await client.findOrCreateCustomer(customerExternalRef, customerPayload);
      const lineItems = await Promise.all(items.map(async item => {
        const mapping = item.productId ? await getPennylaneProductMapping(item.productId, 'fr') : null;
        return {
          label: item.productName,
          quantity: item.quantity,
          unit: 'piece',
          raw_currency_unit_price: item.unitPrice.toFixed(2),
          vat_rate: pennylaneVatRateCode(item.vatRate),
          ...(mapping?.pennylaneProductId && /^\d+$/.test(mapping.pennylaneProductId)
            ? { product_id: Number(mapping.pennylaneProductId) }
            : {}),
          ...(mapping?.pennylaneAccountingAccountId && /^\d+$/.test(mapping.pennylaneAccountingAccountId)
            ? { ledger_account_id: Number(mapping.pennylaneAccountingAccountId) }
            : {}),
        };
      }));
      const customerId = Number(customer.id);
      if (!Number.isSafeInteger(customerId)) {
        throw new Error('Pennylane customer response returned an invalid numeric ID');
      }
      const payload: PennylaneInvoiceInput = {
        external_reference: externalRef,
        customer_id: customerId,
        date: new Date().toISOString().slice(0, 10),
        currency: 'EUR',
        line_items: lineItems,
        seller: {
          name: companyInfo?.name || 'xHACCP',
          vat_number: companyInfo?.vatNumber || undefined,
          registration_number: companyInfo?.registrationNumber || undefined,
          address: companyInfo?.address || undefined,
          city: companyInfo?.city || undefined,
          zip_code: companyInfo?.zipCode || undefined,
          country: companyInfo?.country || 'France',
          email: companyInfo?.email || undefined,
        },
      };
      let remote = invoice.providerInvoiceId
        ? await client.getInvoice(invoice.providerInvoiceId)
        : await client.findInvoiceByReference(externalRef);
      if (!remote) remote = await client.createInvoice(payload);
      if (!remote.status || !['finalized', 'issued', 'paid', 'sent'].includes(remote.status.toLowerCase())) {
        remote = await client.finalizeInvoice(remote.id);
      }
      const officialNumber = remote.invoice_number || remote.number;
      if (!officialNumber) throw new Error('Pennylane finalized invoice returned no official number');

      let pdfPath = invoice.pdfPath;
      if (!pdfPath) {
        const pdf = await client.downloadInvoicePdf(remote);
        if (pdf?.length) {
          pdfPath = path.join('uploads', 'invoices', `pennylane-${invoice.id}.pdf`);
          await mkdir(path.dirname(pdfPath), { recursive: true });
          await writeFile(pdfPath, pdf);
        }
      }
      await storage.updateInvoice(invoice.id, {
        invoiceNumber: officialNumber,
        status: 'issued',
        provider: 'pennylane',
        providerStatus: 'issued',
        providerInvoiceId: remote.id,
        providerInvoiceUrl: remote.url || null,
        providerPdfUrl: remote.pdf_url || remote.download_url || null,
        providerError: null,
        providerLastAttemptAt: new Date(),
        providerNextRetryAt: null,
        pdfPath: pdfPath || null,
        notes: 'Facture émise et numérotée par Pennylane',
      } as any);
      return await storage.getInvoice(invoice.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await storage.updateInvoice(invoice.id, {
        status: 'pending',
        provider: 'pennylane',
        providerStatus: 'failed',
        providerError: message.slice(0, 1000),
        providerLastAttemptAt: new Date(),
        providerNextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
      } as any);
      throw error;
    }
  }

  async retryPennylaneInvoice(invoiceId: number): Promise<any> {
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    if ((invoice as any).market !== 'fr' || (invoice as any).provider !== 'pennylane') {
      throw new Error('Only pending French Pennylane invoices can be retried');
    }
    if ((invoice as any).providerStatus === 'issued') return invoice;
    const order = invoice.orderId ? await storage.getOrder(invoice.orderId) : undefined;
    if (!order) throw new Error('Invoice order not found');
    const billing = (order.billingAddress as any) || {};
    const shipping = (order.shippingAddress as any) || {};
    const user = order.userId
      ? await storage.getUser(order.userId)
      : {
          id: 0,
          email: billing.email || shipping.email || '',
          firstName: billing.firstName || shipping.firstName || 'Guest',
          lastName: billing.lastName || shipping.lastName || 'Customer',
        };
    return this.generatePennylaneInvoice(
      order,
      user,
      { paymentMethod: order.paymentMethod || 'card', status: 'succeeded' },
      await getCompanySettingsByMarket('fr'),
    );
  }

  async testPennylaneConnection(): Promise<boolean> {
    if (!this.pennylaneApi) return false;
    await this.pennylaneApi.testConnection();
    return true;
  }

  /**
   * Generate invoice via Smartbill API
   */
  private async generateSmartbillInvoice(order: any, user: any, paymentData: any, companyInfo?: any): Promise<any> {
    try {
      console.log(`🚀 STARTING SMARTBILL INVOICE GENERATION for order ${order.id}`);
      console.log(`   User: ${user.email}, Series: ${this.config.defaultSeries}`);
      
      // Use per-request companyInfo (passed in) to avoid shared-singleton mutation
      const defaultVatPercentage = parseFloat(companyInfo?.defaultVatPercentage || this.config.companyInfo?.defaultVatPercentage || '19');
      const smartbillInvoiceData = orderToSmartbillInvoice(
        order,
        user,
        this.config.smartbill,
        this.config.defaultSeries,
        defaultVatPercentage
      );
      
      console.log(`📋 Smartbill invoice data prepared:`, JSON.stringify(smartbillInvoiceData, null, 2));

      // Create invoice via Smartbill API
      console.log(`🌐 Sending request to Smartbill API...`);
      const smartbillResult = await this.smartbillApi.createInvoice(smartbillInvoiceData);

      // Store invoice reference in local database with proper KTO format
      const subtotalNum = parseFloat(order.totalAmount);
       const vatRate = parseFloat(String(
         companyInfo?.defaultVatPercentage ??
         ((order.market || "ro") === "fr" ? "20" : "21")
       ));
      const vatAmountCalc = (subtotalNum * vatRate) / (100 + vatRate);
      const subtotalWithoutVat = subtotalNum - vatAmountCalc;

      const invoiceData = {
        invoiceNumber: `${smartbillResult.series} ${smartbillResult.number}`,
        orderId: order.id,
         market: order.market || "ro",
        userId: order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmountCalc.toFixed(2),
        totalAmount: order.totalAmount,
         currency: order.currency || ((order.market || "ro") === "ro" ? "RON" : "EUR"),
        paymentMethod: paymentData.paymentMethod || 'card',
        paymentLink: null,
         notes: `Generated via Smartbill API - TVA ${vatRate}%`,
        smartbillSeries: smartbillResult.series,
        smartbillNumber: smartbillResult.number.toString(),
        smartbillId: smartbillResult.id,
        status: 'issued'
      };

      // Create invoice items for local storage
      const invoiceItems = order.items.map((item: any) => ({
        productId: item.productId,
        productName: invoiceProductName(item),
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
         vatRate: vatRate.toFixed(2),
        lineTotal: item.totalPrice,
      }));

      const localInvoice = await storage.createInvoice(invoiceData, invoiceItems);

      console.log(`🎉 ✅ SMARTBILL INVOICE SUCCESSFULLY CREATED!`);
      console.log(`   Invoice Number: ${smartbillResult.series}-${smartbillResult.number}`);
      console.log(`   Smartbill ID: ${smartbillResult.id}`);
      console.log(`   Local Invoice ID: ${localInvoice.id}`);

      return {
        ...localInvoice,
        smartbillData: smartbillResult,
        pdfUrl: smartbillResult.url || null
      };

    } catch (error) {
      console.error('Smartbill invoice generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Smartbill invoice generation failed: ${errorMessage}`);
    }
  }

  /**
   * Generate invoice locally (fallback method) with proper Smartbill numbering
   */
  private async generateLocalInvoice(order: any, user: any, paymentData: any, companyInfo?: any): Promise<any> {
    try {
      // Get next invoice number from Smartbill series format: KTO 10001, KTO 10002, etc.
      let invoiceNumber = 'KTO 10001'; // Default fallback
      let smartbillNumber = '10001';
      
      if (this.config.enableSmartbill) {
        try {
          // Try to get next invoice number from Smartbill
          const seriesResponse: any = await this.smartbillApi.getSeries(this.config.smartbill.companyVat);
          const seriesData = seriesResponse.list || seriesResponse; // Handle both response formats
          const ktoSeries = seriesData.find((s: any) => s.name === 'KTO' && s.type === 'f'); // 'f' = factura (invoice)
          if (ktoSeries && ktoSeries.nextNumber) {
            smartbillNumber = ktoSeries.nextNumber.toString();
            invoiceNumber = `KTO ${smartbillNumber}`;
            console.log(`📋 Got next invoice number from Smartbill: ${invoiceNumber}`);
          } else {
            console.log(`⚠️ KTO series not found in Smartbill, using fallback numbering`);
            console.log(`   Available series:`, JSON.stringify(seriesData, null, 2));
          }
        } catch (error) {
          console.log(`⚠️ Failed to get Smartbill series data, using fallback numbering: ${error}`);
          // Fallback: Use timestamp-based numbering starting from 10001
          const timestamp = Date.now();
          const lastDigits = parseInt(timestamp.toString().slice(-4));
          smartbillNumber = (10001 + (lastDigits % 1000)).toString();
          invoiceNumber = `KTO ${smartbillNumber}`;
        }
      }
      
      console.log(`📋 Generating local invoice with Smartbill format: ${invoiceNumber}`);
      
      // Calculate totals with 21% VAT for RON
      const subtotal = parseFloat(order.totalAmount);
       const vatRate = parseFloat(String(
         companyInfo?.defaultVatPercentage ??
         ((order.market || "ro") === "fr" ? "20" : "21")
       ));
      const vatAmount = (subtotal * vatRate) / (100 + vatRate); // Extract VAT from total (price includes VAT)
      const subtotalWithoutVat = subtotal - vatAmount;
      const totalAmount = subtotal; // Total already includes VAT

      // Create invoice with proper Smartbill numbering format
      const invoiceData = {
        invoiceNumber,
        orderId: order.id,
        market: order.market || "ro",
        userId: order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: order.currency || ((order.market || "ro") === "ro" ? "RON" : "EUR"),
        paymentMethod: paymentData.paymentMethod || 'card',
        paymentLink: null,
        notes: `Factura cu TVA ${vatRate}% pentru piața ${(order.market || "ro").toUpperCase()}`,
        status: 'issued',
        // Use proper Smartbill series format
        smartbillSeries: 'KTO',
        smartbillNumber: smartbillNumber
      };

      // Create invoice items with 21% VAT
      const invoiceItems: any[] = order.items.map((item: any) => ({
        productId: item.productId,
        productName: invoiceProductName(item),
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: vatRate.toFixed(2),
        lineTotal: item.totalPrice,
      }));

      // Add discount line BEFORE shipping (discount applies only to products, not transport)
      const localDiscountAmount = parseFloat(order.discountAmount || '0') ||
        (() => {
          const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)\s*\(-?([\d.]+)\)/);
          return m ? parseFloat(m[2]) : 0;
        })();
      const localVoucherCode = order.voucherCode ||
        (() => {
          const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)/);
          return m ? m[1] : '';
        })();

      if (localDiscountAmount > 0) {
        invoiceItems.push({
          productId: null,
          productName: `Discount voucher${localVoucherCode ? ' ' + localVoucherCode : ''}`,
          productCode: 'DISCOUNT',
          quantity: 1,
          unitPrice: (-Math.abs(localDiscountAmount)).toFixed(2),
          vatRate: vatRate.toFixed(2),
          lineTotal: (-Math.abs(localDiscountAmount)).toFixed(2),
        });
      }

      const invoice = await storage.createInvoice(invoiceData, invoiceItems);
      
      // Get the full invoice with items for response
      const fullInvoice = await storage.getInvoice(invoice.id);
      
      return fullInvoice;

    } catch (error) {
      console.error('Local invoice generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a local PDF invoice for fr/com markets with per-market sequential numbering
   */
  private async generateLocalInvoiceForMarket(order: any, user: any, paymentData: any, companyInfo?: any, market: string = 'fr'): Promise<any> {
    try {
      // Get next sequential number for this market
      const { formatted: invoiceNumber } = await getNextInvoiceNumber(market);
      console.log(`📋 [${market.toUpperCase()}] Generating local PDF invoice: ${invoiceNumber}`);

      const currency = order.currency || (market === 'ro' ? 'RON' : 'EUR');
      const vatRate = parseFloat(String(
        companyInfo?.defaultVatPercentage ??
        (market === 'fr' ? 20 : 21)
      ));
      const totalAmount = parseFloat(order.totalAmount);
      const vatAmount = (totalAmount * vatRate) / (100 + vatRate);
      const subtotalWithoutVat = totalAmount - vatAmount;

      // Build invoice items
      const items: any[] = (order.items || []).map((item: any) => ({
        productId: item.productId,
        productName: invoiceProductName(item),
        productCode: item.product?.productCode || null,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price),
        vatRate: vatRate.toFixed(2),
        lineTotal: parseFloat(item.totalPrice),
      }));

      // Add discount if present
      const discountAmount = parseFloat(order.discountAmount || '0') ||
        (() => { const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)\s*\(-?([\d.]+)\)/); return m ? parseFloat(m[2]) : 0; })();
      const voucherCode = order.voucherCode ||
        (() => { const m = (order.notes || '').match(/Voucher:\s*([^\s(]+)/); return m ? m[1] : ''; })();
      if (discountAmount > 0) {
        items.push({
          productId: null,
          productName: `Remise${voucherCode ? ' ' + voucherCode : ''}`,
          productCode: 'DISCOUNT',
          quantity: 1,
          unitPrice: (-Math.abs(discountAmount)).toFixed(2),
          vatRate: vatRate.toFixed(2),
          lineTotal: (-Math.abs(discountAmount)).toFixed(2),
        });
      }

      // Resolve buyer info from order
      const billing = (order.billingAddress as any) || {};
      const shipping = (order.shippingAddress as any) || {};
      const buyerName = `${billing.firstName || shipping.firstName || user?.firstName || ''} ${billing.lastName || shipping.lastName || user?.lastName || ''}`.trim();

      // Build PDF data
      const pdfData: PdfInvoiceData = {
        invoiceNumber,
        issueDate: new Date(),
        market,
        currency,
        seller: {
          name: companyInfo?.name || 'xHACCP',
          address: companyInfo?.address,
          city: companyInfo?.city,
          zipCode: companyInfo?.zipCode,
          country: companyInfo?.country,
          vatNumber: companyInfo?.vatNumber,
          registrationNumber: companyInfo?.registrationNumber,
          email: companyInfo?.email,
          phone: companyInfo?.phone,
          iban: companyInfo?.iban,
          bankName: companyInfo?.bankName,
        },
        buyer: {
          name: buyerName,
          companyName: billing.companyName || user?.companyName || '',
          address: billing.address || shipping.address || user?.companyAddress || '',
          city: billing.city || shipping.city || user?.companyCity || '',
          zipCode: billing.zipCode || shipping.zipCode || user?.companyZip || '',
          country: billing.country || shipping.country || user?.companyCountry || '',
          vatNumber: billing.vatNumber || user?.vatNumber || '',
          email: billing.email || shipping.email || user?.email || '',
        },
        items: items.map(it => ({
          productName: it.productName,
          productCode: it.productCode,
          quantity: it.quantity,
          unitPrice: parseFloat(it.unitPrice),
          vatRate: parseFloat(it.vatRate),
          lineTotal: parseFloat(it.lineTotal),
        })),
        subtotal: subtotalWithoutVat,
        vatAmount,
        totalAmount,
        notes: order.notes || undefined,
        paymentMethod: paymentData.paymentMethod || order.paymentMethod || '',
      };

      // Generate PDF file
      const pdfPath = await generateInvoicePdf(pdfData);
      console.log(`✅ [${market.toUpperCase()}] PDF generated: ${pdfPath}`);

      // Store in DB with market + pdfPath
      const invoiceRecord = {
        invoiceNumber,
        orderId: order.id,
        userId: order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency,
        paymentMethod: paymentData.paymentMethod || 'card',
        notes: market === 'fr' ? 'Facture locale — dépôt Chorus Pro en attente' : 'Local invoice',
        status: 'issued',
        market,
        pdfPath,
        efacturaStatus: market === 'fr' ? 'pending' : undefined,
      };

      const invoice = await storage.createInvoice(invoiceRecord, items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        productCode: it.productCode,
        quantity: it.quantity,
        unitPrice: String(it.unitPrice),
        vatRate: String(it.vatRate),
        lineTotal: String(it.lineTotal),
      })));

      // Fire-and-forget: submit to fr-specific Chorus Pro hook (stub) after creation
      if (market === 'fr') {
        this.submitToChorusPro(invoice.id).catch(err =>
          console.error(`[FR] Chorus Pro submission failed for invoice ${invoice.id}:`, err)
        );
      }

      const fullInvoice = await storage.getInvoice(invoice.id);
      return fullInvoice;

    } catch (error) {
      console.error(`[${market.toUpperCase()}] Local PDF invoice generation failed:`, error);
      throw error;
    }
  }

  /**
   * Get invoice PDF (from Smartbill if available)
   */
  async getInvoicePdf(invoiceId: number): Promise<Buffer | null> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // If invoice has a local PDF path, return from disk
      if ((invoice as any).pdfPath && pdfExists((invoice as any).pdfPath)) {
        return await getInvoicePdfBuffer((invoice as any).pdfPath);
      }

      // If invoice has Smartbill data, get PDF from Smartbill
      if (invoice.smartbillSeries && invoice.smartbillNumber && this.config.enableSmartbill) {
        return await this.smartbillApi.getInvoicePdf(
          this.config.smartbill.companyVat,
          invoice.smartbillSeries,
          invoice.smartbillNumber
        );
      }

      if ((invoice as any).provider === 'pennylane' && (invoice as any).providerInvoiceId && this.pennylaneApi) {
        const remote = await this.pennylaneApi.getInvoice((invoice as any).providerInvoiceId);
        return await this.pennylaneApi.downloadInvoicePdf(remote);
      }

      // Otherwise return null
      return null;

    } catch (error) {
      console.error('Error getting invoice PDF:', error);
      return null;
    }
  }

  /**
   * Send invoice by email
   */
  async sendInvoiceByEmail(invoiceId: number, recipientEmail?: string): Promise<boolean> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const email = recipientEmail || invoice.user.email;
      
      if (invoice.smartbillSeries && invoice.smartbillNumber && this.config.enableSmartbill) {
        await this.smartbillApi.sendInvoiceByEmail(
          this.config.smartbill.companyVat,
          invoice.smartbillSeries,
          invoice.smartbillNumber,
          email,
          `Invoice ${invoice.invoiceNumber} from xHACCP`,
          'Please find attached your invoice. Thank you for your business!'
        );
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error sending invoice by email:', error);
      return false;
    }
  }

  /**
   * Check if invoice is paid via Smartbill
   */
  async checkInvoicePaymentStatus(invoiceId: number): Promise<boolean> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return false;
      }

      if (invoice.smartbillSeries && invoice.smartbillNumber && this.config.enableSmartbill) {
        return await this.smartbillApi.isInvoicePaid(
          this.config.smartbill.companyVat,
          invoice.smartbillSeries,
          invoice.smartbillNumber
        );
      }

      // For local invoices, check payment status from order
      const order = invoice.orderId ? await storage.getOrder(invoice.orderId) : null;
      return order?.paymentStatus === 'paid';

    } catch (error) {
      console.error('Error checking invoice payment status:', error);
      return false;
    }
  }

  /**
   * Stub: Submit invoice to e-Factura (Romanian ANAF e-invoicing system) — .ro market only.
   * Will be wired to ANAF SPV API when credentials are available.
   * Only accepts .ro invoices — admin-triggered from UI.
   */
  async submitToEfactura(invoiceId: number): Promise<{ status: string; ref?: string; message: string }> {
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return { status: 'error', message: 'Invoice not found' };
    const market = (invoice as any).market || 'ro';
    if (market !== 'ro') return { status: 'error', message: 'e-Factura (ANAF SPV) only applies to .ro market' };

    console.log(`[e-Factura STUB] Would submit invoice ${(invoice as any).invoiceNumber} (id=${invoiceId}) to ANAF SPV`);
    try {
      await storage.updateInvoice(invoiceId, { efacturaStatus: 'pending' } as any);
    } catch (_) { /* ignore */ }
    return { status: 'pending', message: 'e-Factura submission stub — ANAF SPV integration pending' };
  }

  /**
   * Stub: Submit .fr invoice to Chorus Pro (French government e-invoicing portal).
   * Fires automatically after local PDF generation for fr market (fire-and-forget).
   * Will be wired to Chorus Pro API when credentials are available.
   */
  async submitToChorusPro(invoiceId: number): Promise<{ status: string; ref?: string; message: string }> {
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return { status: 'error', message: 'Invoice not found' };
    const market = (invoice as any).market || 'fr';
    if (market !== 'fr') return { status: 'error', message: 'Chorus Pro only applies to .fr market' };

    console.log(`[Chorus Pro STUB] Would submit invoice ${(invoice as any).invoiceNumber} (id=${invoiceId}) to Chorus Pro`);
    try {
      // Mark efactura_status as 'submitted' to track the background hook fired
      await storage.updateInvoice(invoiceId, { efacturaStatus: 'submitted' } as any);
    } catch (_) { /* ignore */ }
    return { status: 'submitted', message: 'Chorus Pro submission stub — awaiting API credentials' };
  }

  /**
   * Stub: Submit invoice to an external accounting API — .com market (e.g. Peppol, HMRC).
   * Admin-triggered from UI.
   */
  async submitToExternalApi(invoiceId: number): Promise<{ status: string; ref?: string; message: string }> {
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return { status: 'error', message: 'Invoice not found' };
    const market = (invoice as any).market || 'ro';
    if (market !== 'com') return { status: 'error', message: 'External API submission applies to .com market only' };

    console.log(`[External API STUB] Would submit invoice ${(invoice as any).invoiceNumber} (id=${invoiceId}) to external API`);
    try {
      await storage.updateInvoice(invoiceId, { externalRef: `EXT-STUB-${invoiceId}` } as any);
    } catch (_) { /* ignore */ }
    return { status: 'stub', ref: `EXT-STUB-${invoiceId}`, message: 'External API submission stub — endpoint not yet configured' };
  }
}

// Initialize invoice service with configuration
export async function createInvoiceService(): Promise<InvoiceService> {
  // Get company settings for invoice configuration
  const companySettings = await getCompanySettings();
  
  console.log('🏭 Company settings for invoice service:', {
    name: companySettings.name,
    vatNumber: companySettings.vatNumber
  });
  
  const config: InvoiceServiceConfig = {
    smartbill: {
      username: process.env.SMARTBILL_USERNAME || '',
      token: process.env.SMARTBILL_TOKEN || '',
      companyVat: process.env.SMARTBILL_COMPANY_VAT || 'RO16582983',
    },
    defaultSeries: 'KTO', // Use hardcoded series
    enableSmartbill: true, // Force enable Smartbill
    companyInfo: companySettings
  };

  console.log('📋 Final InvoiceService config:', {
    enableSmartbill: config.enableSmartbill,
    defaultSeries: config.defaultSeries,
    smartbill: config.smartbill
  });

  const pennylaneTransport = createPennylaneHttpTransport();
  return new InvoiceService({
    ...config,
    pennylane: pennylaneTransport ? new PennylaneClient(pennylaneTransport) : undefined,
  });
}

async function getPennylaneProductMapping(productId: number, market: string): Promise<{
  pennylaneProductId: string | null;
  pennylaneAccountingAccountId: string | null;
} | null> {
  const { pool } = await import('./db.js');
  const result = await pool.query(
    `SELECT pennylane_product_id as "pennylaneProductId",
            pennylane_accounting_account_id as "pennylaneAccountingAccountId"
       FROM product_markets
      WHERE product_id = $1 AND market = $2
      LIMIT 1`,
    [productId, market],
  );
  return result.rows[0] || null;
}

// Helper function to get company settings by market (exact-match only, no cross-market fallback)
async function getCompanySettingsByMarket(market: string) {
  const { pool } = await import('./db.js');
  try {
    // Exact-match only — no cross-market fallback to preserve per-market data isolation
    const result = await pool.query(`
      SELECT 
        name, email, logistics_email as "logisticsEmail", phone, address, city, state, zip_code as "zipCode", 
        country, contact_person as "contactPerson", website, 
        vat_number as "vatNumber", registration_number as "registrationNumber", 
        description, default_vat_percentage as "defaultVatPercentage"
      FROM company_settings 
      WHERE market_code = $1
      LIMIT 1
    `, [market]);
    if (result.rows.length > 0) return result.rows[0];
    return null;
  } catch (err) {
    console.error('Error fetching company settings by market:', err);
    return null;
  }
}

// Helper function to get company settings (global — used at service init)
async function getCompanySettings() {
  const { pool } = await import('./db.js');
  try {
    const result = await pool.query(`
      SELECT 
        name, email, logistics_email as "logisticsEmail", phone, address, city, state, zip_code as "zipCode", 
        country, contact_person as "contactPerson", website, 
        vat_number as "vatNumber", registration_number as "registrationNumber", 
        description, default_vat_percentage as "defaultVatPercentage"
      FROM company_settings 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      return result.rows[0];
    } else {
      // Return default company settings
      return {
        name: 'xHACCP',
        email: 'info@xhaccp.com',
        logisticsEmail: 'logistics@xhaccp.com',
        phone: '+40 123 456 789',
        address: 'Calea Mosilor 158',
        city: 'Bucharest',
        state: 'Bucuresti',
        zipCode: '020883',
        country: 'Romania',
        contactPerson: 'Company Administrator',
        website: 'https://xhaccp.com',
        vatNumber: '',
        registrationNumber: '',
        description: 'Professional kitchen equipment and supplies for the HORECA industry.'
      };
    }
  } catch (error) {
    console.error('Error fetching company settings for invoice:', error);
    // Return defaults on error
    return {
      name: 'xHACCP',
      email: 'info@xhaccp.com',
      logisticsEmail: 'logistics@xhaccp.com',
      vatNumber: '',
      registrationNumber: ''
    };
  }
}