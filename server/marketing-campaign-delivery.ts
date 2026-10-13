import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { PoolClient } from "pg";
import {
  marketingCampaignBatches,
  marketingCampaignRecipients,
  marketingCampaigns,
  marketingProspectListContacts,
  marketingProspects,
  sendgridCampaignHistoryImports,
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
  extractCampaignEventCorrelation,
  normalizeSendGridEvent,
  nextDeliveryStatus,
  shouldSuppressDroppedProspect,
  splitIntoBatches,
  type MarketingCampaignDeliveryStatus,
} from "./marketing-campaign-delivery-policy";
import {
  fetchSendGridCampaignHistory,
  type SendGridCampaignHistoryProgress,
  type SendGridHistoryEvent,
} from "./sendgrid-campaign-history";

const SEND_CONCURRENCY = 10;
const CAMPAIGN_LOCK_NAMESPACE = 1_927_318_421;
const SENDGRID_HISTORY_LOCK_NAMESPACE = 1_927_318_422;
const campaignRuns = new Set<number>();
export const SENDGRID_CAMPAIGN_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const SENDGRID_HISTORY_INDEXING_DELAY_MS = 2 * 60 * 1_000;
const SENDGRID_HISTORY_RETRY_DELAY_MS = 15 * 60 * 1_000;
const SENDGRID_HISTORY_STALE_JOB_MS = 3 * 60 * 1_000;

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
  applicationEventAnalytics: Record<string, { eventCount: number; uniqueRecipients: number }>;
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
    if (campaign.deletedAt) throw new Error("A deleted campaign draft cannot be sent");
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

  const scanHistoryImports = async () => {
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    try {
      lockClient = await pool.connect();
      const lockResult = await lockClient.query(
        "SELECT pg_try_advisory_lock($1, $2) AS locked",
        [SENDGRID_HISTORY_LOCK_NAMESPACE, 0],
      );
      lockAcquired = Boolean(lockResult.rows?.[0]?.locked);
      if (!lockAcquired) return;

      const now = Date.now();
      const campaigns = await db.select({
        id: marketingCampaigns.id,
        sentAt: marketingCampaigns.sentAt,
      }).from(marketingCampaigns)
        .where(and(
          inArray(marketingCampaigns.status, ["sent", "partial"]),
          gte(marketingCampaigns.sentAt, new Date(now - SENDGRID_CAMPAIGN_HISTORY_RETENTION_MS)),
          lt(marketingCampaigns.sentAt, new Date(now - SENDGRID_HISTORY_INDEXING_DELAY_MS)),
          sql`exists (
            select 1 from marketing_campaign_recipients
            where marketing_campaign_recipients.campaign_id = ${marketingCampaigns.id}
              and marketing_campaign_recipients.attempted_at is not null
          )`,
        ))
        .orderBy(asc(marketingCampaigns.sentAt));
      if (!campaigns.length) return;

      const jobs = await getSendGridCampaignHistoryImports(campaigns.map(({ id }) => id));
      let activeJobs = [...jobs.values()].filter((job) => (
        job.status === "running" && now - job.updatedAt.getTime() < SENDGRID_HISTORY_STALE_JOB_MS
      )).length;
      for (const campaign of campaigns) {
        const job = jobs.get(campaign.id);
        const age = job ? now - job.updatedAt.getTime() : Number.POSITIVE_INFINITY;
        const shouldStart = !job
          || (job.status === "failed" && age >= SENDGRID_HISTORY_RETRY_DELAY_MS)
          || (job.status === "running" && age >= SENDGRID_HISTORY_STALE_JOB_MS);
        if (!shouldStart || activeJobs >= 3) continue;
        try {
          const result = await startSendGridCampaignHistoryImport(campaign.id);
          if (result.started) activeJobs++;
        } catch (error) {
          console.error("Automatic SendGrid campaign history recovery could not start", {
            campaignId: campaign.id,
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    } catch (error) {
      console.error("Automatic SendGrid campaign history scan failed:", error instanceof Error ? error.message : "unknown");
    } finally {
      if (lockAcquired) {
        try {
          await lockClient?.query(
            "SELECT pg_advisory_unlock($1, $2)",
            [SENDGRID_HISTORY_LOCK_NAMESPACE, 0],
          );
        } catch {
          // Connection loss also releases the session-level advisory lock.
        }
      }
      lockClient?.release();
    }
  };
  void scanHistoryImports();
  const historyTimer = setInterval(() => void scanHistoryImports(), 60_000);
  historyTimer.unref?.();
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
        xhaccp_campaign_id: String(campaign.id),
        xhaccp_campaign_recipient_id: String(recipient.id),
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
          xhaccp_campaign_id: String(campaign.id),
          xhaccp_campaign_recipient_id: String(recipient.id),
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
    failed: sql<number>`count(*) filter (where ${marketingCampaignRecipients.status} in ('failed', 'unknown', 'bounced', 'dropped', 'spam_report'))::int`,
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
        eventSource: "application",
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
      applicationEventAnalytics: {
        unsubscribes: { eventCount: 0, uniqueRecipients: 0 },
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
    when ${sendgridCampaignWebhookEvents.eventType} = 'open' then 'opens'
    when ${sendgridCampaignWebhookEvents.eventType} = 'click' then 'clicks'
    when ${sendgridCampaignWebhookEvents.eventType} in ('unsubscribe', 'group_unsubscribe', 'app_unsubscribe') then 'unsubscribes'
    when ${sendgridCampaignWebhookEvents.eventType} = 'bounce' then 'bounces'
    when ${sendgridCampaignWebhookEvents.eventType} = 'spamreport' then 'spamReports'
    when ${sendgridCampaignWebhookEvents.eventType} = 'group_resubscribe' then 'groupResubscribes'
    else ${sendgridCampaignWebhookEvents.eventType}
  end`;
  const eventRows = await db.select({
    campaignId: marketingCampaignRecipients.campaignId,
    analyticsSource: sql<string>`case
      when ${sendgridCampaignWebhookEvents.eventSource} = 'application' then 'application'
      else 'provider'
    end`,
    category: eventCategory,
    eventCount: sql<number>`count(*)::int`,
    uniqueRecipients: sql<number>`count(distinct ${sendgridCampaignWebhookEvents.recipientId})::int`,
  }).from(sendgridCampaignWebhookEvents)
    .innerJoin(
      marketingCampaignRecipients,
      eq(sendgridCampaignWebhookEvents.recipientId, marketingCampaignRecipients.id),
    )
    .where(inArray(marketingCampaignRecipients.campaignId, ids))
    .groupBy(sql.raw("1"), sql.raw("2"), sql.raw("3"));
  for (const row of eventRows) {
    const summary = summaries.get(row.campaignId);
    if (summary) {
      const analytics = row.analyticsSource === "application"
        ? summary.applicationEventAnalytics
        : summary.eventAnalytics;
      analytics[row.category] = {
        eventCount: Number(row.eventCount),
        uniqueRecipients: Number(row.uniqueRecipients),
      };
    }
  }

  const machineOpenRows = await db.select({
    campaignId: marketingCampaignRecipients.campaignId,
    analyticsSource: sql<string>`case
      when ${sendgridCampaignWebhookEvents.eventSource} = 'application' then 'application'
      else 'provider'
    end`,
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
    .groupBy(
      marketingCampaignRecipients.campaignId,
      sql`case
        when ${sendgridCampaignWebhookEvents.eventSource} = 'application' then 'application'
        else 'provider'
      end`,
    );
  for (const row of machineOpenRows) {
    const summary = summaries.get(row.campaignId);
    if (summary) {
      const analytics = row.analyticsSource === "application"
        ? summary.applicationEventAnalytics
        : summary.eventAnalytics;
      analytics.machineOpens = {
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

export interface SendGridCampaignHistoryImportJob {
  campaignId: number;
  status: string;
  providerMessageCount: number;
  processedMessageCount: number;
  matchedMessageCount: number;
  unmatchedMessageCount: number;
  importedEventCount: number;
  skippedEventCount: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

export async function getSendGridCampaignHistoryImport(
  campaignId: number,
): Promise<SendGridCampaignHistoryImportJob | null> {
  const [job] = await db.select({
    campaignId: sendgridCampaignHistoryImports.campaignId,
    status: sendgridCampaignHistoryImports.status,
    providerMessageCount: sendgridCampaignHistoryImports.providerMessageCount,
    processedMessageCount: sendgridCampaignHistoryImports.processedMessageCount,
    matchedMessageCount: sendgridCampaignHistoryImports.matchedMessageCount,
    unmatchedMessageCount: sendgridCampaignHistoryImports.unmatchedMessageCount,
    importedEventCount: sendgridCampaignHistoryImports.importedEventCount,
    skippedEventCount: sendgridCampaignHistoryImports.skippedEventCount,
    errorMessage: sendgridCampaignHistoryImports.errorMessage,
    startedAt: sendgridCampaignHistoryImports.startedAt,
    completedAt: sendgridCampaignHistoryImports.completedAt,
    updatedAt: sendgridCampaignHistoryImports.updatedAt,
  }).from(sendgridCampaignHistoryImports)
    .where(eq(sendgridCampaignHistoryImports.campaignId, campaignId))
    .limit(1);
  return job || null;
}

export async function getSendGridCampaignHistoryImports(
  campaignIds: number[],
): Promise<Map<number, SendGridCampaignHistoryImportJob>> {
  if (!campaignIds.length) return new Map();
  const jobs = await db.select({
    campaignId: sendgridCampaignHistoryImports.campaignId,
    status: sendgridCampaignHistoryImports.status,
    providerMessageCount: sendgridCampaignHistoryImports.providerMessageCount,
    processedMessageCount: sendgridCampaignHistoryImports.processedMessageCount,
    matchedMessageCount: sendgridCampaignHistoryImports.matchedMessageCount,
    unmatchedMessageCount: sendgridCampaignHistoryImports.unmatchedMessageCount,
    importedEventCount: sendgridCampaignHistoryImports.importedEventCount,
    skippedEventCount: sendgridCampaignHistoryImports.skippedEventCount,
    errorMessage: sendgridCampaignHistoryImports.errorMessage,
    startedAt: sendgridCampaignHistoryImports.startedAt,
    completedAt: sendgridCampaignHistoryImports.completedAt,
    updatedAt: sendgridCampaignHistoryImports.updatedAt,
  }).from(sendgridCampaignHistoryImports)
    .where(inArray(sendgridCampaignHistoryImports.campaignId, campaignIds));
  return new Map(jobs.map((job) => [job.campaignId, job]));
}

function safeSendGridHistoryImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("access denied")) {
    return "SendGrid Email Logs access was denied. The API key needs permission to read Email Logs.";
  }
  if (message === "SendGrid API key is not configured") {
    return "SendGrid history import is not configured on this server.";
  }
  return "SendGrid campaign history could not be imported. Retry the import.";
}

async function persistHistoricalCampaignEvents(events: SendGridHistoryEvent[]): Promise<void> {
  for (let offset = 0; offset < events.length; offset += 250) {
    const batch = events.slice(offset, offset + 250).map((event) => ({
      eventId: event.eventId,
      recipientId: event.recipientId,
      eventType: event.eventType.slice(0, 32),
      eventSource: "historical_import",
      occurredAt: event.occurredAt,
    }));
    await db.insert(sendgridCampaignWebhookEvents)
      .values(batch)
      .onConflictDoUpdate({
        target: sendgridCampaignWebhookEvents.eventId,
        set: {
          eventSource: sql`CASE
            WHEN EXCLUDED.event_source = 'webhook' THEN 'webhook'
            WHEN ${sendgridCampaignWebhookEvents.eventSource} = 'webhook' THEN 'webhook'
            ELSE EXCLUDED.event_source
          END`,
        },
      });
  }

  const recipientIds = [...new Set(events.map((event) => event.recipientId))];
  if (!recipientIds.length) return;
  const eventsByRecipient = new Map<number, SendGridHistoryEvent[]>();
  for (const event of events) {
    const recipientEvents = eventsByRecipient.get(event.recipientId) || [];
    recipientEvents.push(event);
    eventsByRecipient.set(event.recipientId, recipientEvents);
  }
  const batchesToRefresh = new Set<number>();

  for (const recipientId of recipientIds) {
    const recipientEvents = (eventsByRecipient.get(recipientId) || [])
      .sort((left, right) => (left.occurredAt?.getTime() || 0) - (right.occurredAt?.getTime() || 0));

    const batchId = await db.transaction(async (tx) => {
      const [recipient] = await tx.select().from(marketingCampaignRecipients)
        .where(eq(marketingCampaignRecipients.id, recipientId))
        .for("update")
        .limit(1);
      if (!recipient) return null;
      let status = recipient.status as MarketingCampaignDeliveryStatus;
      let deliveredAt = recipient.deliveredAt;
      let lastEvent = recipient.lastEvent;
      let lastEventAt = recipient.lastEventAt;
      let lastError = recipient.lastError;
      let changed = false;

      for (const event of recipientEvents) {
        const deliveryEventName = event.eventType === "blocked" ? "deferred"
          : event.eventType === "app_unsubscribe" ? "unsubscribe"
            : event.eventType;
        const next = nextDeliveryStatus(status, deliveryEventName);
        if (!next) continue;
        status = next;
        lastEvent = event.eventType;
        lastEventAt = event.occurredAt || new Date();
        if (next === "delivered") deliveredAt = event.occurredAt || new Date();
        if (next === "bounced") lastError = "hard_bounce";
        else if (next === "spam_report") lastError = "spam_report";
        else if (next === "unsubscribed") lastError = "unsubscribed";
        else if (next === "dropped") lastError = "sendgrid_dropped";
        changed = true;
      }
      if (!changed) return null;

      const now = new Date();
      await tx.update(marketingCampaignRecipients)
        .set({
          status,
          deliveredAt,
          lastEvent,
          lastEventAt,
          lastError,
          updatedAt: now,
        })
        .where(eq(marketingCampaignRecipients.id, recipient.id));
      if (recipient.prospectId && status === "bounced") {
        await tx.update(marketingProspects)
          .set({
            emailSuppressedAt: sql`COALESCE(${marketingProspects.emailSuppressedAt}, ${now})`,
            emailSuppressionReason: sql`COALESCE(${marketingProspects.emailSuppressionReason}, 'hard_bounce')`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, recipient.prospectId));
      } else if (recipient.prospectId && status === "spam_report") {
        await tx.update(marketingProspects)
          .set({
            emailSuppressedAt: sql`COALESCE(${marketingProspects.emailSuppressedAt}, ${now})`,
            emailSuppressionReason: sql`COALESCE(${marketingProspects.emailSuppressionReason}, 'spam_report')`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, recipient.prospectId));
      } else if (recipient.prospectId && status === "unsubscribed") {
        await tx.update(marketingProspects)
          .set({
            subscriptionStatus: "unsubscribed",
            unsubscribedAt: sql`COALESCE(${marketingProspects.unsubscribedAt}, ${now})`,
            updatedAt: now,
          })
          .where(eq(marketingProspects.id, recipient.prospectId));
        await tx.delete(marketingProspectListContacts)
          .where(eq(marketingProspectListContacts.prospectId, recipient.prospectId));
      }
      return recipient.batchId;
    });
    if (batchId) batchesToRefresh.add(batchId);
  }

  for (const batchId of batchesToRefresh) await refreshBatchCounts(batchId);
}

async function importSendGridCampaignHistory(
  campaignId: number,
  callbacks: {
    onMessagesFound: (count: number) => Promise<void>;
    onProgress: (progress: SendGridCampaignHistoryProgress) => Promise<void>;
  },
): Promise<{
  providerMessages: number;
  matchedMessages: number;
  unmatchedMessages: number;
  providerEvents: number;
  skippedEvents: number;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SendGrid API key is not configured");

  const [campaign] = await db.select({
    id: marketingCampaigns.id,
    status: marketingCampaigns.status,
    subject: marketingCampaigns.subject,
  }).from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "sent" && campaign.status !== "partial") {
    throw new Error("Campaign history is available only after sending");
  }

  const recipients = await db.select({
    id: marketingCampaignRecipients.id,
    email: marketingCampaignRecipients.email,
    attemptedAt: marketingCampaignRecipients.attemptedAt,
    acceptedAt: marketingCampaignRecipients.acceptedAt,
  }).from(marketingCampaignRecipients)
    .where(eq(marketingCampaignRecipients.campaignId, campaignId));
  const attemptedRecipients = recipients.filter((recipient) => recipient.attemptedAt);
  if (!attemptedRecipients.length) {
    return {
      providerMessages: 0,
      matchedMessages: 0,
      unmatchedMessages: 0,
      providerEvents: 0,
      skippedEvents: 0,
    };
  }

  const firstAttempt = attemptedRecipients.reduce((first, recipient) => (
    recipient.attemptedAt! < first ? recipient.attemptedAt! : first
  ), attemptedRecipients[0].attemptedAt!);
  const lastAttempt = attemptedRecipients.reduce((last, recipient) => {
    const latest = recipient.acceptedAt || recipient.attemptedAt!;
    return latest > last ? latest : last;
  }, attemptedRecipients[0].acceptedAt || attemptedRecipients[0].attemptedAt!);
  const from = new Date(firstAttempt.getTime() - 60_000);
  const to = new Date(lastAttempt.getTime() + 5 * 60_000);

  const result = await fetchSendGridCampaignHistory({
    apiKey,
    campaignId,
    subject: campaign.subject,
    from,
    to,
    recipients: recipients.map(({ id, email }) => ({ id, email })),
    onMessagesFound: callbacks.onMessagesFound,
    onProgress: callbacks.onProgress,
  });

  return {
    providerMessages: result.providerMessages,
    matchedMessages: result.matchedMessages,
    unmatchedMessages: result.unmatchedMessages,
    providerEvents: result.events.length,
    skippedEvents: result.skippedEvents,
  };
}

async function runSendGridCampaignHistoryImport(
  campaignId: number,
  lockClient: PoolClient,
): Promise<void> {
  const updateJob = async (
    values: Partial<typeof sendgridCampaignHistoryImports.$inferInsert>,
  ) => {
    await db.update(sendgridCampaignHistoryImports)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sendgridCampaignHistoryImports.campaignId, campaignId));
  };

  try {
    const result = await importSendGridCampaignHistory(campaignId, {
      onMessagesFound: async (count) => {
        await updateJob({
          providerMessageCount: count,
          processedMessageCount: 0,
          matchedMessageCount: 0,
          unmatchedMessageCount: 0,
        });
      },
      onProgress: async (progress) => {
        await persistHistoricalCampaignEvents(progress.newEvents);
        await updateJob({
          processedMessageCount: progress.processedMessages,
          matchedMessageCount: progress.matchedMessages,
          unmatchedMessageCount: progress.unmatchedMessages,
          importedEventCount: progress.eventCount,
        });
      },
    });
    await updateJob({
      status: "completed",
      providerMessageCount: result.providerMessages,
      processedMessageCount: result.providerMessages,
      matchedMessageCount: result.matchedMessages,
      unmatchedMessageCount: result.unmatchedMessages,
      importedEventCount: result.providerEvents,
      skippedEventCount: result.skippedEvents,
      errorMessage: null,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error("SendGrid campaign history import failed", { campaignId });
    await updateJob({
      status: "failed",
      errorMessage: safeSendGridHistoryImportError(error),
      completedAt: new Date(),
    });
  } finally {
    try {
      await lockClient.query(
        "SELECT pg_advisory_unlock($1, $2)",
        [SENDGRID_HISTORY_LOCK_NAMESPACE, campaignId],
      );
    } catch {
      // Connection loss also releases the session-level advisory lock.
    }
    lockClient.release();
  }
}

export async function startSendGridCampaignHistoryImport(campaignId: number): Promise<{
  started: boolean;
  job: SendGridCampaignHistoryImportJob | null;
}> {
  const [campaign] = await db.select({
    status: marketingCampaigns.status,
  }).from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "sent" && campaign.status !== "partial") {
    throw new Error("Campaign history is available only after sending");
  }

  const lockClient = await pool.connect();
  let lockAcquired = false;
  let clientReleased = false;
  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [SENDGRID_HISTORY_LOCK_NAMESPACE, campaignId],
    );
    lockAcquired = Boolean(lockResult.rows[0]?.acquired);
    if (!lockAcquired) {
      lockClient.release();
      clientReleased = true;
      return { started: false, job: await getSendGridCampaignHistoryImport(campaignId) };
    }

    await db.insert(sendgridCampaignHistoryImports).values({
      campaignId,
      status: "running",
      providerMessageCount: 0,
      processedMessageCount: 0,
      matchedMessageCount: 0,
      unmatchedMessageCount: 0,
      importedEventCount: 0,
      skippedEventCount: 0,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: sendgridCampaignHistoryImports.campaignId,
      set: {
        status: "running",
        providerMessageCount: 0,
        processedMessageCount: 0,
        matchedMessageCount: 0,
        unmatchedMessageCount: 0,
        importedEventCount: 0,
        skippedEventCount: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        updatedAt: new Date(),
      },
    });
    const job = await getSendGridCampaignHistoryImport(campaignId);
    void runSendGridCampaignHistoryImport(campaignId, lockClient).catch(() => {
      console.error("Could not save SendGrid campaign history import status", { campaignId });
    });
    lockAcquired = false;
    return { started: true, job };
  } catch (error) {
    if (lockAcquired) {
      try {
        await lockClient.query(
          "SELECT pg_advisory_unlock($1, $2)",
          [SENDGRID_HISTORY_LOCK_NAMESPACE, campaignId],
        );
      } catch {
        // Connection loss also releases the session-level advisory lock.
      }
    }
    if (!clientReleased) lockClient.release();
    throw error;
  }
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
    const { recipientId, campaignId } = extractCampaignEventCorrelation(event);
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
        eventSource: "webhook",
        occurredAt,
      }).onConflictDoNothing().returning({ id: sendgridCampaignWebhookEvents.id });
      if (!storedEvent) {
        await tx.update(sendgridCampaignWebhookEvents)
          .set({ eventSource: "webhook" })
          .where(and(
            eq(sendgridCampaignWebhookEvents.eventId, eventId),
            eq(sendgridCampaignWebhookEvents.recipientId, currentRecipient.id),
          ));
        return { inserted: false, applied: false, campaignId: null as number | null };
      }

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
        await tx.delete(marketingProspectListContacts)
          .where(eq(marketingProspectListContacts.prospectId, currentRecipient.prospectId));
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
