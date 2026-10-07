import type { Express, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import type {
  EventVoucherCampaign,
  EventVoucherRegistration,
  Voucher,
} from "@shared/schema";
import { getMarketFromRequest } from "./market-routing";
import { sendEventVoucherEmail } from "./email-service";
import { storage } from "./storage";
import {
  EVENT_VOUCHER_ACTIVATION_DAYS,
  EVENT_VOUCHER_CAMPAIGN_DEFAULTS,
  EVENT_VOUCHER_CAMPAIGN_SLUG,
  formatEventVoucherDiscount,
} from "./event-voucher";

type EventVoucherRegistrationResult = {
  registration: EventVoucherRegistration;
  voucher: Voucher;
  alreadyRegistered: boolean;
};

export interface EventVoucherPublicRouteDependencies {
  getMarket: typeof getMarketFromRequest;
  getCampaign: (slug: string, includeInactive?: boolean) => Promise<EventVoucherCampaign | undefined>;
  ensureCampaign: (campaign: typeof EVENT_VOUCHER_CAMPAIGN_DEFAULTS) => Promise<EventVoucherCampaign>;
  register: (data: {
    campaignId: number;
    firstName: string;
    lastName: string;
    restaurant: string;
    phone: string;
    email: string;
    consentAt: Date;
  }) => Promise<EventVoucherRegistrationResult>;
  markEmailSent: (id: number) => Promise<unknown>;
  markEmailFailed: (id: number, error: string) => Promise<unknown>;
  sendVoucherEmail: typeof sendEventVoucherEmail;
  limiter: RequestHandler;
}

const defaultDependencies: EventVoucherPublicRouteDependencies = {
  getMarket: getMarketFromRequest,
  getCampaign: (slug, includeInactive) => storage.getEventVoucherCampaign(slug, includeInactive),
  ensureCampaign: (campaign) => storage.ensureEventVoucherCampaign(campaign),
  register: (data) => storage.registerEventVoucher(data),
  markEmailSent: (id) => storage.markEventVoucherEmailSent(id),
  markEmailFailed: (id, error) => storage.markEventVoucherEmailFailed(id, error),
  sendVoucherEmail: sendEventVoucherEmail,
  limiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Trop de tentatives. Veuillez réessayer plus tard." },
  }),
};

async function getActiveCampaign(
  dependencies: EventVoucherPublicRouteDependencies,
): Promise<EventVoucherCampaign | undefined> {
  let campaign = await dependencies.getCampaign(EVENT_VOUCHER_CAMPAIGN_SLUG);
  if (!campaign) {
    await dependencies.ensureCampaign(EVENT_VOUCHER_CAMPAIGN_DEFAULTS);
    campaign = await dependencies.getCampaign(EVENT_VOUCHER_CAMPAIGN_SLUG);
  }
  return campaign;
}

function campaignResponse(campaign: EventVoucherCampaign) {
  return {
    slug: campaign.slug,
    name: campaign.name,
    marketCode: campaign.marketCode,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
    discountDisplay: formatEventVoucherDiscount(campaign.discountType, campaign.discountValue),
    validMonths: campaign.validMonths,
    activationDays: EVENT_VOUCHER_ACTIVATION_DAYS,
    landingPath: "/chef-event",
  };
}

function validContactInput(body: any): body is {
  firstName: string;
  lastName: string;
  restaurant: string;
  phone: string;
  email: string;
  consent: true;
} {
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const restaurant = typeof body?.restaurant === "string" ? body.restaurant.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  return Boolean(
    firstName && firstName.length <= 100
    && lastName && lastName.length <= 100
    && restaurant && restaurant.length <= 255
    && phone && phone.length <= 40
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255
    && body?.consent === true,
  );
}

export function registerEventVoucherPublicRoutes(
  app: Express,
  dependencies: EventVoucherPublicRouteDependencies = defaultDependencies,
): void {
  app.get("/api/event-voucher/campaign", async (req, res) => {
    try {
      if (dependencies.getMarket(req) !== "fr") {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const campaign = await getActiveCampaign(dependencies);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      return res.json(campaignResponse(campaign));
    } catch {
      console.error("Get event voucher campaign error");
      return res.status(500).json({ message: "Failed to load campaign" });
    }
  });

  app.post(
    "/api/event-voucher/register",
    dependencies.limiter,
    async (req, res: Response) => {
      try {
        if (dependencies.getMarket(req) !== "fr") {
          return res.status(404).json({ message: "Campaign not found" });
        }
        const campaign = await getActiveCampaign(dependencies);
        if (!campaign) {
          return res.status(404).json({ message: "Cette offre n'est plus disponible." });
        }

        const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
        const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
        const restaurant = typeof req.body?.restaurant === "string" ? req.body.restaurant.trim() : "";
        const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!validContactInput(req.body)) {
          const consentMissing = req.body?.consent !== true;
          return res.status(400).json({
            message: consentMissing
              ? "Votre consentement est nécessaire pour recevoir l'offre par email."
              : "Veuillez compléter correctement tous les champs obligatoires.",
          });
        }

        const result = await dependencies.register({
          campaignId: campaign.id,
          firstName,
          lastName,
          restaurant,
          phone,
          email,
          consentAt: new Date(),
        });

        if (result.registration.emailStatus !== "sent") {
          const sent = await dependencies.sendVoucherEmail({
            to: result.registration.email,
            firstName: result.registration.firstName,
            code: result.voucher.code,
            validUntil: result.voucher.validUntil!,
            activationDeadline: result.voucher.activationDeadline ?? undefined,
            discountType: result.voucher.discountType,
            discountValue: result.voucher.discountValue,
          });
          if (sent) {
            await dependencies.markEmailSent(result.registration.id);
          } else {
            await dependencies.markEmailFailed(
              result.registration.id,
              "SendGrid did not accept the event voucher email",
            );
            return res.status(502).json({
              message: "Votre inscription est enregistrée, mais l'email n'a pas pu être envoyé. Veuillez réessayer.",
            });
          }
        }

        return res.json({
          success: true,
          alreadyRegistered: result.alreadyRegistered,
          message: `Merci ! Votre code personnel de ${formatEventVoucherDiscount(result.voucher.discountType, result.voucher.discountValue)} vous a été envoyé par email.`,
        });
      } catch {
        console.error("Register event voucher error");
        return res.status(500).json({ message: "Une erreur est survenue. Veuillez réessayer." });
      }
    },
  );
}
