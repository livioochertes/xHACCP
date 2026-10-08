import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  marketingCampaignBatches,
  marketingCampaignRecipients,
  marketingCampaigns,
  marketingProspects,
  sendgridCampaignWebhookEvents,
  type MarketingCampaign,
} from "@shared/schema";
import { db, pool } from "./db";
import { storage, type MarketingRecipient } from "./storage";
import { getSenderForMarket, sendEmailWithOutcome } from "./email-service";
import { buildProspectMarketingEmail } from "./prospect-marketing-security";
import {
  markProspectInvitationSent,
  getProspectById,
  suppressProspectEmail,
} from "./prospect-marketing-db";
import { EVENT_VOUCHER_CAMPAIGN_SLUG } from "./event-voucher";
import {
  MARKETING_CAMPAIGN_BATCH_SIZE,
  normalizeSendGridEvent,
  nextDeliveryStatus,
  shouldSuppressDroppedProspect,
  splitIntoBatches,
  type MarketingCampaignDeliveryStatus,
} from "./marketing-campaign-delivery-policy";

const SEND_CONCURRENCY = 10;
const CAMPAIGN_LOCK_NAMESPACE = 1_927_318_421;
const campaignRuns = new Set<number>();

const API_ACCEPTED_STATUSES = [
  "accepted",
  "delivered",
  "deferred",
  "bounced",
  "dropped",
  "spam_report",
  "unsubscribed",
] as const;

export interface MarketingCampaignDeliverySummary {
  campaignId: number;
  campaignStatus: string;
  recipientCount: number;
  batchSize: number;
  counts: Record<MarketingCampaignDeliveryStatus, number>;
  eventAnalytics: Record<string, { eventCount: number; uniqueRecipients: number }>;
  batches: Array<{
    id: number;
    batchNumber: number;
    recipientCount: number;
    acceptedCount: number;
    deliveredCount: number;
    failedCount: number;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
}

export async function queueProspectMarketingCampaign(
  campaignId: number,
  recipients: MarketingRecipient[],
): Promise<{ recipientCount: number; batchCount: number }> {
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
    throw new Error("Invalid campaign ID");
  }
  if (!recipients.length || recipients.some((recipient) => !recipient.prospectId || recipient.source !== "prospect")) {
    throw new Error("A prospect campaign requires eligible prospect recipients");
  }

  const batches = splitIntoBatches(recipients, MARKETING_CAMPAIGN_BATCH_SIZE);
  await db.transaction(async (tx) => {
    const [campaign] = await tx.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, campaignId))
      .limit(1)
      .for("update");
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "draft" && campaign.status !== "failed") {
      throw new Error("Only a draft campaign can be sent");
    }
    const existingBatches = await tx.select({ id: marketingCampaignBatches.id })
      .from(marketingCampaignBatches)
      .where(eq(marketingCampaignBatches.campaignId, campaignId))
      .limit(1);
    if (existingBatches.length) {
      throw new Error("This campaign already has a delivery record and cannot be sent again");
    }

    const now = new Date();
    await tx.update(marketingCampaigns)
      .set({
        status: "sending",
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        sentAt: null,
        updatedAt: now,
      })
      .where(eq(marketingCampaigns.id, campaignId));

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batchRecipients = batches[batchIndex];
      const [batch] = await tx.insert(marketingCampaignBatches).values({
        campaignId,
        batchNumber: batchIndex + 1,
        recipientCount: batchRecipients.length,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      }).returning({ id: marketingCampaignBatches.id });
      if (!batch) throw new Error("Campaign batch could not be created");

      for (const rows of splitIntoBatches(batchRecipients, 250)) {
        await tx.insert(marketingCampaignRecipients).values(rows.map((recipient) => ({
          campaignId,
          batchId: batch.id,
          prospectId: recipient.prospectId!,
          email: recipient.email,
          status: "queued",
          createdAt: now,
          updatedAt: now,
        })));
      }
    }
  });

  processMarketingCampaign(campaignId);
  return { recipientCount: recipients.length, batchCount: batches.length };
}

export function startMarketingCampaignDeliveryWorker(): void {
  const scan = async () => {
    try {
      const campaigns = await db.select({ id: marketingCampaigns.id })
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.status, "sending"))
        .orderBy(asc(marketingCampaigns.id))
        .limit(50);
      for (const campaign of campaigns) processMarketingCampaign(campaign.id);
    } catch (error) {
      console.error("Marketing campaign recovery scan failed:", error instanceof Error ? error.message : "unknown");
    }
  };

  void scan();
  const timer = setInterval(() => void scan(), 10_000);
  timer.unref?.();
}

function processMarketingCampaign(campaignId: number): void {
  if (campaignRuns.has(campaignId)) return;
  campaignRuns.add(campaignId);
  void runMarketingCampaign(campaignId)
    .catch((error) => {
      console.error("Marketing campaign worker failed:", {
        campaignId,
        message: error instanceof Error ? error.message : "unknown",
      });
    })
    .finally(() => campaignRuns.delete(campaignId));
}

async function runMarketingCampaign(campaignId: number): Promise<void> {
  const lockClient = await pool.connect();
  let lockAcquired = false;
  try {
    const lockResult = await lockClient.query(
      "SELECT pg_try_advisory_lock($1, $2) AS locked",
      [CAMPAIGN_LOCK_NAMESPACE, campaignId],
    );
    lockAcquired = Boolean(lockResult.rows?.[0]?.locked);
    if (!lockAcquired) return;

    const campaign = await storage.getMarketingCampaign(campaignId);
    if (!campaign || campaign.status !== "sending") return;
    const segment = campaign.segmentId
      ? await storage.getMarketingSegment(campaign.segmentId)
      : undefined;
    if (!segment?.criteria) {
      await finishCampaign(campaignId, "failed", 0, campaign.recipientCount);
      return;
    }

    const criteria = segment.criteria;
    const audience = criteria.prospectAudience;
    if (audience !== "invitation" && audience !== "newsletter") {
      await finishCampaign(campaignId, "failed", 0, campaign.recipientCount);
      return;
    }
    const hasOfferTokens = /\{\{\s*(offer_name|discount_display|discount_value|discount_type|valid_months|activation_days|offer_terms)\s*\}\}/i
      .test(`${campaign.htmlContent}\n${campaign.textContent || ""}`);
    const requiresOffer = audience === "invitation" || hasOfferTokens;
    const activeOffer = requiresOffer
      ? await storage.getEventVoucherCampaign(EVENT_VOUCHER_CAMPAIGN_SLUG)
      : undefined;
    if (requiresOffer && !activeOffer) {
      await finishCampaign(campaignId, "failed", 0, campaign.recipientCount);
      return;
    }

    const batches = await db.select().from(marketingCampaignBatches)
      .where(eq(marketingCampaignBatches.campaignId, campaignId))
      .orderBy(asc(marketingCampaignBatches.batchNumber));
    if (!batches.length) {
      await finishCampaign(campaignId, "failed", 0, campaign.recipientCount);
      return;
    }

    // If a process stopped after handing a message to SendGrid but before saving its
    // response, do not resend it automatically. A signed webhook may still resolve it.
    await db.update(marketingCampaignRecipients)
      .set({
        status: "unknown",
        lastError: "worker_stopped_before_confirmation",
        updatedAt: new Date(),
      })
      .where(and(
        eq(marketingCampaignRecipients.campaignId, campaignId),
        eq(marketingCampaignRecipients.status, "submitting"),
      ));

    for (const batch of batches) {
      await lockClient.query("SELECT 1");
      if (["accepted", "partial", "failed", "complete"].includes(batch.status)) continue;
      const now = new Date();
      await db.update(marketingCampaignBatches)
        .set({
          status: "sending",
          startedAt: batch.startedAt || now,
          updatedAt: now,
        })
        .where(eq(marketingCampaignBatches.id, batch.id));

      const queuedRecipients = await db.select().from(marketingCampaignRecipients)
        .where(and(
          eq(marketingCampaignRecipients.batchId, batch.id),
          eq(marketingCampaignRecipients.status, "queued"),
        ))
        .orderBy(asc(marketingCampaignRecipients.id));
      const currentlyEligible = await storage.getMarketingRecipients(criteria);
      const eligibleByProspectId = new Map(
        currentlyEligible
          .filter((recipient) => Number.isSafeInteger(recipient.prospectId))
          .map((recipient) => [recipient.prospectId!, recipient]),
      );
      const sendable = queuedRecipients.filter((recipient) => eligibleByProspectId.has(recipient.prospectId || -1));
      const noLongerEligible = queuedRecipients.filter((recipient) => !eligibleByProspectId.has(recipient.prospectId || -1));
      if (noLongerEligible.length) {
        const noLongerEligibleIds = noLongerEligible.map((recipient) => recipient.id);
        await db.update(marketingCampaignRecipients)
          .set({
            status: "suppressed",
            lastError: "consent_or_suppression_changed",
            updatedAt: new Date(),
          })
          .where(inArray(marketingCampaignRecipients.id, noLongerEligibleIds));
      }

      for (const chunk of splitIntoBatches(sendable, SEND_CONCURRENCY)) {
        await Promise.all(chunk.map((recipient) => sendCampaignRecipient(
          campaign,
          recipient,
          eligibleByProspectId.get(recipient.prospectId!)!,
          audience,
          activeOffer,
        )));
      }

      await refreshBatchCounts(batch.id);
    }

    await refreshCampaignCounts(campaignId);
  } finally {
    if (lockAcquired) {
      try {
        await lockClient.query("SELECT pg_advisory_unlock($1, $2)", [CAMPAIGN_LOCK_NAMESPACE, campaignId]);
      } catch {
        console.error("Marketing campaign advisory lock could not be released", { campaignId });
      }
    }
    lockClient.release();
  }
}

async function sendCampaignRecipient(
  campaign: MarketingCampaign,
  recipient: typeof marketingCampaignRecipients.$inferSelect,
  personalization: MarketingRecipient,
  audience: "invitation" | "newsletter",
  activeOffer: Awaited<ReturnType<typeof storage.getEventVoucherCampaign>> | undefined,
): Promise<void> {
  const prospectId = recipient.prospectId;
  if (!prospectId) {
    await updateRecipient(recipient.id, "failed", "prospect_record_missing");
    return;
  }
  const now = new Date();
  const [claimed] = await db.update(marketingCampaignRecipients)
    .set({ status: "submitting", attemptedAt: now, updatedAt: now, lastError: null })
    .where(and(
      eq(marketingCampaignRecipients.id, recipient.id),
      eq(marketingCampaignRecipients.status, "queued"),
    ))
    .returning({ id: marketingCampaignRecipients.id });
  if (!claimed) return;

  const prospect = await getProspectById(prospectId);
  const currentlyEligible = prospect
    && !prospect.unsubscribedAt
    && prospect.subscriptionStatus !== "unsubscribed"
    && !prospect.emailSuppressedAt
    && (audience === "newsletter"
      ? prospect.subscriptionStatus === "subscribed" && Boolean(prospect.newsletterConsentAt)
      : prospect.subscriptionStatus === "not_subscribed"
        && !prospect.invitationSentAt
        && !prospect.newsletterConsentAt);
  if (!currentlyEligible) {
    await updateRecipient(recipient.id, "suppressed", "consent_or_suppression_changed");
    return;
  }

  let outcome: Awaited<ReturnType<typeof sendEmailWithOutcome>>;
  try {
    const personalized = buildProspectMarketingEmail({
      htmlContent: campaign.htmlContent,
      textContent: campaign.textContent,
      recipient: {
        prospectId,
        campaignId: campaign.id,
        restaurantName: personalization.restaurantName,
        city: personalization.city,
      },
      audience,
      offer: activeOffer,
    });

    outcome = await sendEmailWithOutcome({
      to: recipient.email,
      from: getSenderForMarket("fr"),
      subject: campaign.subject,
      html: personalized.html,
      text: personalized.text,
      headers: personalized.headers,
      customArgs: {
        marketing_campaign_id: String(campaign.id),
        marketing_campaign_recipient_id: String(recipient.id),
      },
      suppressRecipientLog: true,
    });

    for (let retry = 0; outcome.status === "rejected" && outcome.retryable && retry < 2; retry++) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
      outcome = await sendEmailWithOutcome({
        to: recipient.email,
        from: getSenderForMarket("fr"),
        subject: campaign.subject,
        html: personalized.html,
        text: personalized.text,
        headers: personalized.headers,
        customArgs: {
          marketing_campaign_id: String(campaign.id),
          marketing_campaign_recipient_id: String(recipient.id),
        },
        suppressRecipientLog: true,
      });
    }
  } catch {
    console.error("Prospect campaign message preparation failed", { campaignId: campaign.id, recipientId: recipient.id });
    await updateRecipient(recipient.id, "failed", "message_preparation_failed");
    return;
  }

  if (outcome.status === "accepted") {
    await db.update(marketingCampaignRecipients)
      .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date(), lastError: null })
      .where(and(
        eq(marketingCampaignRecipients.id, recipient.id),
        eq(marketingCampaignRecipients.status, "submitting"),
      ));
    if (audience === "invitation") {
      try {
        await markProspectInvitationSent(prospectId);
      } catch {
        console.error("Could not save prospect invitation state", { campaignId: campaign.id, recipientId: recipient.id });
      }
    }
  } else if (outcome.status === "unknown") {
    await updateRecipient(recipient.id, "unknown", outcome.reason);
  } else {
    await updateRecipient(recipient.id, "failed", outcome.reason);
    if (outcome.reason === "invalid_recipient") {
      await suppressProspectEmail(prospectId, "invalid_recipient");
    }
  }
}

async function updateRecipient(
  recipientId: number,
  status: "failed" | "unknown" | "suppressed",
  reason: string,
): Promise<void> {
  await db.update(marketingCampaignRecipients)
    .set({ status, lastError: reason.slice(0, 80), updatedAt: new Date() })
    .where(and(
      eq(marketingCampaignRecipients.id, recipientId),
      eq(marketingCampaignRecipients.status, "submitting"),
    ));
}

async function refreshBatchCounts(batchId: number): Promise<void> {
  const [counts] = await db.select({
    accepted: sql<number>`count(*) filter (where ${marketingCampaignRecipients.acceptedAt} is not null)::int`,
    delivered: sql<number>`count(*) filter (where ${marketingCampaignRecipients.deliveredAt} is not null)::int`,
    failed: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} in ('failed', 'unknown'))::int`,
    pending: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} in ('queued', 'submitting'))::int`,
  })
    .from(marketingCampaignRecipients)
    .where(eq(marketingCampaignRecipients.batchId, batchId));
  const accepted = Number(counts?.accepted || 0);
  const delivered = Number(counts?.delivered || 0);
  const failed = Number(counts?.failed || 0);
  const pending = Number(counts?.pending || 0);
  const batchStatus = pending > 0 ? "sending" : failed > 0 ? (accepted > 0 ? "partial" : "failed") : "accepted";
  await db.update(marketingCampaignBatches)
    .set({
      acceptedCount: accepted,
      deliveredCount: delivered,
      failedCount: failed,
      status: batchStatus,
      completedAt: pending > 0 ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(marketingCampaignBatches.id, batchId));
}

async function finishCampaign(
  campaignId: number,
  status: "failed",
  sentCount: number,
  failedCount: number,
): Promise<void> {
  await storage.updateMarketingCampaign(campaignId, {
    status,
    sentCount,
    failedCount,
    sentAt: new Date(),
  });
}

async function refreshCampaignCounts(campaignId: number): Promise<void> {
  const [counts] = await db.select({
    accepted: sql<number>`count(*) filter (where ${marketingCampaignRecipients.acceptedAt} is not null)::int`,
    failed: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} in ('failed', 'unknown'))::int`,
    pending: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} in ('queued', 'submitting'))::int`,
    suppressed: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} = 'suppressed')::int`,
  })
    .from(marketingCampaignRecipients)
    .where(eq(marketingCampaignRecipients.campaignId, campaignId));
  const accepted = Number(counts?.accepted || 0);
  const failed = Number(counts?.failed || 0);
  const pending = Number(counts?.pending || 0);
  const suppressed = Number(counts?.suppressed || 0);
  const status = pending > 0
    ? "sending"
    : failed === 0
      ? "sent"
      : accepted > 0 || suppressed > 0
        ? "partial"
        : "failed";

  await storage.updateMarketingCampaign(campaignId, {
    status,
    sentCount: accepted,
    failedCount: failed,
    sentAt: pending > 0 ? null : new Date(),
  });

  const batches = await db.select({ id: marketingCampaignBatches.id })
    .from(marketingCampaignBatches)
    .where(eq(marketingCampaignBatches.campaignId, campaignId));
  for (const batch of batches) await refreshBatchCounts(batch.id);
}

export async function getMarketingCampaignDeliverySummary(
  campaignId: number,
): Promise<MarketingCampaignDeliverySummary | null> {
  const [campaign] = await db.select({
    id: marketingCampaigns.id,
    status: marketingCampaigns.status,
    recipientCount: marketingCampaigns.recipientCount,
  }).from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) return null;

  const summaries = await getMarketingCampaignDeliverySummaries([campaign]);
  return summaries.get(campaignId) || null;
}

export async function getMarketingCampaignDeliveryRecipients(
  campaignId: number,
  page: number,
  pageSize: number,
  statusFilter?: MarketingCampaignDeliveryStatus,
): Promise<{
  recipients: Array<{
    id: number;
    email: string;
    status: MarketingCampaignDeliveryStatus;
    batchNumber: number | null;
    lastEvent: string | null;
    lastEventAt: Date | null;
    updatedAt: Date;
    openCount: number;
    clickCount: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const conditions = [eq(marketingCampaignRecipients.campaignId, campaignId)];
  if (statusFilter) conditions.push(eq(marketingCampaignRecipients.status, statusFilter));
  const [totalRow] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(marketingCampaignRecipients).where(and(...conditions));

  const recipients = await db.select({
    id: marketingCampaignRecipients.id,
    email: marketingCampaignRecipients.email,
    status: marketingCampaignRecipients.status,
    batchNumber: marketingCampaignBatches.batchNumber,
    lastEvent: marketingCampaignRecipients.lastEvent,
    lastEventAt: marketingCampaignRecipients.lastEventAt,
    updatedAt: marketingCampaignRecipients.updatedAt,
  })
    .from(marketingCampaignRecipients)
    .leftJoin(marketingCampaignBatches, eq(marketingCampaignRecipients.batchId, marketingCampaignBatches.id))
    .where(and(...conditions))
    .orderBy(asc(marketingCampaignRecipients.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const recipientIds = recipients.map((recipient) => recipient.id);
  const engagementRows = recipientIds.length
    ? await db.select({
      recipientId: sendgridCampaignWebhookEvents.recipientId,
      eventType: sendgridCampaignWebhookEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
      .from(sendgridCampaignWebhookEvents)
      .where(and(
        inArray(sendgridCampaignWebhookEvents.recipientId, recipientIds),
        inArray(sendgridCampaignWebhookEvents.eventType, ["open", "machine_open", "click"]),
      ))
      .groupBy(sendgridCampaignWebhookEvents.recipientId, sendgridCampaignWebhookEvents.eventType)
    : [];
  const engagementByRecipient = new Map<number, { openCount: number; clickCount: number }>();
  for (const row of engagementRows) {
    if (!row.recipientId) continue;
    const current = engagementByRecipient.get(row.recipientId) || { openCount: 0, clickCount: 0 };
    if (row.eventType === "open" || row.eventType === "machine_open") current.openCount += Number(row.count);
    if (row.eventType === "click") current.clickCount += Number(row.count);
    engagementByRecipient.set(row.recipientId, current);
  }

  return {
    recipients: recipients.map((recipient) => ({
      ...recipient,
      status: recipient.status as MarketingCampaignDeliveryStatus,
      ...(engagementByRecipient.get(recipient.id) || { openCount: 0, clickCount: 0 }),
    })),
    total: Number(totalRow?.count || 0),
    page,
    pageSize,
  };
}

export async function markProspectCampaignRecipientsUnsubscribed(
  prospectId: number,
  campaignId?: number,
): Promise<void> {
  const now = new Date();
  if (Number.isSafeInteger(campaignId) && (campaignId || 0) > 0) {
    const [campaignRecipient] = await db.select({
      id: marketingCampaignRecipients.id,
    }).from(marketingCampaignRecipients)
      .where(and(
        eq(marketingCampaignRecipients.prospectId, prospectId),
        eq(marketingCampaignRecipients.campaignId, campaignId as number),
      ))
      .limit(1);
    if (campaignRecipient) {
      await db.insert(sendgridCampaignWebhookEvents).values({
        eventId: `app-unsubscribe:${campaignId}:${campaignRecipient.id}`,
        recipientId: campaignRecipient.id,
        eventType: "app_unsubscribe",
        occurredAt: now,
      }).onConflictDoNothing();
    }
  }

  const updated = await db.update(marketingCampaignRecipients)
    .set({
      status: "suppressed",
      lastEvent: "app_unsubscribe",
      lastEventAt: now,
      lastError: "prospect_unsubscribed",
      updatedAt: now,
    })
    .where(and(
      eq(marketingCampaignRecipients.prospectId, prospectId),
      eq(marketingCampaignRecipients.status, "queued"),
    ))
    .returning({ campaignId: marketingCampaignRecipients.campaignId });

  const campaignIds = new Set(updated.map((row) => row.campaignId));
  for (const campaignId of campaignIds) await refreshCampaignCounts(campaignId);
}

export async function getMarketingCampaignDeliverySummaries(
  campaigns: Array<Pick<MarketingCampaign, "id" | "status" | "recipientCount">>,
): Promise<Map<number, MarketingCampaignDeliverySummary>> {
  const ids = campaigns.map((campaign) => campaign.id);
  const summaries = new Map<number, MarketingCampaignDeliverySummary>();
  if (!ids.length) return summaries;

  for (const campaign of campaigns) {
    summaries.set(campaign.id, {
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      recipientCount: campaign.recipientCount,
      batchSize: MARKETING_CAMPAIGN_BATCH_SIZE,
      eventAnalytics: {
        processed: { eventCount: 0, uniqueRecipients: 0 },
        delivered: { eventCount: 0, uniqueRecipients: 0 },
        deferred: { eventCount: 0, uniqueRecipients: 0 },
        bounces: { eventCount: 0, uniqueRecipients: 0 },
        blocked: { eventCount: 0, uniqueRecipients: 0 },
        dropped: { eventCount: 0, uniqueRecipients: 0 },
        spamReports: { eventCount: 0, uniqueRecipients: 0 },
        unsubscribes: { eventCount: 0, uniqueRecipients: 0 },
        groupResubscribes: { eventCount: 0, uniqueRecipients: 0 },
        opens: { eventCount: 0, uniqueRecipients: 0 },
        machineOpens: { eventCount: 0, uniqueRecipients: 0 },
        clicks: { eventCount: 0, uniqueRecipients: 0 },
      },
      counts: {
        queued: 0, submitting: 0, accepted: 0, delivered: 0, deferred: 0,
        bounced: 0, dropped: 0, spam_report: 0, unsubscribed: 0,
        failed: 0, unknown: 0, suppressed: 0,
      },
      batches: [],
    });
  }

  const grouped = await db.select({
    campaignId: marketingCampaignRecipients.campaignId,
    status: marketingCampaignRecipients.status,
    count: sql<number>`count(*)::int`,
  })
    .from(marketingCampaignRecipients)
    .where(inArray(marketingCampaignRecipients.campaignId, ids))
    .groupBy(marketingCampaignRecipients.campaignId, marketingCampaignRecipients.status);
  for (const row of grouped) {
    const summary = summaries.get(row.campaignId);
    if (summary && row.status in summary.counts) {
      summary.counts[row.status as MarketingCampaignDeliveryStatus] = Number(row.count);
    }
  }

  const eventCategory = sql<string>`case
    when ${sendgridCampaignWebhookEvents.eventType} in ('open', 'machine_open') then 'opens'
    when ${sendgridCampaignWebhookEvents.eventType} = 'click' then 'clicks'
    when ${sendgridCampaignWebhookEvents.eventType} in ('unsubscribe', 'group_unsubscribe', 'app_unsubscribe') then 'unsubscribes'
    when ${sendgridCampaignWebhookEvents.eventType} = 'bounce' then 'bounces'
    when ${sendgridCampaignWebhookEvents.eventType} = 'spamreport' then 'spamReports'
    when ${sendgridCampaignWebhookEvents.eventType} = 'group_resubscribe' then 'groupResubscribes'
    else ${sendgridCampaignWebhookEvents.eventType}
  end`;
  const eventRows = await db.select({
    campaignId: marketingCampaignRecipients.campaignId,
    category: eventCategory,
    eventCount: sql<number>`count(*)::int`,
    uniqueRecipients: sql<number>`count(distinct ${sendgridCampaignWebhookEvents.recipientId})::int`,
  }).from(sendgridCampaignWebhookEvents)
    .innerJoin(
      marketingCampaignRecipients,
      eq(sendgridCampaignWebhookEvents.recipientId, marketingCampaignRecipients.id),
    )
    .where(inArray(marketingCampaignRecipients.campaignId, ids))
    .groupBy(marketingCampaignRecipients.campaignId, eventCategory);
  for (const row of eventRows) {
    const summary = summaries.get(row.campaignId);
    if (summary) {
      summary.eventAnalytics[row.category] = {
        eventCount: Number(row.eventCount),
        uniqueRecipients: Number(row.uniqueRecipients),
      };
    }
  }

  const machineOpenRows = await db.select({
    campaignId: marketingCampaignRecipients.campaignId,
    eventCount: sql<number>`count(*)::int`,
    uniqueRecipients: sql<number>`count(distinct ${sendgridCampaignWebhookEvents.recipientId})::int`,
  }).from(sendgridCampaignWebhookEvents)
    .innerJoin(
      marketingCampaignRecipients,
      eq(sendgridCampaignWebhookEvents.recipientId, marketingCampaignRecipients.id),
    )
    .where(and(
      inArray(marketingCampaignRecipients.campaignId, ids),
      eq(sendgridCampaignWebhookEvents.eventType, "machine_open"),
    ))
    .groupBy(marketingCampaignRecipients.campaignId);
  for (const row of machineOpenRows) {
    const summary = summaries.get(row.campaignId);
    if (summary) {
      summary.eventAnalytics.machineOpens = {
        eventCount: Number(row.eventCount),
        uniqueRecipients: Number(row.uniqueRecipients),
      };
    }
  }

  const batches = await db.select({
    id: marketingCampaignBatches.id,
    campaignId: marketingCampaignBatches.campaignId,
    batchNumber: marketingCampaignBatches.batchNumber,
    recipientCount: marketingCampaignBatches.recipientCount,
    acceptedCount: marketingCampaignBatches.acceptedCount,
    deliveredCount: marketingCampaignBatches.deliveredCount,
    failedCount: marketingCampaignBatches.failedCount,
    status: marketingCampaignBatches.status,
    startedAt: marketingCampaignBatches.startedAt,
    completedAt: marketingCampaignBatches.completedAt,
  }).from(marketingCampaignBatches)
    .where(inArray(marketingCampaignBatches.campaignId, ids))
    .orderBy(asc(marketingCampaignBatches.campaignId), asc(marketingCampaignBatches.batchNumber));
  for (const batch of batches) {
    summaries.get(batch.campaignId)?.batches.push({
      id: batch.id,
      batchNumber: batch.batchNumber,
      recipientCount: batch.recipientCount,
      acceptedCount: batch.acceptedCount,
      deliveredCount: batch.deliveredCount,
      failedCount: batch.failedCount,
      status: batch.status,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
    });
  }
  return summaries;
}

export interface SendGridCampaignEvent {
  sg_event_id?: unknown;
  event?: unknown;
  type?: unknown;
  timestamp?: unknown;
  email?: unknown;
  sg_machine_open?: unknown;
  reason?: unknown;
  custom_args?: unknown;
  customArgs?: unknown;
  unique_args?: unknown;
}

export async function processSendGridCampaignEvents(events: SendGridCampaignEvent[]): Promise<number> {
  if (!Array.isArray(events)) throw new Error("SendGrid event payload must be an array");
  let applied = 0;
  const campaignsToRefresh = new Set<number>();
  for (const event of events) {
    const eventId = typeof event.sg_event_id === "string" ? event.sg_event_id.trim() : "";
    const eventType = typeof event.event === "string" ? event.event.trim().toLowerCase() : "";
    const normalizedEvent = normalizeSendGridEvent(eventType, event.type, event.sg_machine_open);
    const email = typeof event.email === "string" ? event.email.trim().toLowerCase() : "";
    const customArgs = event.custom_args && typeof event.custom_args === "object"
      ? event.custom_args as Record<string, unknown>
      : event.customArgs && typeof event.customArgs === "object"
        ? event.customArgs as Record<string, unknown>
        : event.unique_args && typeof event.unique_args === "object"
          ? event.unique_args as Record<string, unknown>
          : {};
    const recipientId = Number(customArgs.marketing_campaign_recipient_id);
    const campaignId = Number(customArgs.marketing_campaign_id);
    if (!eventId || eventId.length > 255 || !eventType || !email
      || !Number.isSafeInteger(recipientId) || recipientId <= 0
      || !Number.isSafeInteger(campaignId) || campaignId <= 0) {
      continue;
    }

    const [recipient] = await db.select().from(marketingCampaignRecipients)
      .where(eq(marketingCampaignRecipients.id, recipientId))
      .limit(1);
    if (!recipient || recipient.campaignId !== campaignId || recipient.email.trim().toLowerCase() !== email) {
      continue;
    }

    const timestamp = Number(event.timestamp);
    const occurredAt = Number.isFinite(timestamp) && timestamp > 0 && timestamp < 4_102_444_800
      ? new Date(timestamp * 1000)
      : null;
    const result = await db.transaction(async (tx) => {
      const [currentRecipient] = await tx.select().from(marketingCampaignRecipients)
        .where(eq(marketingCampaignRecipients.id, recipient.id))
        .limit(1);
      if (!currentRecipient) return { inserted: false, applied: false, campaignId: null as number | null };

      const [storedEvent] = await tx.insert(sendgridCampaignWebhookEvents).values({
        eventId,
        recipientId: currentRecipient.id,
        eventType: normalizedEvent.storedEventType.slice(0, 32),
        occurredAt,
      }).onConflictDoNothing().returning({ id: sendgridCampaignWebhookEvents.id });
      if (!storedEvent) return { inserted: false, applied: false, campaignId: null as number | null };

      const current = currentRecipient.status as MarketingCampaignDeliveryStatus;
      const next = nextDeliveryStatus(current, normalizedEvent.deliveryEventName);
      if (!next) return { inserted: true, applied: false, campaignId: null as number | null };

      const now = new Date();
      await tx.update(marketingCampaignRecipients)
        .set({
          status: next,
          lastEvent: normalizedEvent.storedEventType.slice(0, 32),
          lastEventAt: occurredAt || now,
          deliveredAt: next === "delivered" ? (occurredAt || now) : currentRecipient.deliveredAt,
          acceptedAt: API_ACCEPTED_STATUSES.includes(next as typeof API_ACCEPTED_STATUSES[number])
            ? (currentRecipient.acceptedAt || occurredAt || now)
            : currentRecipient.acceptedAt,
          lastError: next === "bounced" ? "hard_bounce"
            : next === "spam_report" ? "spam_report"
              : next === "unsubscribed" ? "unsubscribed"
                : next === "dropped" ? "sendgrid_dropped" : currentRecipient.lastError,
          updatedAt: now,
        })
        .where(eq(marketingCampaignRecipients.id, currentRecipient.id));

      if (currentRecipient.prospectId && next === "bounced") {
        await tx.update(marketingProspects)
          .set({
            emailSuppressedAt: sql`COALESCE(${marketingProspects.emailSuppressedAt}, ${occurredAt || now})`,
            emailSuppressionReason: sql`COALESCE(${marketingProspects.emailSuppressionReason}, 'hard_bounce')`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, currentRecipient.prospectId));
      } else if (currentRecipient.prospectId && next === "spam_report") {
        await tx.update(marketingProspects)
          .set({
            emailSuppressedAt: sql`COALESCE(${marketingProspects.emailSuppressedAt}, ${occurredAt || now})`,
            emailSuppressionReason: sql`COALESCE(${marketingProspects.emailSuppressionReason}, 'spam_report')`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, currentRecipient.prospectId));
      } else if (currentRecipient.prospectId && next === "unsubscribed") {
        await tx.update(marketingProspects)
          .set({
            subscriptionStatus: "unsubscribed",
            unsubscribedAt: sql`COALESCE(${marketingProspects.unsubscribedAt}, ${occurredAt || now})`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, currentRecipient.prospectId));
      } else if (
        currentRecipient.prospectId
        && next === "dropped"
        && shouldSuppressDroppedProspect(event.reason)
      ) {
        await tx.update(marketingProspects)
          .set({
            emailSuppressedAt: sql`COALESCE(${marketingProspects.emailSuppressedAt}, ${occurredAt || now})`,
            emailSuppressionReason: sql`COALESCE(${marketingProspects.emailSuppressionReason}, 'sendgrid_dropped')`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, currentRecipient.prospectId));
      }

      return { inserted: true, applied: true, campaignId: currentRecipient.campaignId as number | null };
    });
    if (result.campaignId) campaignsToRefresh.add(result.campaignId);
    if (result.applied) applied++;
  }
  for (const campaignId of campaignsToRefresh) await refreshCampaignCounts(campaignId);
  return applied;
}
