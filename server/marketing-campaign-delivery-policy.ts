import { createPublicKey, verify as verifySignature } from "node:crypto";

export const MARKETING_CAMPAIGN_BATCH_SIZE = 500;

export type MarketingCampaignDeliveryStatus =
  | "queued"
  | "submitting"
  | "accepted"
  | "delivered"
  | "deferred"
  | "bounced"
  | "dropped"
  | "spam_report"
  | "unsubscribed"
  | "failed"
  | "unknown"
  | "suppressed";

export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    batches.push(items.slice(offset, offset + batchSize));
  }
  return batches;
}

export function nextDeliveryStatus(
  current: MarketingCampaignDeliveryStatus,
  eventName: string,
): MarketingCampaignDeliveryStatus | null {
  const normalized = eventName.toLowerCase();
  if (normalized === "spamreport") return "spam_report";
  if (normalized === "unsubscribe" || normalized === "group_unsubscribe") return "unsubscribed";
  if (current === "bounced" || current === "spam_report" || current === "unsubscribed") return null;
  if (normalized === "bounce") return current === "delivered" ? null : "bounced";
  if (normalized === "delivered") return current === "dropped" ? null : "delivered";
  if (normalized === "deferred") {
    return ["queued", "submitting", "accepted", "unknown"].includes(current) ? "deferred" : null;
  }
  if (normalized === "dropped") {
    return ["queued", "submitting", "accepted", "deferred", "unknown"].includes(current) ? "dropped" : null;
  }
  if (normalized === "processed") {
    return ["queued", "submitting", "failed", "unknown"].includes(current) ? "accepted" : null;
  }
  return null;
}

export function shouldSuppressDroppedProspect(reason: unknown): boolean {
  return typeof reason === "string"
    && /(invalid|bounce|unsubscr|spam|block|suppress|mailbox not found)/i.test(reason);
}

export function verifySendGridEventSignature(
  rawBody: Buffer,
  signature: string,
  timestamp: string,
  publicKeyPem: string,
): boolean {
  if (!rawBody.length || !signature || !timestamp || !publicKeyPem) return false;
  try {
    const publicKey = createPublicKey(publicKeyPem.replace(/\\n/g, "\n"));
    const signedPayload = Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]);
    return verifySignature(
      "sha256",
      signedPayload,
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
