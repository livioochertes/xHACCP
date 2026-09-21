import { and, desc, eq } from "drizzle-orm";
import { invoices } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { createInvoiceService } from "./invoice-service.js";
import { sendInvoiceEmailFr } from "./email-service.js";
import { buildPublicTrackingUrl } from "./public-tracking.js";

export type FrenchOrderNotificationResult =
  | "sent"
  | "not_ready"
  | "already_sent"
  | "failed";

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
): Promise<FrenchOrderNotificationResult> {
  const order = await storage.getOrder(orderId);
  if (!order || order.market !== "fr") return "not_ready";
  if (!order.awbNumber || order.awbCourier?.toLowerCase() !== "myflyingbox") {
    return "not_ready";
  }

  const trackingUrl = order.awbTrackingUrl || buildPublicTrackingUrl(order.publicOrderRef);
  const customerEmail = await getCustomerEmail(order);
  if (!trackingUrl || !customerEmail) return "not_ready";

  const [invoice] = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.orderId, orderId),
      eq(invoices.market, "fr"),
      eq(invoices.provider, "pennylane"),
      eq(invoices.providerStatus, "issued"),
    ))
    .orderBy(desc(invoices.id))
    .limit(1);
  if (!invoice || !invoice.invoiceNumber) return "not_ready";

  const invoicePdfBuffer = await (await createInvoiceService()).getInvoicePdf(invoice.id);
  if (!invoicePdfBuffer || invoicePdfBuffer.length === 0) return "not_ready";

  const claimedInvoice = await storage.claimInvoiceEmail(invoice.id);
  if (!claimedInvoice) return "already_sent";

  let awbPdfBuffer: Buffer | null = null;
  try {
    const { createMyFlyingBoxAPI } = await import("./myflyingbox-api");
    const api = createMyFlyingBoxAPI();
    if (api) awbPdfBuffer = await api.getLabels(order.awbNumber);
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
      },
    );
    if (!sent) {
      await storage.updateInvoice(invoice.id, { emailSentAt: null } as any);
      return "failed";
    }
    return "sent";
  } catch (error) {
    await storage.updateInvoice(invoice.id, { emailSentAt: null } as any);
    console.error(`Failed to send FR documents email for order #${orderId}:`, error);
    return "failed";
  }
}