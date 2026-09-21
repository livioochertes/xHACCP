import { and, desc, eq } from "drizzle-orm";
import { invoices } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { createInvoiceService } from "./invoice-service.js";
import { sendEmail, sendInvoiceEmailFr } from "./email-service.js";
import { buildPublicTrackingUrl } from "./public-tracking.js";

export type FrenchOrderNotificationResult =
  | "sent"
  | "not_ready"
  | "already_sent"
  | "failed";

export type FrenchOrderNotificationDependencies = {
  getOrder?: (orderId: number) => Promise<any | undefined>;
  getIssuedInvoice?: (orderId: number) => Promise<any | undefined>;
  getInvoicePdf?: (invoiceId: number) => Promise<Buffer | null>;
  claimInvoiceEmail?: (invoiceId: number) => Promise<unknown>;
  resetInvoiceEmailClaim?: (invoiceId: number) => Promise<unknown>;
  getAwbPdf?: (awbNumber: string) => Promise<Buffer | null>;
  sendEmail?: typeof sendEmail;
};

async function getCustomerEmail(order: any): Promise<string> {
  const shipping = (order.shippingAddress as any) || {};
  const billing = (order.billingAddress as any) || {};
  const email = String(
    shipping.email ||
    billing.email ||
    order.notes?.match(/Guest email:\s*([^\s,]+)/)?.[1] ||
    "",
  ).trim();
  if (email) return email;
  if (order.userId) {
    const user = await storage.getUser(order.userId);
    return user?.email?.trim() || "";
  }
  return "";
}

/**
 * Send the single post-payment FR email once the invoice PDF and MyFlyingBox
 * AWB are both ready. The invoice row is the durable idempotency claim, so
 * repeated callbacks and retries cannot send the same notification twice.
 */
export async function sendFrenchOrderDocumentsEmail(
  orderId: number,
  dependencies: FrenchOrderNotificationDependencies = {},
): Promise<FrenchOrderNotificationResult> {
  const getOrder = dependencies.getOrder || ((id: number) => storage.getOrder(id));
  const getIssuedInvoice = dependencies.getIssuedInvoice || (async (id: number) => {
    const [invoice] = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.orderId, id),
        eq(invoices.market, "fr"),
        eq(invoices.provider, "pennylane"),
        eq(invoices.providerStatus, "issued"),
      ))
      .orderBy(desc(invoices.id))
      .limit(1);
    return invoice;
  });
  const getInvoicePdf = dependencies.getInvoicePdf ||
    (async (id: number) => (await createInvoiceService()).getInvoicePdf(id));
  const claimInvoiceEmail = dependencies.claimInvoiceEmail ||
    ((id: number) => storage.claimInvoiceEmail(id));
  const resetInvoiceEmailClaim = dependencies.resetInvoiceEmailClaim ||
    ((id: number) => storage.updateInvoice(id, { emailSentAt: null } as any));
  const getAwbPdf = dependencies.getAwbPdf || (async (awbNumber: string) => {
    try {
      const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
      const api = createMyFlyingBoxAPI();
      return api ? await api.getLabels(awbNumber) : null;
    } catch (error) {
      console.warn(`FR AWB label unavailable for order #${orderId}:`, error);
      return null;
    }
  });

  const order = await getOrder(orderId);
  if (!order || order.market !== "fr") return "not_ready";
  if (!order.awbNumber || order.awbCourier?.toLowerCase() !== "myflyingbox") {
    return "not_ready";
  }

  const trackingUrl = order.awbTrackingUrl || buildPublicTrackingUrl(order.publicOrderRef);
  const customerEmail = await getCustomerEmail(order);
  if (!trackingUrl || !customerEmail) return "not_ready";

  const invoice = await getIssuedInvoice(orderId);
  if (!invoice || !invoice.invoiceNumber) return "not_ready";

  const invoicePdfBuffer = await getInvoicePdf(invoice.id);
  if (!invoicePdfBuffer || invoicePdfBuffer.length === 0) return "not_ready";

  const claimedInvoice = await claimInvoiceEmail(invoice.id);
  if (!claimedInvoice) return "already_sent";

  let awbPdfBuffer: Buffer | null = null;
  try {
    awbPdfBuffer = await getAwbPdf(order.awbNumber);
  } catch (error) {
    // The AWB label is optional. The required customer link remains usable.
    console.warn(`FR AWB label unavailable for order #${orderId}:`, error);
  }

  try {
    const sent = await sendInvoiceEmailFr(
      customerEmail,
      order,
      invoicePdfBuffer,
      invoice.invoiceNumber,
      {
        awbNumber: order.awbNumber,
        trackingUrl,
        awbPdfBuffer,
        send: dependencies.sendEmail,
      },
    );
    if (!sent) {
      await resetInvoiceEmailClaim(invoice.id);
      return "failed";
    }
    return "sent";
  } catch (error) {
    await resetInvoiceEmailClaim(invoice.id);
    console.error(`Failed to send FR documents email for order #${orderId}:`, error);
    return "failed";
  }
}