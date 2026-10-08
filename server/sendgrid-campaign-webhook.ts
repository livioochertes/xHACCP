import type { Express, Request, Response } from "express";
import { processSendGridCampaignEvents } from "./marketing-campaign-delivery";
import { verifySendGridEventSignature } from "./marketing-campaign-delivery-policy";

const SENDGRID_EVENT_PATH = "/api/integrations/sendgrid/events";

type RawBodyRequest = Request & { rawBody?: Buffer };

export function registerSendGridCampaignWebhook(app: Express): void {
  app.post(SENDGRID_EVENT_PATH, async (req: RawBodyRequest, res: Response) => {
    const publicKey = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(503).json({ message: "SendGrid event signature verification is not configured" });
    }

    const rawBody = req.rawBody;
    const signature = req.get("X-Twilio-Email-Event-Webhook-Signature") || "";
    const timestamp = req.get("X-Twilio-Email-Event-Webhook-Timestamp") || "";
    if (!rawBody || !verifySendGridEventSignature(rawBody, signature, timestamp, publicKey)) {
      return res.status(401).json({ message: "Invalid SendGrid event signature" });
    }
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: "Expected a SendGrid event array" });
    }

    try {
      await processSendGridCampaignEvents(req.body);
      return res.status(204).end();
    } catch (error) {
      console.error("SendGrid campaign event processing failed:", error instanceof Error ? error.message : "unknown");
      return res.status(500).json({ message: "SendGrid events could not be processed" });
    }
  });
}

export { SENDGRID_EVENT_PATH };
export { verifySendGridEventSignature };
