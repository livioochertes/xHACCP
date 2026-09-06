import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authenticateAdmin, canAccessMarket } from "./admin-routes";
import { getSenderForMarket, sendEmail } from "./email-service";

type MarketingAdminRequest = Request & {
  adminId?: number;
  adminMarkets?: string[];
  isSuperAdmin?: boolean;
};

function isSupportedMarket(value: unknown): value is "all" | "ro" | "fr" | "com" {
  return value === "all" || value === "ro" || value === "fr" || value === "com";
}

export function registerMarketingAdminRoutes(app: Express): void {
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
      const normalizedCriteria = {
        market,
        hasOrders: ["any", "yes", "no"].includes(criteria.hasOrders) ? criteria.hasOrders : "any",
        hasAbandonedCart: ["any", "yes", "no"].includes(criteria.hasAbandonedCart) ? criteria.hasAbandonedCart : "any",
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

      const recipients = await storage.getMarketingRecipients(segment.criteria || { market: campaign.market as any });
      await storage.updateMarketingCampaign(campaign.id, {
        status: "sending",
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
      });

      let sentCount = 0;
      let failedCount = 0;
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
}