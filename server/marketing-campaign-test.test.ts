import assert from "node:assert/strict";
import express from "express";
import type { Request, RequestHandler } from "express";
import test from "node:test";
import type {
  AIRecommendationCampaignRouteDependencies,
  MarketingEmailTestDependencies,
} from "./marketing-admin-routes";

const originalSetInterval = globalThis.setInterval;
globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const timer = originalSetInterval(...args);
  timer.unref();
  return timer;
}) as typeof globalThis.setInterval;
const { registerMarketingAdminRoutes } = await import("./marketing-admin-routes");
globalThis.setInterval = originalSetInterval;

test("campaign test sends to one admin address without querying or changing recipients or campaign status", async () => {
  const campaign: any = {
    id: 77,
    market: "fr",
    segmentId: 8,
    subject: "Votre offre",
    htmlContent: '<a href="{{newsletter_signup_url}}">{{discount_display}}</a><p>{{offer_terms}}</p><p>{{unsubscribe_url}}</p>',
    textContent: "Découvrez {{discount_display}}",
    status: "draft",
  };
  const sentMessages: any[] = [];
  let segmentReads = 0;
  const authenticateAdmin: RequestHandler = (_req, _res, next) => next();
  const canAccessMarket = (_req: Request, market: string) => market === "fr";
  const aiDependencies: AIRecommendationCampaignRouteDependencies = {
    authenticateAdmin,
    canAccessMarket,
    getCatalogForMarket: () => [],
    listCampaigns: async () => [],
    findCampaign: async () => undefined,
    createCampaignIfNoOverlap: async () => { throw new Error("not used"); },
    updateCampaignIfNoOverlap: async () => { throw new Error("not used"); },
    deleteCampaign: async () => {},
  };
  const testDependencies: MarketingEmailTestDependencies = {
    authenticateAdmin,
    canAccessMarket,
    getCampaign: async (id) => id === campaign.id ? campaign : undefined,
    getSegment: async () => {
      segmentReads++;
      return { criteria: { market: "fr", prospectAudience: "invitation" } };
    },
    getActiveOffer: async () => ({
      name: "Offre printemps",
      discountType: "fixed",
      discountValue: "8.50",
      validMonths: 4,
      isActive: true,
    } as any),
    loadOfferTemplate: async () => '<p>{{discount_display}}</p><a href="{{newsletter_signup_url}}">Voir l’offre</a>',
    sendEmail: async (message) => {
      sentMessages.push(message);
      return true;
    },
  };

  const app = express();
  app.use(express.json());
  registerMarketingAdminRoutes(app, aiDependencies, testDependencies);
  const server = app.listen(0);
  try {
    const baseUrl = await new Promise<string>((resolve, reject) => {
      server.once("listening", () => {
        const address = server.address();
        if (!address || typeof address === "string") return reject(new Error("Server did not bind"));
        resolve(`http://127.0.0.1:${address.port}`);
      });
      server.once("error", reject);
    });

    const response = await fetch(`${baseUrl}/admin/api/marketing/campaigns/77/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com" }),
    });
    assert.equal(response.status, 200);
    assert.equal(segmentReads, 1);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "admin@example.com");
    assert.match(sentMessages[0].subject, /^\[TEST\]/);
    assert.match(sentMessages[0].html, /xhaccp\.fr\/chef-event/);
    assert.match(sentMessages[0].html, /8,50 €/);
    assert.match(sentMessages[0].html, /4 mois/);
    assert.match(sentMessages[0].html, /Email de test uniquement/);
    assert.doesNotMatch(sentMessages[0].html, /BIENVENUE20|newsletter\/subscribe\?token=/);
    assert.deepEqual(sentMessages[0].headers, {});
    assert.equal(campaign.status, "draft");

    const templateResponse = await fetch(`${baseUrl}/admin/api/marketing/event-voucher-template`);
    assert.equal(templateResponse.status, 200);
    const template = await templateResponse.json() as any;
    assert.match(template.htmlContent, /{{discount_display}}/);
    assert.match(template.htmlContent, /{{newsletter_signup_url}}/);

    const invalidAddress = await fetch(`${baseUrl}/admin/api/marketing/campaigns/77/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ["one@example.com", "two@example.com"] }),
    });
    assert.equal(invalidAddress.status, 400);
    assert.equal(sentMessages.length, 1);
    assert.equal(campaign.status, "draft");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
