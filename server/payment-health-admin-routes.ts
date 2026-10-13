import type { Express, RequestHandler } from "express";
import { getPaymentHealthOverview } from "./payment-health-store";
import { PAYMENT_ALERT_RECIPIENT } from "./payment-health";
import { getVivaAccessToken } from "./viva-auth";
import { checkPayPalAuthentication } from "./paypal";
import type { PaymentMarket } from "./payment-health-policy";

export function registerPaymentHealthAdminRoutes(app: Express, authenticateAdmin: RequestHandler, dependencies = {
  overview: getPaymentHealthOverview,
  vivaAuth: getVivaAccessToken,
  paypalAuth: checkPayPalAuthentication,
}) {
  const allowedMarkets = (req: any): PaymentMarket[] =>
    ["ro", "fr", "com"].filter(market => !req.adminMarkets?.length || req.adminMarkets.includes(market)) as PaymentMarket[];
  app.get("/admin/api/payments/health", authenticateAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const selected = String(req.query.market || "all");
    if (!["all", "ro", "fr", "com"].includes(selected)) return res.status(400).json({ message: "Invalid marketplace" });
    const markets = allowedMarkets(req);
    if (selected !== "all" && !markets.includes(selected as PaymentMarket)) return res.status(403).json({ message: "Marketplace access denied" });
    try {
      return res.json({ ...await dependencies.overview(selected === "all" ? markets : [selected as PaymentMarket]),
        alertRecipient: PAYMENT_ALERT_RECIPIENT });
    } catch {
      return res.status(503).json({ message: "Payment health history is currently unavailable" });
    }
  });
  app.post("/admin/api/payments/health/check-auth", authenticateAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { provider, market } = req.body || {};
    if (!["viva", "paypal"].includes(provider) || !["ro", "fr", "com"].includes(market) ||
        (provider === "paypal" && market !== "fr")) return res.status(400).json({ message: "Invalid payment account" });
    if (!allowedMarkets(req).includes(market)) return res.status(403).json({ message: "Marketplace access denied" });
    try {
      if (provider === "viva") await dependencies.vivaAuth(market, "manual-admin-auth-check");
      else await dependencies.paypalAuth();
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: false });
    }
  });
}
