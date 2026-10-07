import type { Express, Request, RequestHandler, Response } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  aiRecommendationCampaigns,
  type EventVoucherCampaign,
  type MarketingSegmentCriteria,
} from "@shared/schema";
import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { authenticateAdmin, canAccessMarket } from "./admin-routes";
import { getSenderForMarket, sendEmail } from "./email-service";
import { buildProspectMarketingEmail } from "./prospect-marketing-security";
import { markProspectInvitationSent } from "./prospect-marketing-db";
import { getAIMarketCatalogForMarket } from "./routes";
import { parseAIRecommendationCampaignInput } from "./ai-recommendation-campaign-validation";
import { EVENT_VOUCHER_CAMPAIGN_SLUG } from "./event-voucher";

type MarketingAdminRequest = Request & {
  adminId?: number;
  adminMarkets?: string[];
  isSuperAdmin?: boolean;
};

function isSupportedMarket(value: unknown): value is "all" | "ro" | "fr" | "com" {
  return value === "all" || value === "ro" || value === "fr" || value === "com";
}

type RecommendationMarket = "ro" | "fr" | "com";

function isRecommendationMarket(value: unknown): value is RecommendationMarket {
  return value === "ro" || value === "fr" || value === "com";
}

type RecommendationCampaign = {
  id: number;
  market: string;
  productIds: number[];
  startsAt: Date;
  endsAt: Date;
  [key: string]: unknown;
};

type NewRecommendationCampaign = {
  market: RecommendationMarket;
  productIds: number[];
  startsAt: Date;
  endsAt: Date;
  createdBy?: number;
};

type CampaignSaveResult =
  | { conflict: true }
  | { conflict: false; campaign: RecommendationCampaign };

export interface AIRecommendationCampaignRouteDependencies {
  authenticateAdmin: RequestHandler;
  canAccessMarket: (req: Request, market: string) => boolean;
  getCatalogForMarket: typeof getAIMarketCatalogForMarket;
  listCampaigns: (market: RecommendationMarket) => Promise<RecommendationCampaign[]>;
  findCampaign: (id: number) => Promise<RecommendationCampaign | undefined>;
  createCampaignIfNoOverlap: (
    campaign: NewRecommendationCampaign,
  ) => Promise<CampaignSaveResult>;
  updateCampaignIfNoOverlap: (
    id: number,
    market: RecommendationMarket,
    campaign: Pick<NewRecommendationCampaign, "productIds" | "startsAt" | "endsAt">,
  ) => Promise<CampaignSaveResult>;
  deleteCampaign: (id: number) => Promise<void>;
}

const AI_RECOMMENDATION_CAMPAIGN_LOCK_NAMESPACE = 1_927_318_462;

const defaultAIRecommendationCampaignDependencies: AIRecommendationCampaignRouteDependencies = {
  authenticateAdmin: authenticateAdmin as RequestHandler,
  canAccessMarket: canAccessMarket as (req: Request, market: string) => boolean,
  getCatalogForMarket: getAIMarketCatalogForMarket,
  listCampaigns: async (market) => db.select()
    .from(aiRecommendationCampaigns)
    .where(eq(aiRecommendationCampaigns.market, market))
    .orderBy(desc(aiRecommendationCampaigns.startsAt)),
  findCampaign: async (id) => {
    const [campaign] = await db.select().from(aiRecommendationCampaigns)
      .where(eq(aiRecommendationCampaigns.id, id))
      .limit(1);
    return campaign;
  },
  createCampaignIfNoOverlap: async (campaign) => db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      ${AI_RECOMMENDATION_CAMPAIGN_LOCK_NAMESPACE},
      hashtext(${campaign.market})
    )`);
    const [overlap] = await tx.select({ id: aiRecommendationCampaigns.id })
      .from(aiRecommendationCampaigns)
      .where(and(
        eq(aiRecommendationCampaigns.market, campaign.market),
        lt(aiRecommendationCampaigns.startsAt, campaign.endsAt),
        gt(aiRecommendationCampaigns.endsAt, campaign.startsAt),
      ))
      .limit(1);
    if (overlap) return { conflict: true };

    const [created] = await tx.insert(aiRecommendationCampaigns).values(campaign).returning();
    if (!created) throw new Error("Campaign insert returned no row");
    return { conflict: false, campaign: created };
  }),
  updateCampaignIfNoOverlap: async (id, market, campaign) => db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      ${AI_RECOMMENDATION_CAMPAIGN_LOCK_NAMESPACE},
      hashtext(${market})
    )`);
    const [overlap] = await tx.select({ id: aiRecommendationCampaigns.id })
      .from(aiRecommendationCampaigns)
      .where(and(
        eq(aiRecommendationCampaigns.market, market),
        lt(aiRecommendationCampaigns.startsAt, campaign.endsAt),
        gt(aiRecommendationCampaigns.endsAt, campaign.startsAt),
        ne(aiRecommendationCampaigns.id, id),
      ))
      .limit(1);
    if (overlap) return { conflict: true };

    const [updated] = await tx.update(aiRecommendationCampaigns)
      .set({ ...campaign, updatedAt: new Date() })
      .where(eq(aiRecommendationCampaigns.id, id))
      .returning();
    if (!updated) throw new Error("Campaign update returned no row");
    return { conflict: false, campaign: updated };
  }),
  deleteCampaign: async (id) => {
    await db.delete(aiRecommendationCampaigns).where(eq(aiRecommendationCampaigns.id, id));
  },
};

export interface MarketingEmailTestDependencies {
  authenticateAdmin: RequestHandler;
  canAccessMarket: (req: Request, market: string) => boolean;
  getCampaign: (id: number) => Promise<any>;
  getSegment: (id: number) => Promise<any>;
  getActiveOffer: () => Promise<EventVoucherCampaign | undefined>;
  loadOfferTemplate: () => Promise<string>;
  sendEmail: typeof sendEmail;
}

const defaultMarketingEmailTestDependencies: MarketingEmailTestDependencies = {
  authenticateAdmin: authenticateAdmin as RequestHandler,
  canAccessMarket: canAccessMarket as (req: Request, market: string) => boolean,
  getCampaign: (id) => storage.getMarketingCampaign(id),
  getSegment: (id) => storage.getMarketingSegment(id),
  getActiveOffer: () => storage.getEventVoucherCampaign(EVENT_VOUCHER_CAMPAIGN_SLUG),
  loadOfferTemplate: async () => readFile(path.join(
    process.cwd(),
    "attached_assets",
    "email_xhaccp_offre_20_1791405076055.html",
  ), "utf8"),
  sendEmail,
};

async function recommendationProductsBelongToMarket(
  productIds: number[],
  market: RecommendationMarket,
  getCatalogForMarket: typeof getAIMarketCatalogForMarket,
): Promise<boolean> {
  const availableProductIds = new Set(
    getCatalogForMarket(market).map((product) => String(product.id)),
  );
  return productIds.every((id) => availableProductIds.has(String(id)));
}

export function registerMarketingAdminRoutes(
  app: Express,
  campaignDependencies: AIRecommendationCampaignRouteDependencies = defaultAIRecommendationCampaignDependencies,
  emailTestDependencies: MarketingEmailTestDependencies = defaultMarketingEmailTestDependencies,
): void {
  app.get("/admin/api/marketing/event-voucher-template", emailTestDependencies.authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    if (!emailTestDependencies.canAccessMarket(req, "fr")) {
      return res.status(403).json({ message: "Access denied for this market" });
    }
    try {
      const htmlContent = await emailTestDependencies.loadOfferTemplate();
      return res.json({ htmlContent });
    } catch {
      console.error("French promotion email template could not be loaded");
      return res.status(404).json({ message: "French promotion email template not found" });
    }
  });

  app.get("/admin/api/ai-recommendation-campaigns", campaignDependencies.authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const market = String(req.query.market || "");
      if (!isRecommendationMarket(market)) {
        return res.status(400).json({ message: "Choose a valid market: ro, fr or com" });
      }
      if (!campaignDependencies.canAccessMarket(req, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const campaigns = await campaignDependencies.listCampaigns(market);
      const products = campaignDependencies.getCatalogForMarket(market).map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        featured: product.featured,
        priority: product.priority,
      }));

      res.json({ market, campaigns, products });
    } catch (error) {
      console.error("AI recommendation campaign list error:", error);
      res.status(500).json({ message: "Failed to fetch AI recommendation campaigns" });
    }
  });

  app.post("/admin/api/ai-recommendation-campaigns", campaignDependencies.authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const market = req.body?.market;
      if (!isRecommendationMarket(market)) {
        return res.status(400).json({ message: "Choose a valid market: ro, fr or com" });
      }
      if (!campaignDependencies.canAccessMarket(req, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const input = parseAIRecommendationCampaignInput(req.body);
      if ("error" in input) return res.status(400).json({ message: input.error });
      if (!(await recommendationProductsBelongToMarket(
        input.productIds,
        market,
        campaignDependencies.getCatalogForMarket,
      ))) {
        return res.status(400).json({ message: "All selected products must be active in this market" });
      }

      const result = await campaignDependencies.createCampaignIfNoOverlap({
        market,
        productIds: input.productIds,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdBy: req.adminId,
      });
      if (result.conflict) {
        return res.status(409).json({ message: "Another campaign overlaps this period for the selected market" });
      }

      res.status(201).json(result.campaign);
    } catch (error) {
      console.error("AI recommendation campaign create error:", error);
      res.status(500).json({ message: "Failed to create AI recommendation campaign" });
    }
  });

  app.put("/admin/api/ai-recommendation-campaigns/:id", campaignDependencies.authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid campaign ID" });
      }
      const existing = await campaignDependencies.findCampaign(id);
      if (!existing) return res.status(404).json({ message: "Campaign not found" });
      if (!campaignDependencies.canAccessMarket(req, existing.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (!isRecommendationMarket(existing.market)) {
        return res.status(400).json({ message: "Campaign has an invalid market" });
      }
      if (req.body?.market !== undefined && req.body.market !== existing.market) {
        return res.status(400).json({ message: "A campaign's market cannot be changed" });
      }

      const input = parseAIRecommendationCampaignInput(req.body);
      if ("error" in input) return res.status(400).json({ message: input.error });
      if (!(await recommendationProductsBelongToMarket(
        input.productIds,
        existing.market,
        campaignDependencies.getCatalogForMarket,
      ))) {
        return res.status(400).json({ message: "All selected products must be active in this market" });
      }

      const result = await campaignDependencies.updateCampaignIfNoOverlap(id, existing.market, {
        productIds: input.productIds,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
      if (result.conflict) {
        return res.status(409).json({ message: "Another campaign overlaps this period for the selected market" });
      }

      res.json(result.campaign);
    } catch (error) {
      console.error("AI recommendation campaign update error:", error);
      res.status(500).json({ message: "Failed to update AI recommendation campaign" });
    }
  });

  app.delete("/admin/api/ai-recommendation-campaigns/:id", campaignDependencies.authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid campaign ID" });
      }
      const existing = await campaignDependencies.findCampaign(id);
      if (!existing) return res.status(404).json({ message: "Campaign not found" });
      if (!campaignDependencies.canAccessMarket(req, existing.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      await campaignDependencies.deleteCampaign(id);
      res.json({ success: true });
    } catch (error) {
      console.error("AI recommendation campaign delete error:", error);
      res.status(500).json({ message: "Failed to delete AI recommendation campaign" });
    }
  });

  app.get("/admin/api/marketing/event-voucher-contacts", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      if (!canAccessMarket(req as any, "fr")) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const campaignSlug = String(req.query.campaign || "chef-event-fr");
      if (campaignSlug !== "chef-event-fr") {
        return res.status(400).json({ message: "Unsupported event voucher campaign" });
      }
      const contacts = await storage.getEventVoucherMarketingContacts(campaignSlug);
      res.json({
        campaign: campaignSlug,
        count: contacts.length,
        contacts,
      });
    } catch (error) {
      console.error("Marketing event voucher contacts error:", error);
      res.status(500).json({ message: "Failed to fetch event voucher contacts" });
    }
  });

  app.get("/admin/api/marketing/segments", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const market = String(req.query.market || "all");
      if (!isSupportedMarket(market)) return res.status(400).json({ message: "Invalid marketing market" });
      if (market !== "all" && !canAccessMarket(req as any, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      res.json(await storage.getMarketingSegments(market));
    } catch (error) {
      console.error("Marketing segments list error:", error);
      res.status(500).json({ message: "Failed to fetch marketing segments" });
    }
  });

  app.post("/admin/api/marketing/segments", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const { name, market = "all", criteria = {} } = req.body || {};
      if (!name || !isSupportedMarket(market)) {
        return res.status(400).json({ message: "Name and a valid market are required" });
      }
      if (market === "all" ? !req.isSuperAdmin : !canAccessMarket(req as any, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (criteria.eventVoucherCampaign === "chef-event-fr" && market !== "fr") {
        return res.status(400).json({ message: "Chef Event contacts belong to the France market" });
      }
      const normalizedCriteria: MarketingSegmentCriteria = {
        market,
        hasOrders: ["any", "yes", "no"].includes(criteria.hasOrders) ? criteria.hasOrders : "any",
        hasAbandonedCart: ["any", "yes", "no"].includes(criteria.hasAbandonedCart) ? criteria.hasAbandonedCart : "any",
        eventVoucherCampaign: criteria.eventVoucherCampaign === "chef-event-fr" ? "chef-event-fr" : "any",
      };
      const segment = await storage.createMarketingSegment({
        name: String(name).trim(),
        market,
        criteria: normalizedCriteria,
        createdBy: req.adminId,
      });
      res.status(201).json(segment);
    } catch (error) {
      console.error("Marketing segment create error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create segment" });
    }
  });

  app.delete("/admin/api/marketing/segments/:id", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const segment = await storage.getMarketingSegment(Number(req.params.id));
      if (!segment) return res.status(404).json({ message: "Segment not found" });
      if (segment.market === "all" ? !req.isSuperAdmin : !canAccessMarket(req as any, segment.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      await storage.deleteMarketingSegment(segment.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Marketing segment delete error:", error);
      res.status(500).json({ message: "Failed to delete segment" });
    }
  });

  app.get("/admin/api/marketing/segments/:id/recipients", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const segment = await storage.getMarketingSegment(Number(req.params.id));
      if (!segment) return res.status(404).json({ message: "Segment not found" });
      if (segment.market !== "all" && !canAccessMarket(req as any, segment.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const recipients = await storage.getMarketingRecipients(segment.criteria || { market: "all" });
      res.json({
        count: recipients.length,
        recipients: recipients.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          ...(user.source === "prospect" ? {
            restaurantName: user.restaurantName,
            city: user.city,
          } : {}),
        })),
      });
    } catch (error) {
      console.error("Marketing recipients preview error:", error);
      res.status(500).json({ message: "Failed to preview recipients" });
    }
  });

  app.get("/admin/api/marketing/campaigns", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const market = String(req.query.market || "all");
      if (!isSupportedMarket(market)) return res.status(400).json({ message: "Invalid marketing market" });
      if (market !== "all" && !canAccessMarket(req as any, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      res.json(await storage.getMarketingCampaigns(market));
    } catch (error) {
      console.error("Marketing campaigns list error:", error);
      res.status(500).json({ message: "Failed to fetch marketing campaigns" });
    }
  });

  app.post("/admin/api/marketing/campaigns", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const { name, market, segmentId, subject, htmlContent, textContent } = req.body || {};
      if (!name || !subject || !htmlContent || !segmentId || !isSupportedMarket(market) || market === "all") {
        return res.status(400).json({ message: "Campaign name, market, segment, subject and HTML content are required" });
      }
      if (!canAccessMarket(req as any, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const segment = await storage.getMarketingSegment(Number(segmentId));
      if (!segment || (segment.market !== "all" && segment.market !== market)) {
        return res.status(400).json({ message: "Segment does not match the campaign market" });
      }
      const campaign = await storage.createMarketingCampaign({
        name: String(name).trim(),
        market,
        segmentId: Number(segmentId),
        subject: String(subject).trim(),
        htmlContent: String(htmlContent),
        textContent: textContent ? String(textContent) : null,
        status: "draft",
        createdBy: req.adminId,
      });
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Marketing campaign create error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create campaign" });
    }
  });

  app.post("/admin/api/marketing/campaigns/:id/send", authenticateAdmin, async (req: MarketingAdminRequest, res: Response) => {
    try {
      const campaign = await storage.getMarketingCampaign(Number(req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (!canAccessMarket(req as any, campaign.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (campaign.status === "sent" || campaign.status === "sending") {
        return res.status(409).json({ message: "Campaign has already been sent or is currently sending" });
      }
      const segment = campaign.segmentId ? await storage.getMarketingSegment(campaign.segmentId) : undefined;
      if (!segment) return res.status(400).json({ message: "Campaign segment no longer exists" });

      const criteria = segment.criteria || { market: campaign.market as any };
      const prospectAudience = criteria.prospectAudience;
      const hasOfferTokens = /\{\{\s*(offer_name|discount_display|discount_value|discount_type|valid_months|activation_days|offer_terms)\s*\}\}/i
        .test(`${campaign.htmlContent}\n${campaign.textContent || ""}`);
      const requiresOffer = prospectAudience === "invitation" || hasOfferTokens;
      if (hasOfferTokens && prospectAudience !== "invitation" && prospectAudience !== "newsletter") {
        return res.status(400).json({ message: "Promotion templates require a French prospect segment" });
      }
      if (prospectAudience && campaign.market !== "fr") {
        return res.status(400).json({ message: "Prospect campaigns are available only for the France market" });
      }
      if (requiresOffer && campaign.market !== "fr") {
        return res.status(400).json({ message: "Promotion templates are available only for the France market" });
      }
      const activeOffer = requiresOffer
        ? await storage.getEventVoucherCampaign(EVENT_VOUCHER_CAMPAIGN_SLUG)
        : undefined;
      if (requiresOffer && !activeOffer) {
        return res.status(409).json({ message: "No active French offer is configured for this invitation campaign" });
      }
      const recipients = await storage.getMarketingRecipients(criteria);
      if (recipients.length === 0) {
        return res.status(400).json({ message: "There are no eligible recipients in this segment" });
      }
      await storage.updateMarketingCampaign(campaign.id, {
        status: "sending",
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
      });

      let sentCount = 0;
      let failedCount = 0;
      if (prospectAudience === "invitation" || prospectAudience === "newsletter") {
        for (let offset = 0; offset < recipients.length; offset += 10) {
          const batch = recipients.slice(offset, offset + 10);
          const results = await Promise.all(batch.map(async (recipient) => {
            if (!recipient.prospectId) return false;
            try {
              const personalized = buildProspectMarketingEmail({
                htmlContent: campaign.htmlContent,
                textContent: campaign.textContent,
                recipient: {
                  prospectId: recipient.prospectId,
                  restaurantName: recipient.restaurantName,
                  city: recipient.city,
                },
                audience: prospectAudience,
                offer: activeOffer,
              });
              const sent = await sendEmail({
                to: recipient.email,
                from: getSenderForMarket("fr"),
                subject: campaign.subject,
                html: personalized.html,
                text: personalized.text,
                headers: personalized.headers,
                suppressRecipientLog: true,
              });
              if (sent && prospectAudience === "invitation") {
                try {
                  await markProspectInvitationSent(recipient.prospectId);
                } catch {
                  console.error("Could not save prospect invitation delivery state");
                }
              }
              return sent;
            } catch {
              console.error("Prospect marketing email could not be prepared");
              return false;
            }
          }));
          sentCount += results.filter(Boolean).length;
          failedCount += results.filter((sent) => !sent).length;
        }
      } else {
        for (const recipient of recipients) {
          const sent = await sendEmail({
            to: recipient.email,
            from: getSenderForMarket(campaign.market),
            subject: campaign.subject,
            html: campaign.htmlContent,
            text: campaign.textContent || campaign.subject,
          });
          if (sent) sentCount++;
          else failedCount++;
        }
      }

      const updated = await storage.updateMarketingCampaign(campaign.id, {
        status: failedCount > 0 && sentCount === 0 ? "failed" : "sent",
        recipientCount: recipients.length,
        sentCount,
        failedCount,
        sentAt: new Date(),
      });
      res.json({ campaign: updated, sentCount, failedCount });
    } catch (error) {
      console.error("Marketing campaign send error:", error);
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  app.post(
    "/admin/api/marketing/campaigns/:id/test",
    emailTestDependencies.authenticateAdmin,
    async (req: MarketingAdminRequest, res: Response) => {
      try {
        const campaignId = Number(req.params.id);
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
          return res.status(400).json({ message: "Campaign id is invalid" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return res.status(400).json({ message: "Enter one valid email address for the test" });
        }

        const campaign = await emailTestDependencies.getCampaign(campaignId);
        if (!campaign) return res.status(404).json({ message: "Campaign not found" });
        if (!emailTestDependencies.canAccessMarket(req, campaign.market)) {
          return res.status(403).json({ message: "Access denied for this market" });
        }
        if (campaign.status === "sent" || campaign.status === "sending") {
          return res.status(409).json({ message: "Only unsent campaigns can be tested" });
        }

        const segment = campaign.segmentId
          ? await emailTestDependencies.getSegment(campaign.segmentId)
          : undefined;
        if (!segment) return res.status(400).json({ message: "Campaign segment no longer exists" });
        const audience = segment.criteria?.prospectAudience;
        const hasOfferTokens = /\{\{\s*(offer_name|discount_display|discount_value|discount_type|valid_months|activation_days|offer_terms)\s*\}\}/i
          .test(`${campaign.htmlContent}\n${campaign.textContent || ""}`);
        const requiresOffer = audience === "invitation" || hasOfferTokens;
        if (hasOfferTokens && audience !== "invitation" && audience !== "newsletter") {
          return res.status(400).json({ message: "Promotion templates require a French prospect segment" });
        }
        if (audience && campaign.market !== "fr") {
          return res.status(400).json({ message: "Prospect campaigns are available only for the France market" });
        }
        if (requiresOffer && campaign.market !== "fr") {
          return res.status(400).json({ message: "Promotion templates are available only for the France market" });
        }
        const offer = requiresOffer
          ? await emailTestDependencies.getActiveOffer()
          : undefined;
        if (requiresOffer && !offer) {
          return res.status(409).json({ message: "No active French offer is configured for this invitation campaign" });
        }

        const personalized = audience === "invitation" || audience === "newsletter"
          ? buildProspectMarketingEmail({
              htmlContent: campaign.htmlContent,
              textContent: campaign.textContent,
              audience,
              offer,
              testMode: true,
            })
          : {
              html: `<div style="padding:10px 14px;background:#fff4cc;color:#7c4a03;font:14px Arial,sans-serif;text-align:center">Email de test uniquement — aucun abonnement ni statut de destinataire n'a été modifié.</div>${campaign.htmlContent}`,
              text: `EMAIL DE TEST — aucun abonnement ni statut de destinataire n'a été modifié.\n\n${campaign.textContent || campaign.subject}`,
              headers: {},
            };
        const sent = await emailTestDependencies.sendEmail({
          to: email,
          from: getSenderForMarket(campaign.market),
          subject: `[TEST] ${campaign.subject}`,
          html: personalized.html,
          text: personalized.text,
          headers: personalized.headers,
          suppressRecipientLog: true,
        });
        if (!sent) return res.status(502).json({ message: "Test email could not be sent" });
        return res.json({ success: true, sentTo: email });
      } catch {
        console.error("Marketing campaign test email failed");
        return res.status(500).json({ message: "Failed to send campaign test email" });
      }
    },
  );
}