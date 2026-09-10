import { MailService } from '@sendgrid/mail';
import type { OrderWithItems, User } from '../shared/schema';
import {
  buildContactEmailTemplates,
  dedupeEmailAddresses,
  type ContactFormData,
  type ContactMarket,
} from './contact-email.js';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const VERIFIED_SENDER: string = process.env.SENDGRID_FROM_EMAIL || 'noreply@xhaccp.com';
const VERIFIED_SENDER_FR: string = process.env.SENDGRID_FROM_EMAIL_FR || 'info@xhaccp.fr';

export function getSenderForMarket(market?: string): string {
  return market?.toLowerCase() === 'fr' ? VERIFIED_SENDER_FR : VERIFIED_SENDER;
}

function getSenderForOrder(order: OrderWithItems): string {
  return getSenderForMarket((order as any).market);
}

function orderCurrency(order: OrderWithItems): string {
  return (order as any).currency || ((order as any).market === "ro" ? "RON" : "EUR");
}

function orderItemComponents(item: any): any[] {
  return Array.isArray(item?.compositeConfiguration?.components)
    ? item.compositeConfiguration.components
    : [];
}

function orderItemNameText(item: any): string {
  const productName = item.product?.name || `Product ${item.productId}`;
  const components = orderItemComponents(item);
  if (!components.length) return productName;
  return `${productName} [${components
    .map(component => `${component.name || `#${component.componentProductId}`} × ${component.quantity}`)
    .join(", ")}]`;
}

function orderItemNameHtml(item: any): string {
  const productName = item.product?.name || `Product ${item.productId}`;
  const components = orderItemComponents(item);
  if (!components.length) return productName;
  return `${productName}<div style="font-size:12px;color:#666;margin-top:4px;">${components
    .map(component => `${component.name || `#${component.componentProductId}`} × ${component.quantity}`)
    .join("<br>")}</div>`;
}

let mailService: MailService | null = null;

if (!SENDGRID_API_KEY) {
  console.warn("Warning: SENDGRID_API_KEY environment variable is not set. Email sending will be disabled.");
} else if (!VERIFIED_SENDER) {
  console.warn("Warning: SENDGRID_FROM_EMAIL environment variable is not set. Email sending will be disabled.");
} else {
  mailService = new MailService();
  mailService.setApiKey(SENDGRID_API_KEY);
  console.log(`Email service initialized with verified sender: ${VERIFIED_SENDER}`);
}

interface EmailAttachment {
  content: string; // base64
  filename: string;
  type: string;
  disposition: 'attachment' | 'inline';
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!mailService) {
    console.warn("Email service not configured. Skipping email send.");
    return false;
  }
  try {
    console.log(`Attempting to send email: from=${params.from}, to=${params.to}, subject=${params.subject.substring(0, 50)}...`);
    
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    };
    
    if (params.replyTo) {
      emailData.replyTo = params.replyTo;
    }

    if (params.attachments && params.attachments.length > 0) {
      emailData.attachments = params.attachments;
    }
    
    await mailService.send(emailData);
    console.log(`✅ Email sent successfully to: ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('❌ SendGrid email error:', {
      code: error.code,
      message: error.message,
      response: error.response?.body,
      to: params.to,
      from: params.from
    });
    
    // More detailed error information for debugging
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    
    return false;
  }
}

function escapeVoucherEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEventVoucherEmail(data: {
  to: string;
  firstName: string;
  code: string;
  validUntil: Date;
  discountValue: string;
}) {
  const firstName = escapeVoucherEmail(data.firstName);
  const code = escapeVoucherEmail(data.code);
  const validUntil = data.validUntil.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const discount = escapeVoucherEmail(data.discountValue);
  const shopUrl = "https://xhaccp.fr";
  const foodLabelsUrl = "https://xhaccp.fr/products?category=etiquettes-alimentaires";

  return {
    to: data.to,
    from: getSenderForMarket("fr"),
    subject: "Votre offre xHACCP France — 20 % de réduction",
    text: `Bonjour ${data.firstName},\n\nMerci pour votre inscription. Voici votre code personnel de réduction de ${data.discountValue} % : ${data.code}\n\nIl est valable jusqu'au ${validUntil} sur tous les produits disponibles sur ${shopUrl}. Le code peut être utilisé sans limite pendant sa période de validité.\n\nDécouvrir les étiquettes alimentaires : ${foodLabelsUrl}\n\nDécouvrir tous les produits : ${shopUrl}\n\nL'équipe xHACCP France`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
        <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033;">
          <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
            <div style="background:#0f2747;padding:22px 24px;border-radius:14px 14px 0 0;text-align:center;">
              <div style="font-size:26px;font-weight:700;color:#fff;">xHACCP France</div>
            </div>
            <div style="background:#fff;padding:30px 28px;border-radius:0 0 14px 14px;">
              <h1 style="margin:0 0 16px;color:#0f2747;font-size:25px;">Merci pour votre inscription, ${firstName} !</h1>
              <p style="font-size:16px;line-height:1.6;">Profitez de <strong>${discount} % de réduction</strong> sur tous les produits de xHACCP France.</p>
              <div style="margin:26px 0;padding:20px;text-align:center;background:#eef6ff;border:2px dashed #1976d2;border-radius:12px;">
                <div style="font-size:12px;color:#53657d;text-transform:uppercase;letter-spacing:1px;">Votre code personnel</div>
                <div style="margin-top:8px;font-size:30px;font-weight:700;letter-spacing:3px;color:#0f2747;">${code}</div>
              </div>
              <p style="line-height:1.6;">Votre code est valable jusqu'au <strong>${validUntil}</strong>, sans limite de commandes pendant sa période de validité.</p>
              <p style="text-align:center;margin:28px 0;">
                <a href="${foodLabelsUrl}" style="display:inline-block;padding:14px 24px;border-radius:8px;background:#1976d2;color:#fff;text-decoration:none;font-weight:700;">Découvrir les étiquettes alimentaires</a>
              </p>
              <p style="text-align:center;margin:0 0 24px;">
                <a href="${shopUrl}" style="color:#1976d2;font-weight:700;">Voir tous les produits xHACCP France</a>
              </p>
              <p style="font-size:12px;color:#68758a;line-height:1.5;">Cette offre est liée à votre inscription à l'événement. Pour toute question, contactez l'équipe xHACCP France.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}

export async function sendEventVoucherEmail(data: {
  to: string;
  firstName: string;
  code: string;
  validUntil: Date;
  discountValue: string;
}): Promise<boolean> {
  return sendEmail(buildEventVoucherEmail(data));
}

export async function sendSubscriptionRenewalEmail(
  customerEmail: string,
  order: OrderWithItems,
  invoicePdfBuffer?: Buffer | null,
  invoiceNumber?: string,
): Promise<boolean> {
  const currency = orderCurrency(order);
  const total = Number.parseFloat(String(order.totalAmount)).toFixed(2);
  const customer = (order.billingAddress as any)?.firstName ||
    (order.shippingAddress as any)?.firstName || "Client";
  return sendEmail({
    to: customerEmail,
    from: getSenderForOrder(order),
    subject: `Subscription payment confirmed — order #${order.id}`,
    text: `Hello ${customer}, your monthly subscription payment of ${total} ${currency} was confirmed. Invoice: ${invoiceNumber || "attached"}.`,
    html: `<p>Hello ${customer},</p><p>Your monthly subscription payment of <strong>${total} ${currency}</strong> was confirmed.</p><p>Your invoice is attached.</p>`,
    attachments: invoicePdfBuffer ? [{
      content: invoicePdfBuffer.toString("base64"),
      filename: `${invoiceNumber || `invoice-${order.id}`}.pdf`,
      type: "application/pdf",
      disposition: "attachment",
    }] : undefined,
  });
}

export async function sendSubscriptionPaymentFailureEmail(params: {
  customerEmail: string;
  market: string;
  productName: string;
  amount: string | number;
  currency: string;
  attemptNumber: number;
  maxAttempts: number;
  failureReason?: string | null;
  accountUrl: string;
}): Promise<boolean> {
  const french = params.market.toLowerCase() === "fr";
  const amount = Number.parseFloat(String(params.amount)).toFixed(2);
  const finalAttempt = params.attemptNumber >= params.maxAttempts;
  const subject = french
    ? `Action requise : paiement de votre abonnement échoué`
    : `Acțiune necesară: plata abonamentului nu a reușit`;
  const text = french
    ? `Le paiement mensuel de ${amount} ${params.currency} pour ${params.productName} n'a pas abouti. ${finalAttempt ? "Votre abonnement est maintenant en attente." : "Nous réessaierons automatiquement."} Connectez-vous à votre compte pour effectuer le paiement ou remplacer votre carte : ${params.accountUrl}`
    : `Plata lunară de ${amount} ${params.currency} pentru ${params.productName} nu a reușit. ${finalAttempt ? "Abonamentul este acum în așteptare." : "Vom încerca automat din nou."} Accesați contul pentru a achita abonamentul sau pentru a înlocui cardul: ${params.accountUrl}`;
  const html = french
    ? `<p>Bonjour,</p><p>Le paiement mensuel de <strong>${amount} ${params.currency}</strong> pour <strong>${params.productName}</strong> n'a pas abouti.</p><p>${finalAttempt ? "Votre abonnement est maintenant en attente." : "Nous réessaierons automatiquement dans les prochaines 24 heures."} Vérifiez votre carte ou remplacez-la pour éviter une interruption.</p><p><a href="${params.accountUrl}">Gérer mon abonnement et mon paiement</a></p>`
    : `<p>Bună ziua,</p><p>Plata lunară de <strong>${amount} ${params.currency}</strong> pentru <strong>${params.productName}</strong> nu a reușit.</p><p>${finalAttempt ? "Abonamentul este acum în așteptare." : "Vom încerca automat din nou în următoarele 24 de ore."} Verificați cardul sau înlocuiți-l pentru a evita întreruperea.</p><p><a href="${params.accountUrl}">Gestionează abonamentul și plata</a></p>`;

  return sendEmail({
    to: params.customerEmail,
    from: getSenderForMarket(params.market),
    subject,
    text,
    html,
  });
}

export async function sendOrderConfirmationEmail(
  order: OrderWithItems,
  user: User,
  paymentMethod?: string,
  invoicePdfBuffer?: Buffer,
  invoiceNumber?: string
): Promise<boolean> {
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  
  const orderItemsHtml = order.items
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price} ${orderCurrency(order)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} ${orderCurrency(order)}</td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #27ae60; margin-top: 0;">Order Confirmation</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h3>
        <p>Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed.</p>
        
        <div style="margin: 20px 0;">
          <strong>Order Details:</strong><br>
          Order ID: #${order.id}<br>
          Order Date: ${new Date(order.createdAt!).toLocaleDateString()}<br>
          Status: <span style="color: #27ae60; font-weight: bold;">Accepted</span><br>
          Customer Email: ${user.email}<br>
          Contact Phone: ${shippingAddress.phone}<br>
          Payment: <span style="font-weight: bold; color: ${(paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? '#e67e22' : '#27ae60'};">${(paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? 'Plată ramburs (cash la livrare)' : paymentMethod === 'viva' || paymentMethod === 'card' ? 'Plătit online cu cardul' : 'În curs de procesare'}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Order Items:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
          </tbody>
          <tfoot>
            ${(() => {
              const shippingCost = parseFloat(order.shippingCost || '0');
              const discountAmt = parseFloat((order as any).discountAmount || '0');
              const voucherCode = (order as any).voucherCode || '';
              const itemsSubtotal = (parseFloat(order.totalAmount) + discountAmt - shippingCost).toFixed(2);
              const discountRow = discountAmt > 0 ? `
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right; color: #27ae60;">Discount voucher${voucherCode ? ' ' + voucherCode : ''}:</td>
                  <td style="padding: 8px; text-align: right; color: #27ae60;">-${discountAmt.toFixed(2)} lei</td>
                </tr>` : '';
              return `
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right; border-top: 1px solid #dee2e6;">Subtotal:</td>
                  <td style="padding: 8px; text-align: right; border-top: 1px solid #dee2e6;">${itemsSubtotal} lei</td>
                </tr>
                ${discountRow}
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right;">Transport:</td>
                  <td style="padding: 8px; text-align: right;">${shippingCost > 0 ? shippingCost.toFixed(2) + ' ' + orderCurrency(order) : 'Gratuit'}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; border-top: 2px solid #dee2e6;">Total:</td>
                  <td style="padding: 12px 8px; text-align: right; font-weight: bold; border-top: 2px solid #dee2e6;">${order.totalAmount} ${orderCurrency(order)}</td>
                </tr>
              `;
            })()}
          </tfoot>
        </table>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Delivery Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
            ${shippingAddress.address}<br>
            ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
            ${shippingAddress.country}<br>
            <strong>Phone:</strong> ${shippingAddress.phone}
          </p>
        </div>
        
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Billing Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${billingAddress.firstName} ${billingAddress.lastName}<br>
            ${billingAddress.address}<br>
            ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}<br>
            ${billingAddress.country}<br>
            <strong>Phone:</strong> ${billingAddress.phone}
          </p>
        </div>
      </div>

      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #27ae60;">What's Next?</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Our team will prepare your order for shipping</li>
          <li>You'll receive a shipping confirmation with tracking information</li>
          <li>Your order will be delivered to the address provided</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Questions about your order? Contact us at 
          <a href="mailto:info@xhaccp.com" style="color: #27ae60;">info@xhaccp.com</a>
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          Thank you for choosing xHACCP - Your Professional Kitchen Partner
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - Order Confirmation
    
    Hello ${user.firstName} ${user.lastName},
    
    Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed.
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Status: Accepted
    - Customer Email: ${user.email}
    - Contact Phone: ${shippingAddress.phone}
    - Payment: ${(paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? 'Plată ramburs (cash la livrare)' : paymentMethod === 'viva' || paymentMethod === 'card' ? 'Plătit online cu cardul' : 'În curs de procesare'}
    - Total Amount: ${order.totalAmount} ${orderCurrency(order)}
    
    Delivery Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    Billing Address:
    ${billingAddress.firstName} ${billingAddress.lastName}
    ${billingAddress.address}
    ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}
    ${billingAddress.country}
    Phone: ${billingAddress.phone}
    
    Your order will be prepared for shipping and you'll receive tracking information soon.
    
    Questions? Contact us at info@xhaccp.com
    
    Thank you for choosing xHACCP!
  `;

  const emailParams: Parameters<typeof sendEmail>[0] = {
    to: user.email,
    from: getSenderForOrder(order),
    subject: `Order Confirmation #${order.id} - xHACCP`,
    text: textContent,
    html: html,
  };

  // Attach invoice PDF for fr/com market local invoices
  if (invoicePdfBuffer && invoicePdfBuffer.length > 0) {
    const fname = invoiceNumber ? `Factura_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : `Factura_${order.id}.pdf`;
    emailParams.attachments = [{
      content: invoicePdfBuffer.toString('base64'),
      filename: fname,
      type: 'application/pdf',
      disposition: 'attachment',
    }];
    console.log(`📎 Attaching invoice PDF (${invoicePdfBuffer.length} bytes) to order confirmation email for order #${order.id}`);
  }

  return await sendEmail(emailParams);
}

export async function sendNewOrderNotificationEmail(
  order: OrderWithItems,
  user: User,
  logisticsEmail?: string
): Promise<boolean> {
  // Get logistics email from company settings if not provided
  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  
  // Create admin URL for order management
  const adminOrderUrl = `https://xhaccp.com/admin#orders-${order.id}`;
  
  const orderItemsText = order.items
    .map(item => `- ${orderItemNameText(item)} (Qty: ${item.quantity}) - ${item.totalPrice} ${orderCurrency(order)}`)
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order Created - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #f39c12; margin-top: 0;">🔔 New Order Created</h2>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">Order Awaiting Review</h3>
        <p><strong>Order ID:</strong> #${order.id}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt!).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${user.firstName} ${user.lastName}</p>
        <p><strong>Customer Email:</strong> ${user.email}</p>
        <p><strong>Customer Phone:</strong> ${shippingAddress.phone}</p>
        ${(() => {
          const sc = parseFloat((order as any).shippingCost || '0');
          const total = parseFloat(order.totalAmount || '0');
          const discountAmt = parseFloat((order as any).discountAmount || '0');
          const voucherCode = (order as any).voucherCode || '';
          const itemsSubtotal = (total + discountAmt - sc).toFixed(2);
          const discountLine = discountAmt > 0 ? `<p style="color:#27ae60;"><strong>Discount voucher${voucherCode ? ' ' + voucherCode : ''}:</strong> -${discountAmt.toFixed(2)} lei</p>` : '';
          return `<p><strong>Subtotal:</strong> ${itemsSubtotal} lei</p>
        ${discountLine}<p><strong>Transport:</strong> ${sc > 0 ? sc.toFixed(2) + ' lei' : 'Gratuit'}</p>
        <p style="font-size:15px;border-top:1px solid #e0e0e0;padding-top:6px;margin-top:4px;"><strong>Total:</strong> ${total.toFixed(2)} lei</p>`;
        })()}
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">PENDING REVIEW</span></p>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${adminOrderUrl}" 
           style="display: inline-block; background-color: #27ae60; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          🎯 VIEW & ACCEPT ORDER
        </a>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          Click the button above to review and accept this order
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Order Items:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price} ${orderCurrency(order)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} ${orderCurrency(order)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Delivery Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
            ${shippingAddress.address}<br>
            ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
            ${shippingAddress.country}<br>
            <strong>Phone:</strong> ${shippingAddress.phone}
          </p>
        </div>
        
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Billing Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${billingAddress.firstName} ${billingAddress.lastName}<br>
            ${billingAddress.address}<br>
            ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}<br>
            ${billingAddress.country}<br>
            <strong>Phone:</strong> ${billingAddress.phone || shippingAddress.phone}
          </p>
        </div>
      </div>

      ${order.notes ? `
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0c5460;">Customer Notes</h3>
          <p style="margin: 0;">${order.notes}</p>
        </div>
      ` : ''}

      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #856404;">🚨 Action Required</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li><strong>Review order details above</strong></li>
          <li><strong>Click "VIEW & ACCEPT ORDER" button</strong></li>
          <li><strong>Verify product availability</strong></li>
          <li><strong>Accept the order to begin processing</strong></li>
        </ol>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Direct admin link: 
          <a href="${adminOrderUrl}" style="color: #27ae60;">xhaccp.com/admin#orders-${order.id}</a>
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          xHACCP - Order Management System
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - New Order Created
    
    🔔 NEW ORDER AWAITING REVIEW
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Customer: ${user.firstName} ${user.lastName}
    - Customer Email: ${user.email}
    - Customer Phone: ${shippingAddress.phone}
    - Total Amount: ${order.totalAmount} ${orderCurrency(order)}
    - Payment Method: ${order.paymentMethod}
    - Status: PENDING REVIEW
    
    Items Ordered:
    ${orderItemsText}
    
    Delivery Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    Billing Address:
    ${billingAddress.firstName} ${billingAddress.lastName}
    ${billingAddress.address}
    ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}
    ${billingAddress.country}
    Phone: ${billingAddress.phone || shippingAddress.phone}
    
    ${order.notes ? `Customer Notes: ${order.notes}` : ''}
    
    🚨 ACTION REQUIRED:
    1. Review order details above
    2. Access admin panel: ${adminOrderUrl}
    3. Verify product availability
    4. Accept the order to begin processing
    
    Direct link: xhaccp.com/admin#orders-${order.id}
  `;

  return await sendEmail({
    to: logisticsEmail,
    from: getSenderForOrder(order),
    subject: `🔔 New Order #${order.id} - Awaiting Review & Acceptance`,
    text: textContent,
    html: html,
  });
}

export async function sendLogisticsNotificationEmail(
  order: OrderWithItems,
  user: User,
  logisticsEmail?: string
): Promise<boolean> {
  // Get logistics email from company settings if not provided
  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }
  const shippingAddress = order.shippingAddress as any;
  const customerName = `${user.firstName || shippingAddress?.firstName || 'Guest'} ${user.lastName || shippingAddress?.lastName || 'Customer'}`;
  const customerEmail = user.email || shippingAddress?.email || '';
  const customerPhone = shippingAddress?.phone || '';

  const orderItemsText = order.items
    .map(item => `- ${orderItemNameText(item)} (Qty: ${item.quantity}) - ${item.totalPrice} ${orderCurrency(order)}`)
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order for Processing - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #e74c3c; margin-top: 0;">New Order for Processing</h2>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">Order Accepted - Ready for Processing</h3>
        <p><strong>Order ID:</strong> #${order.id}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt!).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Customer Email:</strong> ${customerEmail}</p>
        <p><strong>Customer Phone:</strong> ${customerPhone}</p>
        ${(() => {
          const sc = parseFloat((order as any).shippingCost || '0');
          const total = parseFloat(order.totalAmount || '0');
          const discountAmt = parseFloat((order as any).discountAmount || '0');
          const voucherCode = (order as any).voucherCode || '';
          const itemsSubtotal = (total + discountAmt - sc).toFixed(2);
          const discountLine = discountAmt > 0 ? `<p style="color:#27ae60;"><strong>Discount voucher${voucherCode ? ' ' + voucherCode : ''}:</strong> -${discountAmt.toFixed(2)} lei</p>` : '';
          return `<p><strong>Subtotal:</strong> ${itemsSubtotal} lei</p>
        ${discountLine}<p><strong>Transport:</strong> ${sc > 0 ? sc.toFixed(2) + ' lei' : 'Gratuit'}</p>
        <p style="font-size:15px;border-top:1px solid #e0e0e0;padding-top:6px;margin-top:4px;"><strong>Total:</strong> ${total.toFixed(2)} lei</p>`;
        })()}
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Items to Prepare:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price} ${orderCurrency(order)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} ${orderCurrency(order)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Shipping Information</h3>
        <p style="margin: 0; line-height: 1.5;">
          <strong>Deliver to:</strong><br>
          ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
          ${shippingAddress.streetAddress}<br>
          ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
          ${shippingAddress.country}
        </p>
      </div>

      ${order.notes ? `
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0c5460;">Special Notes</h3>
          <p style="margin: 0;">${order.notes}</p>
        </div>
      ` : ''}

      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #155724;">Next Steps</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Verify product availability and prepare items</li>
          <li>Package the order securely</li>
          <li>Generate shipping label and tracking number</li>
          <li>Update order status to "shipped" in the system</li>
          <li>Send tracking information to customer</li>
        </ol>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Access the admin panel at 
          <a href="https://xhaccp.com/admin" style="color: #e74c3c;">xhaccp.com/admin</a>
          to manage this order
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - New Order for Processing
    
    ORDER ACCEPTED - READY FOR PROCESSING
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Customer: ${customerName}
    - Customer Email: ${customerEmail}
    - Customer Phone: ${customerPhone}
    - Total Amount: ${order.totalAmount} ${orderCurrency(order)}
    - Payment Method: ${order.paymentMethod}
    - Payment Status: ${order.paymentStatus}
    
    Items to Prepare:
    ${orderItemsText}
    
    Shipping Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    ${order.notes ? `Special Notes: ${order.notes}` : ''}
    
    Next Steps:
    1. Verify product availability and prepare items
    2. Package the order securely
    3. Generate shipping label and tracking number
    4. Update order status to "shipped" in the system
    5. Send tracking information to customer
    
    Access the admin panel at xhaccp.com/admin to manage this order.
  `;

  return await sendEmail({
    to: logisticsEmail,
    from: getSenderForOrder(order),
    subject: `New Order #${order.id} - Ready for Processing`,
    text: textContent,
    html: html,
  });
}

// Helper function to get logistics email from company settings
async function getLogisticsEmailFromSettings(): Promise<string | null> {
  try {
    const { pool } = await import('./db.js');
    const result = await pool.query('SELECT logistics_email FROM company_settings ORDER BY created_at DESC LIMIT 1');
    return result.rows.length > 0 ? result.rows[0].logistics_email : null;
  } catch (error) {
    console.error('Error fetching logistics email from settings:', error);
    return null;
  }
}

export async function sendNotificationPreferencesEmail(
  user: User,
  preferences: {
    emailNotifications: boolean;
    orderUpdates: boolean;
    productRestocks: boolean;
    priceDrops: boolean;
    promotions: boolean;
  },
  market?: string,
): Promise<boolean> {
  const preferencesHtml = `
    <ul style="list-style-type: none; padding: 0;">
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Email notifications:</strong> 
        <span style="color: ${preferences.emailNotifications ? '#27ae60' : '#e74c3c'};">
          ${preferences.emailNotifications ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Order updates:</strong> 
        <span style="color: ${preferences.orderUpdates ? '#27ae60' : '#e74c3c'};">
          ${preferences.orderUpdates ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Product restocks:</strong> 
        <span style="color: ${preferences.productRestocks ? '#27ae60' : '#e74c3c'};">
          ${preferences.productRestocks ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Price drops:</strong> 
        <span style="color: ${preferences.priceDrops ? '#27ae60' : '#e74c3c'};">
          ${preferences.priceDrops ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0;">
        <strong>Promotions:</strong> 
        <span style="color: ${preferences.promotions ? '#27ae60' : '#e74c3c'};">
          ${preferences.promotions ? 'Enabled' : 'Disabled'}
        </span>
      </li>
    </ul>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Notification Preferences Updated - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #27ae60; margin-top: 0;">Notification Preferences Updated</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h3>
        <p>Your notification preferences have been successfully updated. Here are your current settings:</p>
      </div>

      <div style="margin-bottom: 20px; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Current Notification Settings:</h3>
        ${preferencesHtml}
      </div>

      <div style="margin-top: 30px; padding: 15px; background-color: #e8f5e8; border-radius: 8px;">
        <p style="margin: 0; color: #2c3e50;">
          <strong>Need to make changes?</strong><br>
          You can update your notification preferences anytime by visiting your account settings.
        </p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
        <p>This is a confirmation email from xHACCP.</p>
        <p>© 2025 xHACCP. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: user.email,
    from: getSenderForMarket(market || (user as any).market),
    subject: 'Notification Preferences Updated - xHACCP',
    html,
    text: `Hello ${user.firstName}, your notification preferences have been updated successfully. Email notifications: ${preferences.emailNotifications ? 'Enabled' : 'Disabled'}, Order updates: ${preferences.orderUpdates ? 'Enabled' : 'Disabled'}, Product restocks: ${preferences.productRestocks ? 'Enabled' : 'Disabled'}, Price drops: ${preferences.priceDrops ? 'Enabled' : 'Disabled'}, Promotions: ${preferences.promotions ? 'Enabled' : 'Disabled'}.`
  });
}

export interface ContactEmailOptions {
  market: ContactMarket;
  businessEmails: string[];
  send?: typeof sendEmail;
}

export interface ContactEmailResults {
  ticketId: string;
  market: ContactMarket;
  toBusinessSent: boolean;
  toCustomerSent: boolean;
  businessRecipientsAttempted: number;
  businessRecipientsSent: number;
  businessRecipientsFailed: number;
}

// Send independently to every configured market recipient, then confirm to the
// customer only after at least one business recipient accepted the message.
export async function sendContactFormEmails(
  data: ContactFormData,
  options: ContactEmailOptions,
): Promise<ContactEmailResults> {
  const ticketId = `TICKET_${Date.now()}`;
  const sender = options.send || sendEmail;
  const businessEmails = dedupeEmailAddresses(options.businessEmails);
  const templates = buildContactEmailTemplates(
    data,
    options.market,
    ticketId,
  );

  console.log("📧 Sending contact form notifications", {
    market: options.market,
    businessRecipients: businessEmails.length,
  });

  const businessResults = await Promise.all(
    businessEmails.map(async (recipient) => {
      try {
        return await sender({
          to: recipient,
           from: getSenderForMarket(options.market),
          subject: templates.business.subject,
          text: templates.business.text,
          html: templates.business.html,
          replyTo: data.email,
        });
      } catch (error) {
        console.error("Contact notification send failed for one configured recipient");
        return false;
      }
    }),
  );

  const businessRecipientsSent = businessResults.filter(Boolean).length;
  const toBusinessSent = businessRecipientsSent > 0;
  let toCustomerSent = false;

  if (toBusinessSent) {
    try {
      toCustomerSent = await sender({
        to: data.email,
        from: getSenderForMarket(options.market),
        subject: templates.customer.subject,
        text: templates.customer.text,
        html: templates.customer.html,
      });
    } catch (error) {
      console.error("Contact confirmation email failed");
    }
  }

  const results: ContactEmailResults = {
    ticketId,
    market: options.market,
    toBusinessSent,
    toCustomerSent,
    businessRecipientsAttempted: businessEmails.length,
    businessRecipientsSent,
    businessRecipientsFailed: businessEmails.length - businessRecipientsSent,
  };
  console.log("📧 Contact form delivery summary", results);
  return results;
}

export async function sendLogisticsAWBEmail(
  order: OrderWithItems,
  awbNumber: string,
  awbPdfBuffer?: Buffer,
  logisticsEmail?: string
): Promise<boolean> {
  if (!mailService || !VERIFIED_SENDER) {
    console.warn("Email service not configured. Skipping logistics AWB email.");
    return false;
  }

  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }

  const shippingAddress = order.shippingAddress as any;
  const trackingUrl = `https://sameday.ro/status-colet/?awb=${awbNumber}`;

  const orderItemsHtml = order.items
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} ${orderCurrency(order)}</td>
      </tr>
    `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Shipment - AWB ${awbNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">📦 New Shipment Ready</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Order #${order.id} - AWB: ${awbNumber}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
        <h2 style="color: #1a56db; font-size: 16px; margin-top: 0;">Shipping Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 140px;">AWB Number:</td>
            <td style="padding: 4px 0;">${awbNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Tracking:</td>
            <td style="padding: 4px 0;"><a href="${trackingUrl}" style="color: #1a56db;">${trackingUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Courier:</td>
            <td style="padding: 4px 0;">Sameday</td>
          </tr>
          ${(() => {
            const sc = parseFloat((order as any).shippingCost || '0');
            const total = parseFloat(order.totalAmount || '0');
            const discountAmt = parseFloat((order as any).discountAmount || '0');
            const vc = (order as any).voucherCode || '';
            const itemsSubtotal = (total + discountAmt - sc).toFixed(2);
            const discountRow = discountAmt > 0 ? `<tr>
            <td style="padding: 4px 0; font-weight: bold; color: #27ae60;">Discount voucher${vc ? ' ' + vc : ''}:</td>
            <td style="padding: 4px 0; color: #27ae60;">-${discountAmt.toFixed(2)} lei</td>
          </tr>` : '';
            return `<tr>
            <td style="padding: 4px 0; font-weight: bold;">Subtotal:</td>
            <td style="padding: 4px 0;">${itemsSubtotal} lei</td>
          </tr>
          ${discountRow}<tr>
            <td style="padding: 4px 0; font-weight: bold;">Transport:</td>
            <td style="padding: 4px 0;">${sc > 0 ? sc.toFixed(2) + ' lei' : 'Gratuit'}</td>
          </tr>
          <tr style="border-top: 1px solid #dee2e6;">
            <td style="padding: 6px 0; font-weight: bold; font-size: 15px;">Total:</td>
            <td style="padding: 6px 0; font-weight: bold; font-size: 15px;">${total.toFixed(2)} lei</td>
          </tr>`;
          })()}
        </table>

        <h2 style="color: #1a56db; font-size: 16px; margin-top: 20px;">Recipient</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 4px 0;">${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Phone:</td>
            <td style="padding: 4px 0;">${shippingAddress.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Address:</td>
            <td style="padding: 4px 0;">${shippingAddress.address || ''}, ${shippingAddress.city || ''}, ${shippingAddress.county || shippingAddress.state || ''} ${shippingAddress.zipCode || ''}</td>
          </tr>
        </table>

        <h2 style="color: #1a56db; font-size: 16px; margin-top: 20px;">Order Items</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 8px; text-align: left;">Product</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin: 0; color: #2e7d32; font-size: 14px;">
          ${awbPdfBuffer ? '📎 AWB label attached as PDF' : 'AWB PDF not available'}
        </p>
      </div>
      
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        This is an automated notification from xHACCP E-commerce Platform
      </p>
    </body>
    </html>
  `;

  const emailData: any = {
    to: logisticsEmail,
    from: getSenderForOrder(order),
    subject: `📦 New Shipment - Order #${order.id} - AWB: ${awbNumber}`,
    text: `New shipment for Order #${order.id}\nAWB: ${awbNumber}\nTracking: ${trackingUrl}\nRecipient: ${shippingAddress.firstName} ${shippingAddress.lastName}\nAddress: ${shippingAddress.address}, ${shippingAddress.city}\nTotal: ${order.totalAmount} ${orderCurrency(order)}`,
    html: html,
  };

  if (awbPdfBuffer && awbPdfBuffer.length > 0) {
    emailData.attachments = [{
      content: awbPdfBuffer.toString('base64'),
      filename: `AWB_${awbNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }];
  }

  try {
    await mailService.send(emailData);
    console.log(`✅ Logistics AWB email sent to ${logisticsEmail} for order #${order.id}, AWB: ${awbNumber}`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send logistics AWB email:', error.message);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    return false;
  }
}

export async function sendSupplierOrderEmail(
  supplierEmail: string,
  supplierName: string,
  order: OrderWithItems,
  supplierItems: { productName: string; quantity: number }[],
  awbNumber: string,
  awbPdfBuffer?: Buffer
): Promise<boolean> {
  if (!mailService || !VERIFIED_SENDER) {
    console.warn("Email service not configured. Skipping supplier order email.");
    return false;
  }

  const shippingAddress = order.shippingAddress as any;

  const itemsHtml = supplierItems.map(item => `
    <tr>
      <td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>
  `).join('');

  const itemsText = supplierItems.map(item => `- ${item.productName} x ${item.quantity}`).join('\n');
  const trackingUrl = `https://sameday.ro/status-colet/?awb=${awbNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>New Order - xHACCP</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">📦 New Order Request</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Order #${order.id}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
        <p>Dear ${supplierName},</p>
        <p>We have a new order that requires the following products to be prepared:</p>

        <h3 style="color: #2c3e50; margin-top: 20px;">Products to Prepare</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px 8px; text-align: left;">Product</th>
              <th style="padding: 10px 8px; text-align: center;">Quantity</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <h3 style="color: #2c3e50; margin-top: 20px;">Delivery Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 140px;">AWB Number:</td>
            <td style="padding: 4px 0;">${awbNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Tracking:</td>
            <td style="padding: 4px 0;"><a href="${trackingUrl}" style="color: #1a56db;">${trackingUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Courier:</td>
            <td style="padding: 4px 0;">Sameday</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Deliver to:</td>
            <td style="padding: 4px 0;">
              ${shippingAddress?.firstName || ''} ${shippingAddress?.lastName || ''}<br>
              ${shippingAddress?.streetAddress || shippingAddress?.address || ''}<br>
              ${shippingAddress?.city || ''}, ${shippingAddress?.state || shippingAddress?.county || ''} ${shippingAddress?.zipCode || ''}<br>
              ${shippingAddress?.country || 'Romania'}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Phone:</td>
            <td style="padding: 4px 0;">${shippingAddress?.phone || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin: 0; color: #2e7d32; font-size: 14px;">
          ${awbPdfBuffer ? '📎 AWB label attached as PDF' : ''}
        </p>
      </div>

      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        This is an automated notification from xHACCP E-commerce Platform
      </p>
    </body>
    </html>
  `;

  const emailData: any = {
    to: supplierEmail,
    from: getSenderForOrder(order),
    subject: `📦 New Order #${order.id} - Products to Prepare`,
    text: `New Order #${order.id}\n\nProducts to Prepare:\n${itemsText}\n\nAWB: ${awbNumber}\nTracking: ${trackingUrl}\nDeliver to: ${shippingAddress?.firstName || ''} ${shippingAddress?.lastName || ''}, ${shippingAddress?.streetAddress || shippingAddress?.address || ''}, ${shippingAddress?.city || ''}\nPhone: ${shippingAddress?.phone || 'N/A'}`,
    html,
  };

  if (awbPdfBuffer && awbPdfBuffer.length > 0) {
    emailData.attachments = [{
      content: awbPdfBuffer.toString('base64'),
      filename: `AWB_${awbNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }];
  }

  try {
    await mailService.send(emailData);
    console.log(`✅ Supplier order email sent to ${supplierEmail} for order #${order.id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send supplier order email to ${supplierEmail}:`, error.message);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    return false;
  }
}

export async function sendCustomerShipmentEmail(
  customerEmail: string,
  order: OrderWithItems,
  awbNumber: string,
  invoicePdfBuffer?: Buffer | null,
  invoiceNumber?: string,
  awbPdfBuffer?: Buffer | null
): Promise<boolean> {
  if (!mailService || !VERIFIED_SENDER) {
    console.warn("Email service not configured. Skipping customer shipment email.");
    return false;
  }

  const shippingAddress = order.shippingAddress as any;
  const trackingUrl = `https://sameday.ro/status-colet/?awb=${awbNumber}`;
  const customerName = `${shippingAddress?.firstName || 'Customer'} ${shippingAddress?.lastName || ''}`.trim();

  const orderItemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} ${orderCurrency(order)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Order Shipped - xHACCP</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #27ae60; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">✅ Order Accepted & Shipped</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Order #${order.id}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
        <p>Dear ${customerName},</p>
        <p>Your order has been accepted and is being prepared for delivery. Here are the shipping details:</p>

        <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e0e0e0;">
          <h3 style="color: #27ae60; margin-top: 0;">Shipping Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 140px;">AWB Number:</td>
              <td style="padding: 6px 0; font-size: 16px; font-weight: bold; color: #1a56db;">${awbNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Courier:</td>
              <td style="padding: 6px 0;">Sameday</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Tracking:</td>
              <td style="padding: 6px 0;"><a href="${trackingUrl}" style="color: #1a56db; text-decoration: none;">Track your package →</a></td>
            </tr>
          </table>
        </div>

        <h3 style="color: #2c3e50;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 8px; text-align: left;">Product</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
            ${(() => {
              const shippingCost = parseFloat(order.shippingCost || '0');
              const discountAmt = parseFloat((order as any).discountAmount || '0');
              const vc = (order as any).voucherCode || '';
              const itemsSubtotal = (parseFloat(order.totalAmount) + discountAmt - shippingCost).toFixed(2);
              const discountRow = discountAmt > 0 ? `
                <tr>
                  <td style="padding: 8px; color: #27ae60;" colspan="2">Discount voucher${vc ? ' ' + vc : ''}</td>
                  <td style="padding: 8px; text-align: right; color: #27ae60;">-${discountAmt.toFixed(2)} lei</td>
                </tr>` : '';
              return `
                <tr>
                  <td style="padding: 8px; border-top: 1px solid #ddd;" colspan="2">Subtotal</td>
                  <td style="padding: 8px; border-top: 1px solid #ddd; text-align: right;">${itemsSubtotal} lei</td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding: 8px;" colspan="2">Transport</td>
                  <td style="padding: 8px; text-align: right;">${shippingCost > 0 ? shippingCost.toFixed(2) + ' ' + orderCurrency(order) : 'Gratuit'}</td>
                </tr>
              `;
            })()}
            <tr style="font-weight: bold; background-color: #f0f0f0;">
              <td style="padding: 10px 8px;" colspan="2">Total</td>
              <td style="padding: 10px 8px; text-align: right;">${order.totalAmount} ${orderCurrency(order)}</td>
            </tr>
          </tbody>
        </table>

        ${invoiceNumber ? `
          <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-top: 15px; border: 1px solid #ffc107;">
            <p style="margin: 0; font-size: 14px;">
              📄 Invoice <strong>${invoiceNumber}</strong> ${invoicePdfBuffer ? 'is attached to this email' : 'has been issued'}
            </p>
          </div>
        ` : ''}

        <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #e0e0e0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Delivery Address</h3>
          <p style="margin: 0; line-height: 1.8;">
            ${shippingAddress?.firstName || ''} ${shippingAddress?.lastName || ''}<br>
            ${shippingAddress?.streetAddress || shippingAddress?.address || ''}<br>
            ${shippingAddress?.city || ''}, ${shippingAddress?.state || shippingAddress?.county || ''} ${shippingAddress?.zipCode || ''}<br>
            ${shippingAddress?.country || 'Romania'}<br>
            Phone: ${shippingAddress?.phone || 'N/A'}
          </p>
        </div>
      </div>

      <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
        <a href="${trackingUrl}" style="display: inline-block; background-color: #27ae60; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Track Your Package</a>
      </div>

      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        Thank you for your order! - xHACCP E-commerce Platform
      </p>
    </body>
    </html>
  `;

  const emailData: any = {
    to: customerEmail,
    from: getSenderForOrder(order),
    subject: `✅ Order #${order.id} Accepted & Shipped - AWB: ${awbNumber}`,
    text: `Your order #${order.id} has been accepted!\n\nAWB: ${awbNumber}\nTracking: ${trackingUrl}\nCourier: Sameday\n\nTotal: ${order.totalAmount} ${orderCurrency(order)}\n${invoiceNumber ? `Invoice: ${invoiceNumber}` : ''}\n\nThank you for your order!`,
    html,
  };

  const attachments: any[] = [];
  if (awbPdfBuffer && awbPdfBuffer.length > 0) {
    attachments.push({
      content: awbPdfBuffer.toString('base64'),
      filename: `AWB_${awbNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    });
  }
  if (invoicePdfBuffer && invoicePdfBuffer.length > 0) {
    attachments.push({
      content: invoicePdfBuffer.toString('base64'),
      filename: `Invoice_${invoiceNumber || order.id}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    });
  }
  if (attachments.length > 0) {
    emailData.attachments = attachments;
  }

  try {
    await mailService.send(emailData);
    console.log(`✅ Customer shipment email sent to ${customerEmail} for order #${order.id}, AWB: ${awbNumber}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send customer shipment email to ${customerEmail}:`, error.message);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    return false;
  }
}

/**
 * Dedicated French invoice email sent immediately after Viva payment success
 * for orders on the .fr market (no AWB/courier — invoice email is the only
 * post-payment communication the customer receives).
 */
export async function sendInvoiceEmailFr(
  customerEmail: string,
  order: OrderWithItems,
  invoicePdfBuffer: Buffer | null,
  invoiceNumber: string | undefined
): Promise<boolean> {
  if (!mailService || !VERIFIED_SENDER) {
    console.warn('Email service not configured. Skipping FR invoice email.');
    return false;
  }

  const billingAddr  = order.billingAddress  as any || {};
  const shippingAddr = order.shippingAddress as any || {};
  const firstName    = billingAddr.firstName  || shippingAddr.firstName  || 'Client';
  const lastName     = billingAddr.lastName   || shippingAddr.lastName   || '';
  const customerName = `${firstName} ${lastName}`.trim();
  const currency     = (order as any).currency || 'EUR';
  const totalAmount  = parseFloat(order.totalAmount);
  const vatRate      = 20; // France standard VAT
  const vatAmount    = (totalAmount * vatRate) / (100 + vatRate);
  const subtotalHT   = totalAmount - vatAmount;

  const orderItemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${orderItemNameHtml(item)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(item.price).toFixed(2)} ${currency}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(item.totalPrice).toFixed(2)} ${currency}</td>
    </tr>
  `).join('');

  const discountAmt = parseFloat((order as any).discountAmount || '0');
  const discountRow = discountAmt > 0 ? `
    <tr>
      <td style="padding:8px 10px;color:#27ae60;" colspan="3">Remise${(order as any).voucherCode ? ' ' + (order as any).voucherCode : ''}</td>
      <td style="padding:8px 10px;text-align:right;color:#27ae60;">-${discountAmt.toFixed(2)} ${currency}</td>
    </tr>` : '';

  const shippingCost = parseFloat(order.shippingCost || '0');
  const shippingRow  = shippingCost > 0 ? `
    <tr>
      <td style="padding:8px 10px;" colspan="3">Frais de port</td>
      <td style="padding:8px 10px;text-align:right;">${shippingCost.toFixed(2)} ${currency}</td>
    </tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Votre facture xHACCP</title></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:620px;margin:0 auto;padding:20px;">
  <div style="background:#1a4f8a;color:white;padding:24px 28px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:22px;">✅ Commande confirmée &amp; Facture</h1>
    <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Commande n° ${order.id}${invoiceNumber ? ' · Facture ' + invoiceNumber : ''}</p>
  </div>

  <div style="background:#f8f9fa;padding:24px 28px;border:1px solid #e9ecef;border-top:none;">
    <p>Bonjour ${customerName},</p>
    <p>Nous vous remercions pour votre commande sur <strong>xhaccp.fr</strong>. Votre paiement a bien été reçu et votre commande est en cours de traitement.</p>
    ${invoiceNumber ? `
    <div style="background:#e8f4fd;padding:14px 18px;border-radius:6px;margin:16px 0;border-left:4px solid #1a4f8a;">
      <p style="margin:0;font-weight:bold;">📄 Facture N° ${invoiceNumber}</p>
      ${invoicePdfBuffer ? '<p style="margin:4px 0 0;font-size:13px;color:#555;">Votre facture est jointe à cet email en format PDF.</p>' : ''}
    </div>` : ''}

    <h3 style="color:#2c3e50;border-bottom:2px solid #eee;padding-bottom:8px;">Récapitulatif de commande</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#e9ecef;">
          <th style="padding:8px 10px;text-align:left;">Produit</th>
          <th style="padding:8px 10px;text-align:center;">Qté</th>
          <th style="padding:8px 10px;text-align:right;">Prix unit. TTC</th>
          <th style="padding:8px 10px;text-align:right;">Total TTC</th>
        </tr>
      </thead>
      <tbody>
        ${orderItemsHtml}
        ${discountRow}
        ${shippingRow}
        <tr style="border-top:2px solid #dee2e6;color:#555;">
          <td style="padding:8px 10px;" colspan="3">Sous-total HT</td>
          <td style="padding:8px 10px;text-align:right;">${subtotalHT.toFixed(2)} ${currency}</td>
        </tr>
        <tr style="color:#555;">
          <td style="padding:8px 10px;" colspan="3">TVA (${vatRate}%)</td>
          <td style="padding:8px 10px;text-align:right;">${vatAmount.toFixed(2)} ${currency}</td>
        </tr>
        <tr style="font-weight:bold;background:#f0f4f8;font-size:15px;">
          <td style="padding:10px;" colspan="3">Total TTC</td>
          <td style="padding:10px;text-align:right;">${totalAmount.toFixed(2)} ${currency}</td>
        </tr>
      </tbody>
    </table>

    <div style="background:white;padding:16px 18px;border-radius:8px;margin-top:20px;border:1px solid #e0e0e0;">
      <h3 style="color:#2c3e50;margin-top:0;font-size:15px;">Adresse de livraison</h3>
      <p style="margin:0;line-height:1.8;font-size:14px;">
        ${shippingAddr.firstName || ''} ${shippingAddr.lastName || ''}<br>
        ${shippingAddr.address || shippingAddr.streetAddress || ''}<br>
        ${shippingAddr.zipCode || ''} ${shippingAddr.city || ''}<br>
        ${shippingAddr.country || 'France'}<br>
        ${shippingAddr.phone ? 'Tél : ' + shippingAddr.phone : ''}
      </p>
    </div>
  </div>

  <div style="background:#e8f5e9;padding:16px 28px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;border-top:none;text-align:center;">
    <p style="margin:0;font-size:13px;color:#555;">Pour toute question, contactez-nous à <a href="mailto:contact@xhaccp.fr" style="color:#1a4f8a;">contact@xhaccp.fr</a></p>
    <p style="margin:6px 0 0;font-size:11px;color:#999;">xHACCP · Votre partenaire en hygiène alimentaire</p>
  </div>
</body>
</html>`;

  const emailData: any = {
    to: customerEmail,
    from: getSenderForMarket('fr'),
    subject: invoiceNumber
      ? `Votre facture xHACCP N° ${invoiceNumber} – Commande #${order.id}`
      : `Confirmation de commande xHACCP #${order.id}`,
    text: `Bonjour ${customerName},\n\nMerci pour votre commande #${order.id} sur xhaccp.fr.\nMontant total TTC : ${totalAmount.toFixed(2)} ${currency}\n${invoiceNumber ? `Facture N° ${invoiceNumber}\n` : ''}${invoicePdfBuffer ? 'Votre facture est jointe en PDF.\n' : ''}\nCordialement,\nL'équipe xHACCP`,
    html,
  };

  if (invoicePdfBuffer && invoicePdfBuffer.length > 0) {
    emailData.attachments = [{
      content: invoicePdfBuffer.toString('base64'),
      filename: `Facture_xHACCP_${(invoiceNumber || order.id.toString()).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }];
  }

  try {
    await mailService.send(emailData);
    console.log(`✅ FR invoice email sent to ${customerEmail} for order #${order.id} (invoice: ${invoiceNumber})`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send FR invoice email to ${customerEmail}:`, error.message);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    return false;
  }
}

export async function sendManualInvoiceEmail(params: {
  pdfBuffer: Buffer;
  invoiceNumber: string;
  toEmail: string;
  customMessage: string;
  sellerName: string;
  market: string;
}): Promise<boolean> {
  const { pdfBuffer, invoiceNumber, toEmail, customMessage, sellerName, market } = params;
  const isProforma = invoiceNumber.startsWith('PRO-');
  const docType = isProforma ? 'Devis / Proformă' : 'Facture / Factură';
  const subject = `${docType} N° ${invoiceNumber} — ${sellerName}`;
  const filename = `${isProforma ? 'Proforma' : 'Factura'}_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const safeMessage = customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
      <div style="background: #1a4f8a; color: white; padding: 20px 28px; border-radius: 6px 6px 0 0;">
        <h2 style="margin:0; font-size:18px;">📄 ${docType}</h2>
        <p style="margin:4px 0 0; font-size:13px; opacity:0.85;">N° ${invoiceNumber} — ${sellerName}</p>
      </div>
      <div style="padding: 24px 28px; background: white; border: 1px solid #e9ecef; border-top: none;">
        <p style="color:#333; line-height:1.6;">${safeMessage}</p>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="color:#666; font-size:12px;">📎 Le document est joint à cet email en format PDF.<br>Documentul este atașat acestui email în format PDF.</p>
      </div>
      <div style="background:#f8f9fa; padding:12px 28px; border:1px solid #e9ecef; border-top:none; font-size:11px; color:#6c757d; text-align:center; border-radius:0 0 6px 6px;">
        ${sellerName} · Document généré par xHACCP
      </div>
    </div>`;

  return await sendEmail({
    from: getSenderForMarket(market),
    to: toEmail,
    subject,
    html: htmlContent,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename,
      type: 'application/pdf',
      disposition: 'attachment',
    }]
  });
}

async function getCompanyEmailFromSettings(): Promise<string | null> {
  try {
    const { pool } = await import('./db.js');
    const result = await pool.query('SELECT email FROM company_settings ORDER BY id DESC LIMIT 1');
    return result.rows.length > 0 ? result.rows[0].email : null;
  } catch (error) {
    console.error('Error fetching company email from settings:', error);
    return null;
  }
}

export { getCompanyEmailFromSettings };