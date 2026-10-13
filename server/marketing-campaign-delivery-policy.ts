import { createPublicKey, verify as verifySignature } from "node:crypto";

export const MARKETING_CAMPAIGN_BATCH_SIZE = 500;
export const PROSPECT_CLEANUP_SUPPRESSION_REASONS = [
  "hard_bounce",
  "spam_report",
  "invalid_recipient",
] as const;

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

export function normalizeSendGridEvent(
  eventName: string,
  eventType?: unknown,
  machineOpen?: unknown,
): { storedEventType: string; deliveryEventName: string } {
  const normalizedName = eventName.trim().toLowerCase();
  const normalizedType = typeof eventType === "string" ? eventType.trim().toLowerCase() : "";

  if (normalizedName === "bounce" && normalizedType === "blocked") {
    return { storedEventType: "blocked", deliveryEventName: "deferred" };
  }
  if (normalizedName === "open" && machineOpen === true) {
    return { storedEventType: "machine_open", deliveryEventName: "machine_open" };
  }
  return { storedEventType: normalizedName, deliveryEventName: normalizedName };
}

export function extractCampaignEventCorrelation(event: {
  custom_args?: unknown;
  customArgs?: unknown;
  unique_args?: unknown;
}): { campaignId: number; recipientId: number } {
  const argumentSets = [event.custom_args, event.customArgs, event.unique_args]
    .filter((value): value is Record<string, unknown> => (
      typeof value === "object" && value !== null && !Array.isArray(value)
    ));
  const values = (key: string) => argumentSets
    .map((args) => args[key])
    .find((value) => value !== undefined && value !== null && value !== "");
  // marketing_campaign_id is a SendGrid-owned event property. Prefer our
  // namespaced key; accept the old custom-argument key for compatible payloads.
  return {
    campaignId: Number(values("xhaccp_campaign_id") ?? values("marketing_campaign_id")),
    recipientId: Number(values("xhaccp_campaign_recipient_id") ?? values("marketing_campaign_recipient_id")),
  };
}

export function shouldSuppressDroppedProspect(reason: unknown): boolean {
  return typeof reason === "string"
    && /(invalid|bounce|unsubscr|spam|block|suppress|mailbox not found)/i.test(reason);
}

export function verifySendGridEventSignature(
  rawBody: Buffer,
  signature: string,
  timestamp: string,
  publicKeyValue: string,
): boolean {
  if (!rawBody.length || !signature || !timestamp || !publicKeyValue) return false;
  try {
    const normalizedKey = publicKeyValue.trim().replace(/\\n/g, "\n");
    let publicKey;
    if (normalizedKey.includes("-----BEGIN")) {
      publicKey = createPublicKey(normalizedKey);
    } else {
      const base64Key = normalizedKey.replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Key)) return false;
      const keyDer = Buffer.from(base64Key, "base64");
      const canonicalBase64 = keyDer.toString("base64").replace(/=+$/, "");
      if (!keyDer.length || canonicalBase64 !== base64Key.replace(/=+$/, "")) return false;
      publicKey = createPublicKey({ key: keyDer, format: "der", type: "spki" });
    }
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
