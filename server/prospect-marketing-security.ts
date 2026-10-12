import { createHmac, timingSafeEqual } from "node:crypto";
import { EVENT_VOUCHER_ACTIVATION_DAYS, formatEventVoucherDiscount } from "./event-voucher";

export type ProspectTokenPurpose = "subscribe" | "unsubscribe";

export type ProspectMarketingEmailData = {
  html: string;
  text: string;
  headers: Record<string, string>;
};

export type ProspectMarketingEmailRecipient = {
  prospectId: number;
  campaignId?: number;
  restaurantName?: string | null;
  city?: string | null;
};

export type ProspectMarketingTokenClaims = {
  prospectId: number;
  campaignId?: number;
};

export const FRENCH_STOREFRONT_ORIGIN = "https://xhaccp.fr";

function tokenSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters to sign marketing links");
  }
  return secret;
}

export function createProspectMarketingToken(
  purpose: ProspectTokenPurpose,
  prospectId: number,
  campaignId?: number,
): string {
  if (!Number.isSafeInteger(prospectId) || prospectId <= 0) {
    throw new Error("Invalid prospect ID");
  }
  if (campaignId !== undefined && (
    purpose !== "unsubscribe"
    || !Number.isSafeInteger(campaignId)
    || campaignId <= 0
  )) {
    throw new Error("Invalid campaign ID for prospect marketing token");
  }
  const campaignPart = campaignId === undefined ? "" : `:${campaignId}`;
  const payload = `xhaccp-prospect-v1:${purpose}:${prospectId}${campaignPart}`;
  const signature = createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  return campaignId === undefined
    ? `${prospectId}.${signature}`
    : `${prospectId}.${campaignId}.${signature}`;
}

export function verifyProspectMarketingTokenClaims(
  purpose: ProspectTokenPurpose,
  token: unknown,
): ProspectMarketingTokenClaims | null {
  if (typeof token !== "string" || token.length > 256) return null;
  const parts = token.split(".");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const idText = parts[0];
  const campaignText = parts.length === 3 ? parts[1] : undefined;
  const signature = parts[parts.length - 1];
  if (!idText || !signature || !/^\d+$/.test(idText)) return null;
  const prospectId = Number(idText);
  if (!Number.isSafeInteger(prospectId) || prospectId <= 0) return null;
  const campaignId = campaignText === undefined ? undefined : Number(campaignText);
  if (campaignText !== undefined && (
    purpose !== "unsubscribe"
    || !/^\d+$/.test(campaignText)
    || !Number.isSafeInteger(campaignId)
    || (campaignId || 0) <= 0
  )) return null;

  let expected: Buffer;
  let actual: Buffer;
  try {
    const campaignPart = campaignId === undefined ? "" : `:${campaignId}`;
    const payload = `xhaccp-prospect-v1:${purpose}:${prospectId}${campaignPart}`;
    expected = Buffer.from(createHmac("sha256", tokenSecret()).update(payload).digest("base64url"));
    actual = Buffer.from(signature);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return campaignId === undefined ? { prospectId } : { prospectId, campaignId };
}

export function verifyProspectMarketingToken(
  purpose: ProspectTokenPurpose,
  token: unknown,
): number | null {
  return verifyProspectMarketingTokenClaims(purpose, token)?.prospectId ?? null;
}

export function getProspectSubscribeUrl(prospectId: number): string {
  const token = createProspectMarketingToken("subscribe", prospectId);
  return `${FRENCH_STOREFRONT_ORIGIN}/newsletter/subscribe?token=${encodeURIComponent(token)}`;
}

export function getProspectUnsubscribeUrl(prospectId: number, campaignId?: number): string {
  const token = createProspectMarketingToken("unsubscribe", prospectId, campaignId);
  return `${FRENCH_STOREFRONT_ORIGIN}/api/marketing/prospect-unsubscribe?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string): string {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildProspectMarketingEmail(data: {
  htmlContent: string;
  textContent?: string | null;
  recipient?: ProspectMarketingEmailRecipient;
  audience: "invitation" | "newsletter";
  offer?: {
    name: string;
    discountType: string;
    discountValue: string;
    validMonths: number;
    activationDays?: number;
  };
  testMode?: boolean;
}): ProspectMarketingEmailData {
  if (!data.testMode && !data.recipient) {
    throw new Error("A prospect recipient is required outside test mode");
  }
  const recipient = data.recipient;
  const subscribeUrl = `${FRENCH_STOREFRONT_ORIGIN}/chef-event`;
  const unsubscribeUrl = data.testMode || !recipient
    ? `${FRENCH_STOREFRONT_ORIGIN}/privacy`
    : getProspectUnsubscribeUrl(recipient.prospectId, recipient.campaignId);
  const restaurantName = escapeHtml(recipient?.restaurantName?.trim() || "votre restaurant");
  const city = escapeHtml(recipient?.city?.trim() || "");
  const offerName = escapeHtml(data.offer?.name || "Offre de bienvenue xHACCP France");
  const discountDisplay = data.offer
    ? formatEventVoucherDiscount(data.offer.discountType, data.offer.discountValue)
    : "";
  const activationDays = data.offer?.activationDays ?? EVENT_VOUCHER_ACTIVATION_DAYS;
  const offerTerms = data.offer
    ? `Première commande payée dans les ${activationDays} jours suivant l'inscription. Code valable ${data.offer.validMonths} mois à compter de l'inscription.`
    : "";
  const htmlHadUnsubscribePlaceholder = /\{\{\s*unsubscribe_url\s*\}\}/i.test(data.htmlContent);
  const textHadUnsubscribePlaceholder = /\{\{\s*unsubscribe_url\s*\}\}/i.test(data.textContent || "");
  const replaceTokens = (value: string, format: "html" | "text") => value.replace(
    /\{\{\s*(newsletter_signup_url|unsubscribe_url|restaurant_name|city|offer_name|discount_display|discount_value|discount_type|valid_months|activation_days|offer_terms|landing_url)\s*\}\}/gi,
    (_match, token: string) => {
      switch (token.toLowerCase()) {
        case "newsletter_signup_url": return subscribeUrl;
        case "unsubscribe_url": return unsubscribeUrl;
        case "restaurant_name": return format === "html" ? restaurantName : (recipient?.restaurantName?.trim() || "votre restaurant");
        case "city": return format === "html" ? city : (recipient?.city?.trim() || "");
        case "offer_name": return format === "html" ? offerName : (data.offer?.name || "Offre de bienvenue xHACCP France");
        case "discount_display": return format === "html" ? escapeHtml(discountDisplay) : discountDisplay;
        case "discount_value": return format === "html" ? escapeHtml(data.offer?.discountValue || "") : (data.offer?.discountValue || "");
        case "discount_type": return data.offer?.discountType || "";
        case "valid_months": return data.offer ? String(data.offer.validMonths) : "";
        case "activation_days": return String(activationDays);
        case "offer_terms": return format === "html" ? escapeHtml(offerTerms) : offerTerms;
        case "landing_url": return subscribeUrl;
        default: return "";
      }
    },
  );

  let html = replaceTokens(data.htmlContent, "html");
  let text = replaceTokens(data.textContent || stripHtml(data.htmlContent), "text");
  if (!htmlHadUnsubscribePlaceholder) {
    html += `<p style="margin-top:24px;font-size:12px;color:#64748b;">Vous ne souhaitez plus recevoir ces messages ? <a href="${unsubscribeUrl}">Se désabonner</a>.</p>`;
  }
  if (!textHadUnsubscribePlaceholder) {
    text += `\n\nNe plus recevoir ces messages : ${unsubscribeUrl}`;
  }

  if (data.testMode) {
    html = `<div style="padding:10px 14px;background:#fff4cc;color:#7c4a03;font:14px Arial,sans-serif;text-align:center">Email de test uniquement — aucun abonnement ni statut de destinataire n'a été modifié.</div>${html}`;
    text = `EMAIL DE TEST — aucun abonnement ni statut de destinataire n'a été modifié.\n\n${text}`;
  }

  return {
    html,
    text,
    headers: data.testMode ? {} : {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
