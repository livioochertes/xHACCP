import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContactEmailTemplates,
  collectContactRecipients,
  getContactLanguages,
  type ContactFormData,
} from "./contact-email";
import { getSenderForMarket, sendContactFormEmails } from "./email-service";

const form: ContactFormData = {
  name: "Jean Client",
  email: "jean@example.com",
  phone: "+33 1 23 45 67 89",
  subject: "Question produit",
  category: "product",
  message: "Je souhaite obtenir plus d'informations.",
  orderNumber: "FR-100",
};

test("collects the selected market row's configured emails and removes duplicates", () => {
  const settings = {
    email: "main@xhaccp.fr",
    logisticsEmail: "logistics@xhaccp.fr; MAIN@xhaccp.fr",
  };

  assert.deepEqual(collectContactRecipients(settings), [
    "main@xhaccp.fr",
    "logistics@xhaccp.fr",
  ]);
});

test("selects RO+EN, FR+EN, and EN-only languages by market", () => {
  assert.deepEqual(getContactLanguages("ro"), ["ro", "en"]);
  assert.deepEqual(getContactLanguages("fr"), ["fr", "en"]);
  assert.deepEqual(getContactLanguages("com"), ["en"]);
});

test("uses the verified French sender only for the FR market", () => {
  assert.equal(getSenderForMarket("fr"), "info@xhaccp.fr");
  assert.equal(getSenderForMarket("FR"), "info@xhaccp.fr");
  assert.notEqual(getSenderForMarket("ro"), "info@xhaccp.fr");
  assert.notEqual(getSenderForMarket("com"), "info@xhaccp.fr");
});

test("builds French and English versions for the FR domain", () => {
  const templates = buildContactEmailTemplates(
    form,
    "fr",
    "TICKET_TEST",
    new Date("2026-08-19T10:00:00Z"),
  );

  assert.match(templates.business.html, /Nouveau message de contact/);
  assert.match(templates.business.html, /New contact message/);
  assert.match(templates.customer.html, /Nous avons bien reçu votre message/);
  assert.match(templates.customer.html, /We received your message/);
  assert.doesNotMatch(templates.customer.html, /@xhaccp\.(?:ro|fr|com)/);
  assert.doesNotMatch(templates.customer.text, /@xhaccp\.(?:ro|fr|com)/);
});

test("withdrawal receipts include the submitted declaration and exact localized timestamp", () => {
  const submittedAt = new Date("2026-08-19T10:00:00.000Z");
  const withdrawalForm: ContactFormData = {
    ...form,
    subject: "Déclaration de rétractation",
    category: "withdrawal",
    message: "Je vous notifie ma décision de me rétracter de la commande FR-100.",
  };
  const templates = buildContactEmailTemplates(
    withdrawalForm,
    "fr",
    "TICKET_TEST",
    submittedAt,
  );

  assert.match(templates.customer.html, /Nous avons bien reçu votre déclaration de rétractation/);
  assert.match(templates.customer.html, /Date et heure d’envoi \(heure de Paris\)/);
  assert.match(templates.customer.html, /12:00:00/);
  assert.match(templates.customer.text, /Je vous notifie ma décision de me rétracter de la commande FR-100/);
  assert.match(templates.business.text, /Cette demande constitue une déclaration de rétractation/);
});

test("does not duplicate English content for the COM domain", () => {
  const templates = buildContactEmailTemplates(
    form,
    "com",
    "TICKET_TEST",
  );

  assert.equal((templates.business.html.match(/<section lang="en"/g) || []).length, 1);
  assert.doesNotMatch(templates.business.html, /Nouveau message de contact|Mesaj nou de contact/);
});

test("escapes customer-provided HTML in generated messages", () => {
  const templates = buildContactEmailTemplates(
    { ...form, name: "<script>alert(1)</script>", message: "<b>unsafe</b>" },
    "ro",
    "TICKET_TEST",
  );

  assert.doesNotMatch(templates.business.html, /<script>|<b>unsafe<\/b>/);
  assert.match(templates.business.html, /&lt;script&gt;|&lt;b&gt;unsafe&lt;\/b&gt;/);
});

test("attempts every recipient independently and reports partial delivery", async () => {
  const attempted: string[] = [];
  const senders: string[] = [];
  const result = await sendContactFormEmails(form, {
    market: "fr",
    businessEmails: [
      "working@xhaccp.fr",
      "failing@xhaccp.fr",
      "WORKING@xhaccp.fr",
    ],
    send: async (params) => {
      attempted.push(params.to);
      senders.push(params.from);
      return params.to !== "failing@xhaccp.fr";
    },
  });

  assert.deepEqual(attempted, [
    "working@xhaccp.fr",
    "failing@xhaccp.fr",
    form.email,
  ]);
  assert.deepEqual(senders, ["info@xhaccp.fr", "info@xhaccp.fr", "info@xhaccp.fr"]);
  assert.equal(result.toBusinessSent, true);
  assert.equal(result.toCustomerSent, true);
  assert.equal(result.businessRecipientsAttempted, 2);
  assert.equal(result.businessRecipientsSent, 1);
  assert.equal(result.businessRecipientsFailed, 1);
});

test("does not confirm receipt to the customer when no business recipient received it", async () => {
  const attempted: string[] = [];
  const result = await sendContactFormEmails(form, {
    market: "com",
    businessEmails: ["failing@xhaccp.com"],
    send: async (params) => {
      attempted.push(params.to);
      return false;
    },
  });

  assert.deepEqual(attempted, ["failing@xhaccp.com"]);
  assert.equal(result.toBusinessSent, false);
  assert.equal(result.toCustomerSent, false);
});