import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import express from "express";
import { sanitizePaymentObservation, paymentNotificationDecision, paymentAlertGuidance, PAYMENT_ALERT_COOLDOWN_MS } from "./payment-health-policy";
import { classifyPaymentResponse, createPaymentHealthMiddleware } from "./payment-health-middleware";
import { registerPaymentHealthAdminRoutes } from "./payment-health-admin-routes";

test("only technical failures are incidents; normal cancellations, declines and bad requests are not", () => {
  const base = { path: "/api/payments/viva/create-order", method: "POST", market: "fr" };
  assert.equal(classifyPaymentResponse({ ...base, httpStatus: 400 }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, httpStatus: 409 }), undefined);
  assert.deepEqual(classifyPaymentResponse({ ...base, httpStatus: 502, code: "VIVA_CREATE_REJECTED" }), {
    provider: "viva", market: "fr", stage: "checkout", status: "error",
    code: "VIVA_CREATE_REJECTED", httpStatus: 502,
  });
  const edgeDenial = classifyPaymentResponse({
    ...base,
    httpStatus: 502,
    providerHttpStatus: 403,
    responseType: "html",
    reference: "18.c013817.1791922609.37d9ec2",
    code: "VIVA_CHECKOUT_EDGE_ACCESS_DENIED",
  });
  assert.deepEqual(edgeDenial, {
    provider: "viva", market: "fr", stage: "checkout", status: "error",
    code: "VIVA_CHECKOUT_EDGE_ACCESS_DENIED", httpStatus: 403,
    responseType: "html", reference: "18.c013817.1791922609.37d9ec2",
  });
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/callback", method: "GET",
    httpStatus: 302, location: "/merci?payment=failed" }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/callback", method: "GET",
    httpStatus: 302, location: "/merci?payment=error" }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/callback", method: "GET",
    httpStatus: 302, location: "/merci?payment=failed", callbackException: true })?.status, "error");
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/callback", method: "GET",
    httpStatus: 302, location: "/merci?payment=success", callbackPending: true }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/webhook", httpStatus: 200 }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/webhook", method: "GET",
    httpStatus: 200, webhookAccepted: true }), undefined);
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/viva/webhook",
    httpStatus: 200, webhookAccepted: true })?.stage, "webhook");
  assert.equal(classifyPaymentResponse({ ...base, path: "/api/payments/paypal/create-order",
    httpStatus: 200 })?.market, "fr");
});

test("monitor metadata strips arbitrary provider or customer data", () => {
  const input = {
    provider: "viva", market: "ro", stage: "auth", status: "error",
    code: "credentials@example.com", reference: "secret@private.example", httpStatus: 900,
    responseType: "<html>token</html>", token: "never-record-this",
  } as any;
  assert.deepEqual(sanitizePaymentObservation(input), {
    provider: "viva", market: "ro", stage: "auth", status: "error",
    code: "PAYMENT_OPERATION_FAILED", reference: undefined, httpStatus: undefined, responseType: undefined,
  });
});

test("one alert per incident, a cooldown for recurring failures, recovery only after alert", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const failure = { provider: "viva" as const, market: "ro" as const, stage: "checkout" as const, status: "error" as const };
  assert.equal(paymentNotificationDecision(undefined, failure, now, false), "failure");
  assert.equal(paymentNotificationDecision(undefined, failure, now, true), undefined);
  const lastAlertAt = new Date(now.getTime() - 500);
  assert.equal(paymentNotificationDecision({ status: "error", lastAlertAt, incidentAlerted: true }, failure, now, false), undefined);
  assert.equal(paymentNotificationDecision({ status: "error", lastAlertAt:
    new Date(now.getTime() - PAYMENT_ALERT_COOLDOWN_MS - 1), incidentAlerted: true }, failure, now, false), "failure");
  assert.equal(paymentNotificationDecision({ status: "error", lastAlertAt, incidentAlerted: true },
    { ...failure, status: "ok" }, now, false), "recovery");
  assert.equal(paymentNotificationDecision({ status: "error", lastAlertAt: null, incidentAlerted: false },
    { ...failure, status: "ok" }, now, false), undefined);
});

test("Viva Akamai edge denials trigger a clear production alert with safe escalation guidance", () => {
  const edgeDenial = {
    provider: "viva" as const,
    market: "fr" as const,
    stage: "auth" as const,
    status: "error" as const,
    code: "VIVA_AUTH_EDGE_ACCESS_DENIED",
    httpStatus: 403,
    responseType: "html",
    reference: "18.c013817.1791922609.37d9ec2",
  };
  assert.equal(paymentNotificationDecision(undefined, edgeDenial, new Date("2026-10-13T12:00:00Z"), false), "failure");
  const guidance = paymentAlertGuidance(edgeDenial);
  assert.match(guidance || "", /blocare Akamai\/Viva/i);
  assert.match(guidance || "", /xHACCP\/1\.0/);
  assert.match(guidance || "", /Reference-ul Viva/);
  assert.equal(paymentAlertGuidance({
    ...edgeDenial,
    code: "VIVA_AUTH_INVALID_CLIENT",
  }), undefined);
});

test("response monitoring preserves the checkout response and scopes Viva to the storefront", async () => {
  const seen: unknown[] = [];
  const app = express();
  app.use(createPaymentHealthMiddleware(async observation => { seen.push(observation); }));
  app.post("/api/payments/viva/create-order", (_req, res) => res.status(502).json({
    message: "Payment could not be started", code: "VIVA_CREATE_FAILED",
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/payments/viva/create-order`,
      { method: "POST", headers: { "x-market": "fr" } });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { message: "Payment could not be started", code: "VIVA_CREATE_FAILED" });
    assert.deepEqual(seen, [{
      provider: "viva", market: "fr", stage: "checkout", status: "error", code: "VIVA_CREATE_FAILED", httpStatus: 502,
    }]);
  } finally { server.close(); }
});

test("admin route keeps existing access controls, never returns tokens, and checks only requested accounts", async () => {
  const checks: string[] = [];
  let requestedMarkets: string[] = [];
  const app = express();
  app.use(express.json());
  registerPaymentHealthAdminRoutes(app, (req, res, next) => {
    if (req.get("authorization") !== "Bearer fake-admin") return res.status(401).json({ message: "Unauthorized" });
    (req as any).adminMarkets = ["ro"];
    next();
  }, {
    overview: async markets => {
      requestedMarkets = markets;
      return { channels: [], events: [], alerts: [], environment: "development" };
    },
    vivaAuth: async market => { checks.push(market); },
    paypalAuth: async () => { checks.push("paypal"); },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/admin/api/payments/health`;
  try {
    assert.equal((await fetch(base)).status, 401);
    const denied = await fetch(`${base}?market=fr`, { headers: { Authorization: "Bearer fake-admin" } });
    assert.equal(denied.status, 403);
    const health = await fetch(base, { headers: { Authorization: "Bearer fake-admin" } });
    assert.equal(health.status, 200);
    assert.deepEqual(requestedMarkets, ["ro"]);
    const json = await health.json() as any;
    assert.equal(json.alertRecipient, "info@namarteccl.com");
    assert.equal(JSON.stringify(json).includes("access_token"), false);
    const check = (provider: string, market: string) => fetch(`${base}/check-auth`, {
      method: "POST", headers: { Authorization: "Bearer fake-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ provider, market }),
    });
    assert.equal((await check("paypal", "fr")).status, 403);
    assert.equal((await check("viva", "ro")).status, 200);
    assert.deepEqual(checks, ["ro"]);
  } finally { server.close(); }
});
