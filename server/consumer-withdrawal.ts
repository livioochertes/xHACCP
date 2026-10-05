import type { ContactFormData, ContactMarket } from "./contact-email.js";
import { isValidEmailAddress } from "./contact-email.js";

export interface ConsumerWithdrawalInput {
  firstName: string;
  lastName: string;
  email: string;
  orderNumber: string;
  items?: string;
}

export type ConsumerWithdrawalParseResult =
  | { ok: true; data: ContactFormData }
  | { ok: false; error: string };

function singleLine(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function multiLine(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return normalized.length <= maxLength ? normalized : null;
}

const DECLARATION: Record<ContactMarket, (orderNumber: string, items: string) => string> = {
  fr: (orderNumber, items) =>
    `Je vous notifie par la présente ma décision de me rétracter du contrat à distance relatif à la commande ${orderNumber}.${items ? `\n\nArticles concernés par cette demande :\n${items}` : ""}`,
  ro: (orderNumber, items) =>
    `Vă notific prin prezenta decizia mea de retragere din contractul la distanță aferent comenzii ${orderNumber}.${items ? `\n\nProdusele vizate de această cerere:\n${items}` : ""}`,
  com: (orderNumber, items) =>
    `I hereby give notice of my decision to withdraw from the distance contract relating to order ${orderNumber}.${items ? `\n\nItems concerned by this request:\n${items}` : ""}`,
};

export function parseConsumerWithdrawalInput(
  input: unknown,
  market: ContactMarket,
): ConsumerWithdrawalParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "invalid_submission" };
  }

  const body = input as Record<string, unknown>;
  const firstName = singleLine(body.firstName, 100);
  const lastName = singleLine(body.lastName, 100);
  const email = singleLine(body.email, 254);
  const orderNumber = singleLine(body.orderNumber, 120);
  const items = multiLine(body.items, 2000);

  if (!firstName || !lastName || !email || !orderNumber || items === null) {
    return { ok: false, error: "required_fields" };
  }
  if (!isValidEmailAddress(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const fullName = `${firstName} ${lastName}`;
  const subjectByMarket: Record<ContactMarket, string> = {
    fr: "Déclaration de rétractation",
    ro: "Declarație de retragere",
    com: "Withdrawal declaration",
  };

  return {
    ok: true,
    data: {
      name: fullName,
      email,
      subject: subjectByMarket[market],
      category: "withdrawal",
      orderNumber,
      message: DECLARATION[market](orderNumber, items),
    },
  };
}
