import { createHmac, timingSafeEqual } from "node:crypto";

export type ProspectTokenPurpose = "subscribe" | "unsubscribe";

export type ProspectMarketingEmailData = {
  html: string;
  text: string;
  headers: Record<string, string>;
};

export type ProspectMarketingEmailRecipient = {
  prospectId: number;
  restaurantName?: string | null;
  city?: string | null;
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
): string {
  if (!Number.isSafeInteger(prospectId) || prospectId <= 0) {
    throw new Error("Invalid prospect ID");
  }
  const payload = `xhaccp-prospect-v1:${purpose}:${prospectId}`;
  const signature = createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  return `${prospectId}.${signature}`;
}

export function verifyProspectMarketingToken(
  purpose: ProspectTokenPurpose,
  token: unknown,
): number | null {
  if (typeof token !== "string" || token.length > 256) return null;
  const [idText, signature, extra] = token.split(".");
  if (!idText || !signature || extra !== undefined || !/^\d+$/.test(idText)) return null;
  const prospectId = Number(idText);
  if (!Number.isSafeInteger(prospectId) || prospectId <= 0) return null;

  let expected: Buffer;
  let actual: Buffer;
  try {
    const payload = `xhaccp-prospect-v1:${purpose}:${prospectId}`;
    expected = Buffer.from(createHmac("sha256", tokenSecret()).update(payload).digest("base64url"));
    actual = Buffer.from(signature);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return prospectId;
}

export function getProspectSubscribeUrl(prospectId: number): string {
  const token = createProspectMarketingToken("subscribe", prospectId);
  return `${FRENCH_STOREFRONT_ORIGIN}/newsletter/subscribe?token=${encodeURIComponent(token)}`;
}

export function getProspectUnsubscribeUrl(prospectId: number): string {
  const token = createProspectMarketingToken("unsubscribe", prospectId);
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
  recipient: ProspectMarketingEmailRecipient;
  audience: "invitation" | "newsletter";
}): ProspectMarketingEmailData {
  const subscribeUrl = getProspectSubscribeUrl(data.recipient.prospectId);
  const unsubscribeUrl = getProspectUnsubscribeUrl(data.recipient.prospectId);
  const restaurantName = escapeHtml(data.recipient.restaurantName?.trim() || "votre restaurant");
  const city = escapeHtml(data.recipient.city?.trim() || "");
  const htmlHadSignupPlaceholder = /\{\{\s*newsletter_signup_url\s*\}\}/i.test(data.htmlContent);
  const htmlHadUnsubscribePlaceholder = /\{\{\s*unsubscribe_url\s*\}\}/i.test(data.htmlContent);
  const textHadSignupPlaceholder = /\{\{\s*newsletter_signup_url\s*\}\}/i.test(data.textContent || "");
  const textHadUnsubscribePlaceholder = /\{\{\s*unsubscribe_url\s*\}\}/i.test(data.textContent || "");
  const replaceTokens = (value: string, format: "html" | "text") => value.replace(
    /\{\{\s*(newsletter_signup_url|unsubscribe_url|restaurant_name|city)\s*\}\}/gi,
    (_match, token: string) => {
      switch (token.toLowerCase()) {
        case "newsletter_signup_url": return subscribeUrl;
        case "unsubscribe_url": return unsubscribeUrl;
        case "restaurant_name": return format === "html" ? restaurantName : (data.recipient.restaurantName?.trim() || "votre restaurant");
        case "city": return format === "html" ? city : (data.recipient.city?.trim() || "");
        default: return "";
      }
    },
  );

  let html = replaceTokens(data.htmlContent, "html");
  let text = replaceTokens(data.textContent || stripHtml(data.htmlContent), "text");
  if (data.audience === "invitation" && !htmlHadSignupPlaceholder) {
    html += `<p style="margin:24px 0;"><a href="${subscribeUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">M'inscrire à la newsletter et recevoir mon voucher de -20%</a></p>`;
  }
  if (data.audience === "invitation" && !textHadSignupPlaceholder) {
    text += `\n\nInscrivez-vous à la newsletter et recevez votre voucher de -20% : ${subscribeUrl}`;
  }
  if (!htmlHadUnsubscribePlaceholder) {
    html += `<p style="margin-top:24px;font-size:12px;color:#64748b;">Vous ne souhaitez plus recevoir ces messages ? <a href="${unsubscribeUrl}">Se désabonner</a>.</p>`;
  }
  if (!textHadUnsubscribePlaceholder) {
    text += `\n\nNe plus recevoir ces messages : ${unsubscribeUrl}`;
  }

  return {
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
