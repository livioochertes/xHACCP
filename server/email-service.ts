import { MailService } from '@sendgrid/mail';
import type { OrderWithItems, User } from '../shared/schema';
import { getOrderTaxSummary } from '../shared/market-pricing.js';
import {
  buildContactEmailTemplates,
  dedupeEmailAddresses,
  type ContactFormData,
  type ContactMarket,
} from './contact-email.js';
import { buildPublicTrackingUrl } from './public-tracking.js';
import { getProspectUnsubscribeUrl } from './prospect-marketing-security';
import { formatEventVoucherDiscount, EVENT_VOUCHER_ACTIVATION_DAYS } from './event-voucher';

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
  headers?: Record<string, string>;
  suppressRecipientLog?: boolean;
  customArgs?: Record<string, string>;
}

export interface EmailSendOptions {
  testMode?: boolean;
}

export type EmailSendOutcome =
  | { status: "accepted" }
  | { status: "rejected"; retryable: boolean; reason: string }
  | { status: "unknown"; reason: string };

export async function sendEmailWithOutcome(params: EmailParams): Promise<EmailSendOutcome> {
  if (!mailService) {
    console.warn("Email service not configured. Skipping email send.");
    return { status: "rejected", retryable: false, reason: "email_service_unavailable" };
  }
  try {
    if (params.suppressRecipientLog) {
      console.log("Attempting to send a privacy-sensitive email notification");
    } else {
      console.log(`Attempting to send email: from=${params.from}, to=${params.to}, subject=${params.subject.substring(0, 50)}...`);
    }
    
    const emailData: any = {
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    };

    if (params.customArgs) {
      // SendGrid custom arguments belong to the recipient personalization. The
      // top-level legacy field can be accepted by the API without appearing in
      // Event Webhook payloads for the recipient.
      emailData.personalizations = [{
        to: params.to,
        customArgs: params.customArgs,
      }];
    } else {
      emailData.to = params.to;
    }

    if (params.headers) {
      emailData.headers = params.headers;
    }
    
    if (params.replyTo) {
      emailData.replyTo = params.replyTo;
    }

    if (params.attachments && params.attachments.length > 0) {
      emailData.attachments = params.attachments;
    }
    
    await mailService.send(emailData);
    if (params.suppressRecipientLog) {
      console.log("SendGrid accepted a privacy-sensitive email");
    } else {
      console.log(`SendGrid accepted email for: ${params.to}`);
    }
    return { status: "accepted" };
  } catch (error: any) {
    const statusCode = Number(error?.response?.statusCode || error?.statusCode || 0);
    const providerErrors = Array.isArray(error?.response?.body?.errors)
      ? error.response.body.errors.map((item: any) => String(item?.message || "")).join(" ").toLowerCase()
      : "";
    const invalidRecipient = /invalid.*(email|address|recipient|to)|(?:email|address|recipient|to).*invalid|malformed.*email|email address.*not valid/i
      .test(providerErrors);
    if (params.suppressRecipientLog) {
      console.error("❌ Privacy-sensitive email notification failed:", {
        code: error.code,
        statusCode: statusCode || undefined,
      });
    } else {
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
    }

    if (statusCode === 429) {
      return { status: "rejected", retryable: true, reason: "sendgrid_rate_limited" };
    }
    if (statusCode >= 400 && statusCode < 500) {
      return {
        status: "rejected",
        retryable: false,
        reason: invalidRecipient ? "invalid_recipient" : "sendgrid_rejected_request",
      };
    }
    return { status: "unknown", reason: statusCode >= 500 ? "sendgrid_server_error" : "sendgrid_response_unknown" };
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  return (await sendEmailWithOutcome(params)).status === "accepted";
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
  activationDeadline?: Date;
  discountValue: string;
  discountType?: string;
  activationDays?: number;
  validMonths?: number;
}) {
  const firstName = escapeVoucherEmail(data.firstName);
  const code = escapeVoucherEmail(data.code);
  const validUntil = data.validUntil.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const activationDeadline = data.activationDeadline
    ? data.activationDeadline.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Paris",
      })
    : null;
  const discount = escapeVoucherEmail(formatEventVoucherDiscount(data.discountType || "percentage", data.discountValue));
  const activationDays = data.activationDays ?? EVENT_VOUCHER_ACTIVATION_DAYS;
  const activationTerm = activationDeadline
    ? `Si votre première commande est payée dans les ${activationDays} jours suivant votre inscription, votre avantage sera valable ${data.validMonths || 12} mois à compter de ce paiement. Passé ce délai, le code reste utilisable une seule fois pour une première commande, jusqu'au ${validUntil}.`
    : `Votre code personnel est valable jusqu'au ${validUntil}.`;
  const shopUrl = "https://xhaccp.fr";
  const foodLabelsUrl = "https://xhaccp.fr/products?category=etiquettes-alimentaires";
  const logoUrl = "https://xhaccp.fr/attached_assets/logo_xHACCP-S1_1772812623761.png";

  return {
    to: data.to,
    from: getSenderForMarket("fr"),
    subject: `Votre offre xHACCP France — ${discount} de réduction`,
    text: `Bonjour ${data.firstName},\n\nMerci pour votre inscription. Voici votre code personnel de réduction de ${formatEventVoucherDiscount(data.discountType || "percentage", data.discountValue)} : ${data.code}\n\n${activationDeadline ? "IMPORTANT — ACTIVATION PAR ACHAT : " : ""}${activationTerm}\n\nDécouvrir les étiquettes alimentaires : ${foodLabelsUrl}\n\nDécouvrir tous les produits : ${shopUrl}\n\nL'équipe xHACCP France`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
        <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033;">
          <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
            <div style="background:#0f2747;padding:22px 24px;border-radius:14px 14px 0 0;text-align:center;">
              <div style="display:inline-block;padding:8px 16px;background:#fff;border-radius:10px;">
                <img src="${logoUrl}" alt="xHACCP" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;" />
              </div>
              <div style="margin-top:8px;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#8deaff;">France</div>
            </div>
            <div style="background:#fff;padding:30px 28px;border-radius:0 0 14px 14px;">
              <h1 style="margin:0 0 16px;color:#0f2747;font-size:25px;">Merci pour votre inscription, ${firstName} !</h1>
              <p style="font-size:16px;line-height:1.6;">Profitez de <strong>${discount} de réduction</strong> sur xHACCP France.</p>
              <div style="margin:26px 0;padding:20px;text-align:center;background:#eef6ff;border:2px dashed #1976d2;border-radius:12px;">
                <div style="font-size:12px;color:#53657d;text-transform:uppercase;letter-spacing:1px;">Votre code personnel</div>
                <div style="margin-top:8px;font-size:30px;font-weight:700;letter-spacing:3px;color:#0f2747;">${code}</div>
              </div>
      <div style="margin:24px 0;padding:17px 18px;background:#fff6df;border:2px solid #e6a817;border-radius:12px;">
                <div style="font-size:14px;font-weight:700;color:#855400;text-transform:uppercase;letter-spacing:.4px;">Important — activation par achat</div>
                <p style="margin:8px 0 0;line-height:1.6;color:#5c430e;">${escapeVoucherEmail(activationTerm)}</p>
              </div>
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
  activationDeadline?: Date;
  discountValue: string;
  discountType?: string;
  activationDays?: number;
  validMonths?: number;
}): Promise<boolean> {
  return sendEmail(buildEventVoucherEmail(data));
}

export async function sendClientPasswordSetupEmail(data: {
  to: string;
  setupUrl: string;
  market?: string;
}): Promise<boolean> {
  const safeUrl = escapeVoucherEmail(data.setupUrl);
  const french = data.market?.toLowerCase() === "fr";
  const subject = french ? "Choisissez le mot de passe de votre compte xHACCP" : "Set your xHACCP account password";
  const text = french
    ? `Votre compte client xHACCP est prêt. Choisissez votre mot de passe avec ce lien sécurisé, valable 24 heures : ${data.setupUrl}\n\nSi vous n'avez pas demandé ce compte, ignorez ce message.`
    : `Your xHACCP customer account is ready. Set your password using this secure link, valid for 24 hours: ${data.setupUrl}\n\nIf you did not request this account, ignore this message.`;
  const html = french
            ? `<div style="font:16px/1.6 Arial,sans-serif;color:#172033;max-width:560px;margin:0 auto;padding:28px"><h1 style="color:#0f2747">Votre compte client xHACCP</h1><p>Choisissez un mot de passe pour accéder à votre compte et retrouver votre code personnel.</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 22px;background:#1976d2;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Choisir mon mot de passe</a></p><p>Ce lien est à usage unique et expire dans 24 heures. Si vous n'avez pas demandé ce compte, ignorez ce message.</p></div>`
    : `<div style="font:16px/1.6 Arial,sans-serif;color:#172033;max-width:560px;margin:0 auto;padding:28px"><h1 style="color:#0f2747">Your xHACCP customer account</h1><p>Set a password to access your account and personal voucher.</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 22px;background:#1976d2;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Set my password</a></p><p>This one-time link expires in 24 hours. If you did not request this account, ignore this message.</p></div>`;
  return sendEmail({
    to: data.to,
    from: getSenderForMarket(data.market),
    subject,
    text,
    html,
    suppressRecipientLog: true,
  });
}

export async function sendProspectNewsletterVoucherEmail(data: {
  prospectId: number;
  to: string;
  restaurantName: string;
  code: string;
  validUntil: Date;
  activationDeadline?: Date;
  discountType: string;
  discountValue: string;
  validMonths?: number;
}): Promise<boolean> {
  const safeRestaurant = escapeVoucherEmail(data.restaurantName || "votre restaurant");
  const safeCode = escapeVoucherEmail(data.code);
  const validUntil = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(data.validUntil);
  const activationDeadline = data.activationDeadline
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(data.activationDeadline)
    : null;
  const discount = formatEventVoucherDiscount(data.discountType, data.discountValue);
  const validMonths = data.validMonths ?? 12;
  const activationTerm = activationDeadline
    ? `Si votre première commande est payée dans les ${EVENT_VOUCHER_ACTIVATION_DAYS} jours suivant votre inscription, l'avantage est valable ${validMonths} mois à compter du paiement. Passé ce délai, le code reste utilisable une seule fois pour une première commande jusqu'au ${validUntil}, sans période répétée. `
    : "";
  const unsubscribeUrl = getProspectUnsubscribeUrl(data.prospectId);
  return sendEmail({
    to: data.to,
    from: getSenderForMarket("fr"),
    subject: `Votre offre de bienvenue xHACCP France — ${discount}`,
    text: `Bonjour ${data.restaurantName || "à l'équipe"}, votre inscription à la newsletter xHACCP France est confirmée. Votre code personnel : ${data.code}, soit ${discount} de réduction. ${activationTerm}${activationDeadline ? "" : `Valable jusqu'au ${validUntil}, pour une utilisation.`}\n\nSe désabonner : ${unsubscribeUrl}`,
    html: `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px"><h1 style="color:#0f766e">Merci pour votre inscription, ${safeRestaurant} !</h1><p>Votre inscription à la newsletter xHACCP France est confirmée.</p><p>Voici votre code personnel : <strong>${escapeVoucherEmail(discount)} de réduction</strong>.</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;background:#f0fdfa;border:1px dashed #0f766e;padding:16px;text-align:center">${safeCode}</p><p>${escapeVoucherEmail(activationTerm)}${activationDeadline ? "" : `Valable jusqu'au ${validUntil}, pour une utilisation.`}</p><p>Pour ne plus recevoir nos communications : <a href="${unsubscribeUrl}">se désabonner</a>.</p><p style="color:#64748b;font-size:12px">L'équipe xHACCP France</p></div>`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    suppressRecipientLog: true,
  });
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
  invoiceNumber?: string,
  options: EmailSendOptions = {},
): Promise<boolean> {
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  const isFrenchOrder = (order as any).market === 'fr';
  const isTestEmail = options.testMode === true;
  const orderMarket = (order as any).market || 'ro';
  const orderVatRate = Number((order as any).vatPercentage ?? (orderMarket === 'fr' ? 20 : 21));
  const taxSummary = getOrderTaxSummary(order as any, orderVatRate);
  
  const orderItemsHtml = order.items
    .map(item => {
      const priceMode = (item as any).priceDisplayMode === 'net' ? 'net' : 'gross';
      const vatRate = Number((item as any).vatPercentage ?? orderVatRate);
      const netUnit = Number((item as any).priceNet ?? Number(item.price) / (1 + vatRate / 100));
      const netTotal = Number((item as any).totalPriceNet ?? Number(item.totalPrice) / (1 + vatRate / 100));
      const displayUnit = priceMode === 'net' ? netUnit : Number(item.price);
      const displayTotal = priceMode === 'net' ? netTotal : Number(item.totalPrice);
      const basis = priceMode === 'net' ? `excl. VAT + ${vatRate}% VAT` : 'incl. VAT';
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${orderItemNameHtml(item)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${displayUnit.toFixed(2)} ${orderCurrency(order)}<br><small>${basis}</small></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${displayTotal.toFixed(2)} ${orderCurrency(order)}</td>
        </tr>
      `;
    })
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
        <h2 style="color: #27ae60; margin-top: 0;">${isTestEmail ? 'TEST ONLY — Order Confirmation' : 'Order Confirmation'}</h2>
      </div>

      ${isTestEmail ? `
      <div style="background-color:#fff3cd;padding:16px 20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #ffc107;">
        <strong>TEST EMAIL ONLY:</strong> No real order, payment, invoice, or shipment was created.
      </div>` : ''}
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h3>
        <p>${isTestEmail
          ? 'This message checks French-market order email delivery only. It does not confirm a real order.'
          : "Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed."}</p>
        
        <div style="margin: 20px 0;">
          <strong>Order Details:</strong><br>
          Order ID: ${isTestEmail ? 'TEST ONLY — no database order' : `#${order.id}`}<br>
          Order Date: ${new Date(order.createdAt!).toLocaleDateString()}<br>
          Status: <span style="color: #27ae60; font-weight: bold;">${isTestEmail ? 'TEST ONLY — no order created' : 'Accepted'}</span><br>
          Customer Email: ${user.email}<br>
          Contact Phone: ${shippingAddress.phone}<br>
          Payment: <span style="font-weight: bold; color: ${isTestEmail ? '#856404' : (paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? '#e67e22' : '#27ae60'};">${isTestEmail ? 'TEST ONLY — no payment was taken' : (paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? 'Plată ramburs (cash la livrare)' : paymentMethod === 'viva' || paymentMethod === 'card' ? 'Plătit online cu cardul' : 'În curs de procesare'}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">${isTestEmail ? 'Sample Items (email test):' : 'Order Items:'}</h3>
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
              const shippingCost = Number(taxSummary.shippingDisplayAmount);
              const displaySubtotal = Number(isFrenchOrder ? taxSummary.subtotalNet : taxSummary.subtotalGross);
              const discountAmt = Number(isFrenchOrder ? taxSummary.discountNetAmount : taxSummary.discountGrossAmount);
              const voucherCode = (order as any).voucherCode || '';
              const discountRow = discountAmt > 0 ? `
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right; color: #27ae60;">Discount${isFrenchOrder ? ' excl. VAT' : ''}${voucherCode ? ` ${voucherCode}` : ''}:</td>
                  <td style="padding: 8px; text-align: right; color: #27ae60;">-${discountAmt.toFixed(2)} ${orderCurrency(order)}</td>
                </tr>` : '';
              return `
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right; border-top: 1px solid #dee2e6;">Products subtotal ${isFrenchOrder ? 'excl.' : 'incl.'} VAT:</td>
                  <td style="padding: 8px; text-align: right; border-top: 1px solid #dee2e6;">${displaySubtotal.toFixed(2)} ${orderCurrency(order)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right;">${(order as any).market === 'fr' ? 'Shipping excl. VAT:' : 'Shipping incl. VAT:'}</td>
                  <td style="padding: 8px; text-align: right;">${shippingCost > 0 ? shippingCost.toFixed(2) + ' ' + orderCurrency(order) : 'Free'}</td>
                </tr>
                ${isFrenchOrder ? `
                  <tr>
                    <td colspan="3" style="padding: 8px; text-align: right;">VAT (${orderVatRate}%):</td>
                    <td style="padding: 8px; text-align: right;">${taxSummary.vatAmount} ${orderCurrency(order)}</td>
                  </tr>` : ''}
                <tr>
                  <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; border-top: 2px solid #dee2e6;">Total incl. VAT:</td>
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

      ${isTestEmail ? `
      <div style="background-color:#e8f4fd;padding:16px 20px;border-radius:8px;margin-bottom:20px;">
        No payment, invoice, or shipment was created for this email test.
      </div>` : `<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #27ae60;">What's Next?</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Our team will prepare your order for shipping</li>
          <li>You'll receive a shipping confirmation with tracking information</li>
          <li>Your order will be delivered to the address provided</li>
        </ul>
      </div>`}
      ${isFrenchOrder && !isTestEmail ? `
      <div style="background-color: #e8f4fd; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1a4f8a;">
        <p style="margin: 0; color: #1a4f8a;">
          Vous recevrez un nouvel e-mail avec votre facture et le lien de suivi de votre colis.
        </p>
      </div>
      ` : ''}

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
    ${isTestEmail ? 'TEST ONLY — EMAIL DELIVERY CHECK (NO ORDER OR PAYMENT)' : 'xHACCP - Order Confirmation'}
    
    Hello ${user.firstName} ${user.lastName},
    
    ${isTestEmail
      ? 'This message checks French-market order email delivery only. No real order, payment, invoice, or shipment was created.'
      : "Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed."}
    
    Order Details:
    - Order ID: ${isTestEmail ? 'TEST ONLY — no database order' : `#${order.id}`}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Status: ${isTestEmail ? 'TEST ONLY — no order created' : 'Accepted'}
    - Customer Email: ${user.email}
    - Contact Phone: ${shippingAddress.phone}
    - Payment: ${isTestEmail ? 'TEST ONLY — no payment was taken' : (paymentMethod === 'cash_on_delivery' || paymentMethod === 'cod' || paymentMethod === 'cash') ? 'Plată ramburs (cash la livrare)' : paymentMethod === 'viva' || paymentMethod === 'card' ? 'Plătit online cu cardul' : 'În curs de procesare'}
    - VAT: ${taxSummary.vatAmount} ${orderCurrency(order)}
    - Total Amount incl. VAT: ${taxSummary.totalAmount} ${orderCurrency(order)}
    
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
    
    ${isTestEmail
      ? 'No payment, invoice, or shipment was created for this email test.'
      : "Your order will be prepared for shipping and you'll receive tracking information soon."}
    ${isFrenchOrder && !isTestEmail ? '\n\nVous recevrez un nouvel e-mail avec votre facture et le lien de suivi de votre colis.\n' : ''}
    
    Questions? Contact us at info@xhaccp.com
    
    Thank you for choosing xHACCP!
  `;

  const emailParams: Parameters<typeof sendEmail>[0] = {
    to: user.email,
    from: getSenderForOrder(order),
    subject: `${isTestEmail ? '[TEST ONLY — NO ORDER OR PAYMENT] ' : ''}Order Confirmation #${order.id} - xHACCP`,
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
  logisticsEmail?: string,
  options: EmailSendOptions = {},
): Promise<boolean> {
  // Get logistics email from company settings if not provided
  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  const isTestEmail = options.testMode === true;
  
  // Create admin URL for order management
  const orderMarket = (order.market || 'ro').toLowerCase();
  const adminOrigin = orderMarket === 'fr'
    ? 'https://xhaccp.fr'
    : orderMarket === 'com'
      ? 'https://xhaccp.com'
      : 'https://xhaccp.ro';
  const adminOrderUrl = isTestEmail ? '' : `${adminOrigin}/admin#orders-${order.id}`;
  
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
        <h2 style="color: #f39c12; margin-top: 0;">${isTestEmail ? 'TEST EMAIL — NO ORDER CREATED' : '🔔 New Order Created'}</h2>
      </div>

      ${isTestEmail ? `
      <div style="background-color:#fff3cd;padding:16px 20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #ffc107;">
        <strong>TEST EMAIL ONLY:</strong> No real order, payment, invoice, or shipment exists. No action is required.
      </div>` : ''}
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">${isTestEmail ? 'Email Delivery Test' : 'Order Awaiting Review'}</h3>
        <p><strong>Order ID:</strong> ${isTestEmail ? 'TEST ONLY — no database order' : `#${order.id}`}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt!).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${user.firstName} ${user.lastName}</p>
        <p><strong>Customer Email:</strong> ${user.email}</p>
        <p><strong>Customer Phone:</strong> ${shippingAddress.phone}</p>
        ${(() => {
          const sc = parseFloat((order as any).shippingCost || '0');
          const total = parseFloat(order.totalAmount || '0');
          const discountAmt = parseFloat((order as any).discountAmount || '0');
          const voucherCode = (order as any).voucherCode || '';
          const currency = orderCurrency(order);
          const itemsSubtotal = (total + discountAmt - sc).toFixed(2);
          const discountLine = discountAmt > 0 ? `<p style="color:#27ae60;"><strong>Discount voucher${voucherCode ? ' ' + voucherCode : ''}:</strong> -${discountAmt.toFixed(2)} ${currency}</p>` : '';
          return `<p><strong>Subtotal:</strong> ${itemsSubtotal} ${currency}</p>
        ${discountLine}<p><strong>Transport:</strong> ${sc > 0 ? sc.toFixed(2) + ' ' + currency : 'Gratuit'}</p>
        <p style="font-size:15px;border-top:1px solid #e0e0e0;padding-top:6px;margin-top:4px;"><strong>Total:</strong> ${total.toFixed(2)} ${currency}</p>`;
        })()}
        <p><strong>Payment Method:</strong> ${isTestEmail ? 'TEST ONLY — no payment taken' : order.paymentMethod}</p>
        <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">${isTestEmail ? 'TEST ONLY — no review or action required' : 'PENDING REVIEW'}</span></p>
      </div>

      ${isTestEmail ? '' : `<div style="text-align: center; margin-bottom: 30px;">
        <a href="${adminOrderUrl}" 
           style="display: inline-block; background-color: #27ae60; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          🎯 VIEW & ACCEPT ORDER
        </a>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          Click the button above to review and accept this order
        </p>
      </div>`}

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

      ${isTestEmail ? `
      <div style="background-color:#e8f4fd;padding:16px 20px;border-radius:8px;margin-bottom:20px;">
        This message verifies the French company notification email only. No database order was created.
      </div>` : `<div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #856404;">🚨 Action Required</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li><strong>Review order details above</strong></li>
          <li><strong>Click "VIEW & ACCEPT ORDER" button</strong></li>
          <li><strong>Verify product availability</strong></li>
          <li><strong>Accept the order to begin processing</strong></li>
        </ol>
      </div>`}

      ${isTestEmail ? '' : `<div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Direct admin link: 
          <a href="${adminOrderUrl}" style="color: #27ae60;">${adminOrigin}/admin#orders-${order.id}</a>
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          xHACCP - Order Management System
        </p>
      </div>`}
    </body>
    </html>
  `;

  const textContent = `
    ${isTestEmail ? 'TEST ONLY — EMAIL DELIVERY CHECK (NO ORDER EXISTS)' : 'xHACCP - New Order Created'}
    
    ${isTestEmail ? 'TEST ONLY — NO ACTION REQUIRED' : '🔔 NEW ORDER AWAITING REVIEW'}
    
    Order Details:
    - Order ID: ${isTestEmail ? 'TEST ONLY — no database order' : `#${order.id}`}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Customer: ${user.firstName} ${user.lastName}
    - Customer Email: ${user.email}
    - Customer Phone: ${shippingAddress.phone}
    - Total Amount: ${order.totalAmount} ${orderCurrency(order)}
    - Payment Method: ${isTestEmail ? 'TEST ONLY — no payment taken' : order.paymentMethod}
    - Status: ${isTestEmail ? 'TEST ONLY — no review or action required' : 'PENDING REVIEW'}
    
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
    
    ${isTestEmail ? 'This message verifies email delivery only. No database order, payment, invoice, or shipment exists.' : `🚨 ACTION REQUIRED:
    1. Review order details above
    2. Access admin panel: ${adminOrderUrl}
    3. Verify product availability
    4. Accept the order to begin processing`}
    
    Direct link: ${adminOrigin}/admin#orders-${order.id}
  `;

  return await sendEmail({
    to: logisticsEmail,
    from: getSenderForOrder(order),
    subject: `${isTestEmail ? '[TEST ONLY — NO ORDER] ' : '🔔 '}${isTestEmail ? 'French order notification email test' : `New Order #${order.id} - Awaiting Review & Acceptance`}`,
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
  createdAt?: Date;
  suppressRecipientLogging?: boolean;
}

export interface ContactEmailResults {
  ticketId: string;
  market: ContactMarket;
  toBusinessSent: boolean;
  toCustomerSent: boolean;
  businessRecipientsAttempted: number;
  businessRecipientsSent: number;
  businessRecipientsFailed: number;
  submittedAt: string;
}

// Send independently to every configured market recipient, then confirm to the
// customer only after at least one business recipient accepted the message.
export async function sendContactFormEmails(
  data: ContactFormData,
  options: ContactEmailOptions,
): Promise<ContactEmailResults> {
  const createdAt = options.createdAt || new Date();
  const ticketId = `TICKET_${createdAt.getTime()}`;
  const sender = options.send || sendEmail;
  const businessEmails = dedupeEmailAddresses(options.businessEmails);
  const templates = buildContactEmailTemplates(
    data,
    options.market,
    ticketId,
    createdAt,
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
           suppressRecipientLog: options.suppressRecipientLogging,
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
        suppressRecipientLog: options.suppressRecipientLogging,
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
    submittedAt: createdAt.toISOString(),
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
  const taxSummary = getOrderTaxSummary(order as any);
  const isFrenchMarket = (order as any).market === 'fr';
  const orderVatRate = Number((order as any).vatPercentage ?? 0);

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
              const shippingCost = Number(taxSummary.shippingDisplayAmount);
              const discountAmt = Math.max(0, Number((order as any).discountAmount || 0));
              const vc = (order as any).voucherCode || '';
              const itemsSubtotal = order.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
              const discountRow = discountAmt > 0 ? `
                <tr>
                  <td style="padding: 8px; color: #27ae60;" colspan="2">${isFrenchMarket ? 'Discount excl. VAT' : 'Discount'}${vc ? ' ' + vc : ''}</td>
                  <td style="padding: 8px; text-align: right; color: #27ae60;">-${discountAmt.toFixed(2)} ${orderCurrency(order)}</td>
                </tr>` : '';
              return `
                <tr>
                  <td style="padding: 8px; border-top: 1px solid #ddd;" colspan="2">${isFrenchMarket ? 'Products subtotal excl. VAT' : 'Products subtotal incl. VAT'}</td>
                  <td style="padding: 8px; border-top: 1px solid #ddd; text-align: right;">${itemsSubtotal.toFixed(2)} ${orderCurrency(order)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding: 8px;" colspan="2">${isFrenchMarket ? 'Shipping excl. VAT' : 'Shipping incl. VAT'}</td>
                  <td style="padding: 8px; text-align: right;">${shippingCost > 0 ? shippingCost.toFixed(2) + ' ' + orderCurrency(order) : 'Gratuit'}</td>
                </tr>
                ${isFrenchMarket ? `
                  <tr>
                    <td style="padding: 8px;" colspan="2">VAT (${orderVatRate}%):</td>
                    <td style="padding: 8px; text-align: right;">${taxSummary.vatAmount} ${orderCurrency(order)}</td>
                  </tr>` : ''}
              `;
            })()}
            <tr style="font-weight: bold; background-color: #f0f0f0;">
              <td style="padding: 10px 8px;" colspan="2">Total incl. VAT</td>
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
  invoiceNumber: string | undefined,
  options: {
    awbNumber?: string;
    trackingUrl?: string | null;
    awbPdfBuffer?: Buffer | null;
    send?: typeof sendEmail;
  } = {}
): Promise<boolean> {
  if (!options.send && (!mailService || !VERIFIED_SENDER)) {
    console.warn('Email service not configured. Skipping FR invoice email.');
    return false;
  }

  const billingAddr  = order.billingAddress  as any || {};
  const shippingAddr = order.shippingAddress as any || {};
  const firstName    = billingAddr.firstName  || shippingAddr.firstName  || 'Client';
  const lastName     = billingAddr.lastName   || shippingAddr.lastName   || '';
  const customerName = `${firstName} ${lastName}`.trim();
  const currency     = (order as any).currency || 'EUR';
  const vatRate      = Number((order as any).vatPercentage ?? 20);
  const taxSummary   = getOrderTaxSummary(order as any, vatRate);
  const totalAmount  = Number(taxSummary.totalAmount);
  const vatAmount    = Number(taxSummary.vatAmount);
  const subtotalHT   = Number(taxSummary.subtotalNet);
  const trackingUrl = options.trackingUrl || buildPublicTrackingUrl((order as any).publicOrderRef);

  const orderItemsHtml = order.items.map(item => {
    const itemVatRate = Number((item as any).vatPercentage ?? vatRate);
    const unitNet = Number((item as any).priceNet ?? Number(item.price) / (1 + itemVatRate / 100));
    const lineNet = Number((item as any).totalPriceNet ?? Number(item.totalPrice) / (1 + itemVatRate / 100));
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">${orderItemNameHtml(item)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${unitNet.toFixed(2)} ${currency}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${lineNet.toFixed(2)} ${currency}</td>
      </tr>
    `;
  }).join('');

  const discountAmt = Number(taxSummary.discountNetAmount);
  const discountRow = discountAmt > 0 ? `
    <tr>
      <td style="padding:8px 10px;color:#27ae60;" colspan="3">Remise${(order as any).voucherCode ? ' ' + (order as any).voucherCode : ''}</td>
      <td style="padding:8px 10px;text-align:right;color:#27ae60;">-${discountAmt.toFixed(2)} ${currency}</td>
    </tr>` : '';

  const shippingCost = Number(taxSummary.shippingNetAmount);
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
    ${options.awbNumber && trackingUrl ? `
    <div style="background:#eef8ee;padding:14px 18px;border-radius:6px;margin:16px 0;border-left:4px solid #27ae60;">
      <p style="margin:0;font-weight:bold;">📦 Suivi de votre colis</p>
      <p style="margin:4px 0 0;font-size:13px;color:#555;">Transporteur : MyFlyingBox · N° de suivi : ${options.awbNumber}</p>
      <p style="margin:8px 0 0;"><a href="${trackingUrl}" style="color:#1a4f8a;font-weight:bold;">Suivre mon colis →</a></p>
    </div>` : ''}

    <h3 style="color:#2c3e50;border-bottom:2px solid #eee;padding-bottom:8px;">Récapitulatif de commande</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#e9ecef;">
          <th style="padding:8px 10px;text-align:left;">Produit</th>
          <th style="padding:8px 10px;text-align:center;">Qté</th>
          <th style="padding:8px 10px;text-align:right;">Prix unit. HT</th>
          <th style="padding:8px 10px;text-align:right;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${orderItemsHtml}
        ${discountRow}
        ${shippingRow}
        <tr style="border-top:2px solid #dee2e6;color:#555;">
          <td style="padding:8px 10px;" colspan="3">Produits HT avant remise</td>
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
    text: `Bonjour ${customerName},\n\nMerci pour votre commande #${order.id} sur xhaccp.fr.\nTotal HT après remises : ${taxSummary.totalNetAmount} ${currency}\nTVA (${vatRate}%) : ${vatAmount.toFixed(2)} ${currency}\nMontant total TTC : ${totalAmount.toFixed(2)} ${currency}\n${invoiceNumber ? `Facture N° ${invoiceNumber}\n` : ''}${invoicePdfBuffer ? 'Votre facture est jointe en PDF.\n' : ''}${options.awbNumber && trackingUrl ? `\nTransporteur : MyFlyingBox\nN° de suivi : ${options.awbNumber}\nSuivre votre colis : ${trackingUrl}\n` : ''}\nCordialement,\nL'équipe xHACCP`,
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
  if (options.awbPdfBuffer && options.awbPdfBuffer.length > 0) {
    emailData.attachments = [
      ...(emailData.attachments || []),
      {
        content: options.awbPdfBuffer.toString('base64'),
        filename: `AWB_${options.awbNumber || order.id}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ];
  }

  try {
    if (options.send) {
      return await options.send(emailData);
    }
    if (!mailService) return false;
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