import type { OrderWithItems, User } from "../shared/schema";
import { sendFrenchOrderConfirmationEmails } from "../server/fr-order-confirmation.js";
import {
  sendNewOrderNotificationEmail,
  sendOrderConfirmationEmail,
} from "../server/email-service.js";

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("This real-email test can only run with NODE_ENV=development.");
  }
  if (process.env.ALLOW_REAL_FR_EMAIL_TEST !== "yes") {
    throw new Error("Set ALLOW_REAL_FR_EMAIL_TEST=yes to explicitly enable real test email delivery.");
  }

  const customerEmail = process.env.FR_ORDER_EMAIL_TEST_TO?.trim();
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error("Set FR_ORDER_EMAIL_TEST_TO to a valid test mailbox.");
  }

  const companyEmail = process.env.FR_ORDER_EMAIL_TEST_COMPANY_TO?.trim();
  if (!companyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
    throw new Error("Set FR_ORDER_EMAIL_TEST_COMPANY_TO to the verified French company inbox; nothing was sent.");
  }

  const now = new Date();
  const address = {
    firstName: "Test",
    lastName: "xHACCP",
    email: customerEmail,
    address: "Adresse fictive — test email uniquement",
    city: "Paris",
    state: "Île-de-France",
    zipCode: "75000",
    country: "France",
    phone: "0000000000",
  };
  const customer = {
    id: 0,
    email: customerEmail,
    firstName: "Test",
    lastName: "xHACCP",
    name: "Test xHACCP",
  } as User;
  const order = {
    id: 0,
    publicOrderRef: "TEST-EMAIL-ONLY",
    userId: null,
    market: "fr",
    currency: "EUR",
    status: "pending",
    paymentStatus: "pending",
    totalAmount: "12.00",
    subtotalNet: "10.00",
    subtotalGross: "12.00",
    vatPercentage: "20.00",
    vatAmount: "2.00",
    shippingCost: "0.00",
    shippingNetAmount: "0.00",
    shippingVatAmount: "0.00",
    discountAmount: "0.00",
    shippingAddress: address,
    billingAddress: address,
    paymentMethod: "test — no payment",
    notes: "TEST EMAIL ONLY — no real order, payment, invoice, or shipment.",
    createdAt: now,
    updatedAt: now,
    items: [{
      id: 0,
      orderId: 0,
      productId: 0,
      quantity: 1,
      price: "12.00",
      totalPrice: "12.00",
      priceNet: "10.00",
      totalPriceNet: "10.00",
      vatPercentage: "20.00",
      vatAmount: "2.00",
      priceDisplayMode: "gross",
      product: {
        id: 0,
        name: "Produit de démonstration — test email",
        slug: "test-email-only",
        productCode: "TEST-EMAIL-ONLY",
      },
    }],
  } as unknown as OrderWithItems;

  console.log("Sending two clearly marked French-market test emails.");
  console.log("No order will be written; payment, invoicing, and shipping are not invoked.");

  const result = await sendFrenchOrderConfirmationEmails(0, {
    getOrder: async () => order,
    getUser: async () => customer,
    getCompanyEmail: async () => companyEmail,
    sendCustomerConfirmation: (testOrder, testCustomer, paymentMethod) =>
      sendOrderConfirmationEmail(
        testOrder,
        testCustomer,
        paymentMethod,
        undefined,
        undefined,
        { testMode: true },
      ),
    sendCompanyNotification: (testOrder, testCustomer, recipient) =>
      sendNewOrderNotificationEmail(
        testOrder,
        testCustomer,
        recipient,
        { testMode: true },
      ),
  });

  console.log(`Customer email status: ${result.customer}`);
  console.log(`French company email status: ${result.company}`);
  if (result.customer !== "sent" || result.company !== "sent") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("French email delivery test failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});