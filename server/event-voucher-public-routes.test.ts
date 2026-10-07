import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import type { Market } from "./market-routing";
import {
  registerEventVoucherPublicRoutes,
  type EventVoucherPublicRouteDependencies,
} from "./event-voucher-public-routes";

test("public registration requires consent, retries the same voucher and sends the configured fixed offer", async () => {
  const campaign: any = {
    id: 12,
    slug: "chef-event-fr",
    name: "Offre professionnelle",
    marketCode: "fr",
    discountType: "fixed",
    discountValue: "7.50",
    validMonths: 6,
    isActive: true,
  };
  let registration: any;
  let voucher: any;
  let voucherCreates = 0;
  let registerCalls = 0;
  const emailResults = [false, true];
  const emailCalls: any[] = [];
  const dependencies: EventVoucherPublicRouteDependencies = {
    getMarket: (req) => (req.get("x-market") === "fr" ? "fr" : "ro") as Market,
    getCampaign: async () => campaign,
    ensureCampaign: async () => campaign,
    register: async (data) => {
      registerCalls++;
      if (registration && voucher) {
        return { registration, voucher, alreadyRegistered: true };
      }
      const now = data.consentAt;
      voucherCreates++;
      voucher = {
        id: 91,
        code: "XHACCP-ABC123",
        discountType: campaign.discountType,
        discountValue: campaign.discountValue,
        validFrom: now,
        validUntil: new Date("2027-04-01T00:00:00.000Z"),
        activationDeadline: new Date("2026-10-31T00:00:00.000Z"),
      };
      registration = {
        id: 41,
        ...data,
        emailStatus: "pending",
      };
      return { registration, voucher, alreadyRegistered: false };
    },
    markEmailSent: async () => {
      registration.emailStatus = "sent";
    },
    markEmailFailed: async () => {
      registration.emailStatus = "failed";
    },
    sendVoucherEmail: async (email) => {
      emailCalls.push(email);
      return emailResults.shift() ?? false;
    },
    limiter: (_req, _res, next) => next(),
  };

  const app = express();
  app.use(express.json());
  registerEventVoucherPublicRoutes(app, dependencies);
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

    const campaignResponse = await fetch(`${baseUrl}/api/event-voucher/campaign`, {
      headers: { "x-market": "fr" },
    });
    assert.equal(campaignResponse.status, 200);
    const publicOffer = await campaignResponse.json() as any;
    assert.equal(publicOffer.discountType, "fixed");
    assert.equal(publicOffer.discountDisplay, "7,50 €");
    assert.equal(publicOffer.validMonths, 6);
    assert.equal(publicOffer.activationDays, 30);
    assert.equal(publicOffer.landingPath, "/chef-event");

    const outOfMarketResponse = await fetch(`${baseUrl}/api/event-voucher/campaign`);
    assert.equal(outOfMarketResponse.status, 404);

    const contact = {
      firstName: "Ana",
      lastName: "Martin",
      restaurant: "Restaurant",
      phone: "+33123456789",
      email: "ANA@example.com",
    };
    const missingConsent = await fetch(`${baseUrl}/api/event-voucher/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-market": "fr" },
      body: JSON.stringify({ ...contact, consent: false }),
    });
    assert.equal(missingConsent.status, 400);
    assert.equal(registerCalls, 0);

    const invalidMarket = await fetch(`${baseUrl}/api/event-voucher/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...contact, consent: true }),
    });
    assert.equal(invalidMarket.status, 404);
    assert.equal(registerCalls, 0);

    const firstAttempt = await fetch(`${baseUrl}/api/event-voucher/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-market": "fr" },
      body: JSON.stringify({ ...contact, consent: true }),
    });
    assert.equal(firstAttempt.status, 502);
    assert.equal(voucherCreates, 1);
    assert.equal(registration.email, "ana@example.com");

    const retry = await fetch(`${baseUrl}/api/event-voucher/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-market": "fr" },
      body: JSON.stringify({ ...contact, consent: true }),
    });
    assert.equal(retry.status, 200);
    const retryResult = await retry.json() as any;
    assert.equal(retryResult.alreadyRegistered, true);
    assert.match(retryResult.message, /7,50 €/);
    assert.equal(registerCalls, 2);
    assert.equal(voucherCreates, 1);
    assert.equal(emailCalls.length, 2);
    assert.equal(emailCalls[0].code, emailCalls[1].code);
    assert.equal(emailCalls[1].discountType, "fixed");
    assert.equal(emailCalls[1].discountValue, "7.50");

    const afterSuccessRetry = await fetch(`${baseUrl}/api/event-voucher/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-market": "fr" },
      body: JSON.stringify({ ...contact, consent: true }),
    });
    assert.equal(afterSuccessRetry.status, 200);
    assert.equal(voucherCreates, 1);
    assert.equal(emailCalls.length, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
