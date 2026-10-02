import type { OrderWithItems, User } from "../shared/schema";
import { sendNewOrderNotificationEmail, sendOrderConfirmationEmail } from "./email-service.js";
import { storage } from "./storage";

export type FrenchOrderEmailDelivery = "sent" | "failed" | "not_configured" | "not_ready";

export type FrenchOrderConfirmationResult = {
  customer: FrenchOrderEmailDelivery;
  company: FrenchOrderEmailDelivery;
};

export type FrenchOrderConfirmationDependencies = {
  getOrder?: (orderId: number) => Promise<OrderWithItems | undefined>;
  getUser?: (userId: number) => Promise<User | undefined>;
  getCompanyEmail?: () => Promise<string | null | undefined>;
  sendCustomerConfirmation?: typeof sendOrderConfirmationEmail;
  sendCompanyNotification?: typeof sendNewOrderNotificationEmail;
};

function orderCustomerEmail(order: OrderWithItems): string {
  const shipping = (order.shippingAddress as any) || {};
  const billing = (order.billingAddress as any) || {};
  return String(
    shipping.email ||
    billing.email ||
    order.notes?.match(/Guest email:\s*([^\s,]+)/)?.[1] ||
    "",
  ).trim();
}

function guestUser(order: OrderWithItems, email: string): User {
  const shipping = (order.shippingAddress as any) || {};
  const billing = (order.billingAddress as any) || {};
  const firstName = String(shipping.firstName || billing.firstName || "Client");
  const lastName = String(shipping.lastName || billing.lastName || "");
  return {
    id: 0,
    email,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
  } as unknown as User;
}

async function tryDelivery(
  orderId: number,
  kind: "customer" | "company",
  send: () => Promise<boolean>,
): Promise<FrenchOrderEmailDelivery> {
  try {
    const sent = await send();
    if (!sent) {
      console.error(`FR order ${kind} email was not accepted for order #${orderId}`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(`FR order ${kind} email failed for order #${orderId}:`, error);
    return "failed";
  }
}

/**
 * Send the initial French-market order confirmation to the customer and the
 * internal company address. Call only after the payment transition is claimed.
 */
export async function sendFrenchOrderConfirmationEmails(
  orderId: number,
  dependencies: FrenchOrderConfirmationDependencies = {},
): Promise<FrenchOrderConfirmationResult> {
  const getOrder = dependencies.getOrder || ((id: number) => storage.getOrder(id));
  const getUser = dependencies.getUser || ((id: number) => storage.getUser(id));
  const getCompanyEmail = dependencies.getCompanyEmail || (async () =>
    (await storage.getCompanySettingsByMarket("fr"))?.email?.trim() || null);
  const sendCustomer = dependencies.sendCustomerConfirmation || sendOrderConfirmationEmail;
  const sendCompany = dependencies.sendCompanyNotification || sendNewOrderNotificationEmail;

  const order = await getOrder(orderId);
  if (!order || order.market !== "fr") {
    return { customer: "not_ready", company: "not_ready" };
  }

  let account: User | undefined;
  if (order.userId) {
    try {
      account = await getUser(order.userId);
    } catch (error) {
      console.error(`Could not load customer for FR order #${orderId}:`, error);
    }
  }

  const customerEmail = orderCustomerEmail(order) || account?.email?.trim() || "";
  const customer = customerEmail
    ? { ...(account || guestUser(order, customerEmail)), email: customerEmail } as User
    : null;

  let companyEmail: string | null = null;
  let companyLookupFailed = false;
  try {
    companyEmail = (await getCompanyEmail())?.trim() || null;
  } catch (error) {
    companyLookupFailed = true;
    console.error(`Could not load FR company email for order #${orderId}:`, error);
  }

  const customerResult = customer
    ? tryDelivery(orderId, "customer", () =>
      sendCustomer(order, customer, order.paymentMethod || undefined))
    : Promise.resolve<FrenchOrderEmailDelivery>("not_ready");
  const companyResult = companyEmail
    ? tryDelivery(orderId, "company", () =>
      sendCompany(order, customer || guestUser(order, ""), companyEmail!))
    : Promise.resolve<FrenchOrderEmailDelivery>(companyLookupFailed ? "failed" : "not_configured");

  const [customerStatus, companyStatus] = await Promise.all([customerResult, companyResult]);
  return { customer: customerStatus, company: companyStatus };
}