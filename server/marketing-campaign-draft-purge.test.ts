import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { inArray } from "drizzle-orm";
import {
  marketingCampaignBatches,
  marketingCampaignRecipients,
  marketingCampaigns,
  sendgridCampaignWebhookEvents,
} from "@shared/schema";
import { db } from "./db";
import { MARKETING_CAMPAIGN_DRAFT_RETENTION_DAYS, storage } from "./storage";

test("expired draft purge preserves active recovery drafts and all sent campaign delivery history", async () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  const retentionMs = MARKETING_CAMPAIGN_DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expiredAt = new Date(now.getTime() - retentionMs);
  const activeDeletedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fixtureKey = randomUUID();
  const campaignIds: number[] = [];
  const webhookEventIds: string[] = [];

  try {
    const createdCampaigns = await db.insert(marketingCampaigns).values([
      {
        name: `Purge test expired draft ${fixtureKey}`,
        market: "fr",
        subject: "Expired draft",
        htmlContent: "<p>Expired draft</p>",
        status: "draft",
        deletedAt: expiredAt,
      },
      {
        name: `Purge test active recovery draft ${fixtureKey}`,
        market: "fr",
        subject: "Recoverable draft",
        htmlContent: "<p>Recoverable draft</p>",
        status: "draft",
        deletedAt: activeDeletedAt,
      },
      ...(["sent", "sending", "partial", "failed"] as const).map((status) => ({
        name: `Purge test ${status} campaign ${fixtureKey}`,
        market: "fr",
        subject: `${status} campaign`,
        htmlContent: `<p>${status} campaign</p>`,
        status,
        deletedAt: expiredAt,
      })),
    ]).returning({ id: marketingCampaigns.id, status: marketingCampaigns.status });
    campaignIds.push(...createdCampaigns.map(({ id }) => id));

    const expiredDraft = createdCampaigns.find(({ status }, index) => index === 0 && status === "draft");
    const activeDraft = createdCampaigns.find(({ status }, index) => index === 1 && status === "draft");
    assert.ok(expiredDraft);
    assert.ok(activeDraft);
    const historicalCampaigns = createdCampaigns.slice(2);
    assert.deepEqual(historicalCampaigns.map(({ status }) => status), ["sent", "sending", "partial", "failed"]);

    const deliveryFixtureIds: Array<{
      campaignId: number;
      batchId: number;
      recipientId: number;
      eventId: string;
    }> = [];
    for (const [index, campaign] of historicalCampaigns.entries()) {
      const [batch] = await db.insert(marketingCampaignBatches).values({
        campaignId: campaign.id,
        batchNumber: 1,
        recipientCount: 1,
        acceptedCount: 1,
        deliveredCount: 1,
        status: "completed",
      }).returning({ id: marketingCampaignBatches.id });
      const [recipient] = await db.insert(marketingCampaignRecipients).values({
        campaignId: campaign.id,
        batchId: batch.id,
        email: `purge-${fixtureKey}-${index}@example.invalid`,
        status: "delivered",
        acceptedAt: now,
        deliveredAt: now,
      }).returning({ id: marketingCampaignRecipients.id });
      const eventId = `purge-test-${fixtureKey}-${index}`;
      webhookEventIds.push(eventId);
      await db.insert(sendgridCampaignWebhookEvents).values({
        eventId,
        recipientId: recipient.id,
        eventType: "delivered",
        occurredAt: now,
      });
      deliveryFixtureIds.push({
        campaignId: campaign.id,
        batchId: batch.id,
        recipientId: recipient.id,
        eventId,
      });
    }

    assert.equal(await storage.purgeExpiredMarketingCampaignDrafts(now), 1);

    const recoveryDraft = await storage.getMarketingCampaignDraftInRecovery(activeDraft.id, now);
    assert.ok(recoveryDraft, "an unexpired deleted draft remains available for recovery");
    assert.equal(await storage.restoreMarketingCampaignDraft(activeDraft.id, now), true);
    assert.ok(await storage.getMarketingCampaign(activeDraft.id), "the active draft can be restored");

    const remainingCampaigns = await db.select({
      id: marketingCampaigns.id,
      status: marketingCampaigns.status,
    }).from(marketingCampaigns).where(inArray(marketingCampaigns.id, campaignIds));
    assert.deepEqual(
      remainingCampaigns.map(({ status }) => status).sort(),
      ["draft", "failed", "partial", "sending", "sent"],
    );
    assert.ok(!remainingCampaigns.some(({ id }) => id === expiredDraft.id), "the expired deleted draft is purged");

    const remainingBatches = await db.select().from(marketingCampaignBatches)
      .where(inArray(marketingCampaignBatches.id, deliveryFixtureIds.map(({ batchId }) => batchId)));
    const remainingRecipients = await db.select().from(marketingCampaignRecipients)
      .where(inArray(marketingCampaignRecipients.id, deliveryFixtureIds.map(({ recipientId }) => recipientId)));
    const remainingEvents = await db.select().from(sendgridCampaignWebhookEvents)
      .where(inArray(sendgridCampaignWebhookEvents.eventId, webhookEventIds));

    assert.equal(remainingBatches.length, 4, "each non-draft campaign batch remains intact");
    assert.equal(remainingRecipients.length, 4, "each delivery recipient record remains intact");
    assert.equal(remainingEvents.length, 4, "each SendGrid delivery event remains intact");
    assert.ok(remainingEvents.every((event) => event.recipientId !== null));
  } finally {
    if (webhookEventIds.length > 0) {
      await db.delete(sendgridCampaignWebhookEvents)
        .where(inArray(sendgridCampaignWebhookEvents.eventId, webhookEventIds));
    }
    if (campaignIds.length > 0) {
      await db.delete(marketingCampaigns).where(inArray(marketingCampaigns.id, campaignIds));
    }
  }
});
