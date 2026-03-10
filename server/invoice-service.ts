import { SmartbillAPI, SmartbillConfig, orderToSmartbillInvoice } from './smartbill-api.js';
import { storage } from './storage.js';

export interface InvoiceServiceConfig {
  smartbill: SmartbillConfig;
  defaultSeries: string;
  enableSmartbill: boolean;
  companyInfo?: any;
}

export class InvoiceService {
  private smartbillApi: SmartbillAPI;
  private config: InvoiceServiceConfig;

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

      if (this.config.enableSmartbill) {
        // Generate invoice via Smartbill API
        invoice = await this.generateSmartbillInvoice(order, user, paymentData);
      } else {
        // Fallback to local invoice generation
        invoice = await this.generateLocalInvoice(order, user, paymentData);
      }

      console.log(`Invoice generated successfully for order ${orderId}:`, invoice);
      return invoice;

    } catch (error) {
      console.error(`Error generating invoice for order ${orderId}:`, error);
      
      // If Smartbill fails, try local generation as fallback
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.config.enableSmartbill && errorMessage.includes('Smartbill')) {
        console.log('Smartbill failed, falling back to local invoice generation');
        try {
          const order = await storage.getOrder(orderId);
          if (!order) {
            throw new Error(`Order ${orderId} not found`);
          }
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
          return await this.generateLocalInvoice(order, user, paymentData);
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

      const paymentData = { 
        paymentMethod: options.paymentMethod || 'wire_transfer',
        status: 'manual_creation'
      };

      if (this.config.enableSmartbill) {
        console.log(`📋 ✅ ATTEMPTING SMARTBILL INVOICE CREATION - Series: ${this.config.defaultSeries}`);
        return await this.generateSmartbillInvoice(order, user, paymentData);
      } else {
        console.log(`📋 ⚠️ USING LOCAL INVOICE GENERATION - Smartbill disabled`);
        return await this.generateLocalInvoice(order, user, paymentData);
      }

    } catch (error) {
      console.error(`❌ Error creating invoice for order ${order.id}:`, error);
      
      // If Smartbill fails, try local generation as fallback
      if (this.config.enableSmartbill) {
        console.log('🔄 ⚠️ SMARTBILL FAILED - FALLING BACK TO LOCAL GENERATION');
        console.log(`   Smartbill error: ${error instanceof Error ? error.message : String(error)}`);
        try {
          const paymentData = { 
            paymentMethod: options.paymentMethod || 'wire_transfer',
            status: 'fallback_creation'
          };
          const localInvoice = await this.generateLocalInvoice(order, user, paymentData);
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
   * Generate invoice via Smartbill API
   */
  private async generateSmartbillInvoice(order: any, user: any, paymentData: any): Promise<any> {
    try {
      console.log(`🚀 STARTING SMARTBILL INVOICE GENERATION for order ${order.id}`);
      console.log(`   User: ${user.email}, Series: ${this.config.defaultSeries}`);
      
      // Convert order to Smartbill format
      const defaultVatPercentage = parseFloat(this.config.companyInfo?.defaultVatPercentage || '19');
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
      const vatRate = 21;
      const vatAmountCalc = (subtotalNum * vatRate) / (100 + vatRate);
      const subtotalWithoutVat = subtotalNum - vatAmountCalc;

      const invoiceData = {
        invoiceNumber: `${smartbillResult.series} ${smartbillResult.number}`,
        orderId: order.id,
        userId: order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmountCalc.toFixed(2),
        totalAmount: order.totalAmount,
        currency: 'RON',
        paymentMethod: paymentData.paymentMethod || 'card',
        paymentLink: null,
        notes: 'Generated via Smartbill API - TVA 21% conform legislației române',
        smartbillSeries: smartbillResult.series,
        smartbillNumber: smartbillResult.number.toString(),
        smartbillId: smartbillResult.id,
        status: 'issued'
      };

      // Create invoice items for local storage
      const invoiceItems = order.items.map((item: any) => ({
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: '21.00',
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
  private async generateLocalInvoice(order: any, user: any, paymentData: any): Promise<any> {
    try {
      // Get next invoice number from Smartbill series format: KTO 10001, KTO 10002, etc.
      let invoiceNumber = 'KTO 10001'; // Default fallback
      let smartbillNumber = '10001';
      
      if (this.config.enableSmartbill) {
        try {
          // Try to get next invoice number from Smartbill
          const seriesResponse = await this.smartbillApi.getSeries(this.config.smartbill.companyVat);
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
      const vatRate = 21; // 21% VAT for Romanian invoices
      const vatAmount = (subtotal * vatRate) / (100 + vatRate); // Extract VAT from total (price includes VAT)
      const subtotalWithoutVat = subtotal - vatAmount;
      const totalAmount = subtotal; // Total already includes VAT

      // Create invoice with proper Smartbill numbering format
      const invoiceData = {
        invoiceNumber,
        orderId: order.id,
        userId: order.userId || undefined,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: 'RON',
        paymentMethod: paymentData.paymentMethod || 'card',
        paymentLink: null,
        notes: 'Factura cu TVA 21% conform legislației române',
        status: 'issued',
        // Use proper Smartbill series format
        smartbillSeries: 'KTO',
        smartbillNumber: smartbillNumber
      };

      // Create invoice items with 21% VAT
      const invoiceItems = order.items.map((item: any) => ({
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: '21.00',
        lineTotal: item.totalPrice,
      }));

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
   * Get invoice PDF (from Smartbill if available)
   */
  async getInvoicePdf(invoiceId: number): Promise<Buffer | null> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // If invoice has Smartbill data, get PDF from Smartbill
      if (invoice.smartbillSeries && invoice.smartbillNumber && this.config.enableSmartbill) {
        return await this.smartbillApi.getInvoicePdf(
          this.config.smartbill.companyVat,
          invoice.smartbillSeries,
          invoice.smartbillNumber
        );
      }

      // Otherwise return null (local invoice handling would need separate PDF generation)
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
      username: 'liviu.chertes@gmail.com', // Corrected username - was @xhaccp.com
      token: '001|2af8fcdc3ea579cb7a81093ca404b31e', // Use hardcoded credentials
      companyVat: 'RO16582983', // Use hardcoded credentials with RO prefix
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

  return new InvoiceService(config);
}

// Helper function to get company settings
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