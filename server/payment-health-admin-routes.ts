import type { Express, RequestHandler } from "express";
import { getPaymentHealthOverview } from "./payment-health-store";
import { PAYMENT_ALERT_RECIPIENT } from "./payment-health";
import { getVivaAccessToken } from "./viva-auth";
import { checkPayPalAuthentication } from "./paypal";
import { checkStripeAuthentication, isStripeConfigured } from "./stripe-payments";
import { storage } from "./storage";
import type { PaymentMarket } from "./payment-health-policy";

export function registerPaymentHealthAdminRoutes(app: Express, authenticateAdmin: RequestHandler, dependencies = {
  overview: getPaymentHealthOverview,
  vivaAuth: getVivaAccessToken,
  paypalAuth: checkPayPalAuthentication,
  stripeAuth: checkStripeAuthentication,
  stripeConfigured: isStripeConfigured,
  getMarketSettings: (market: string) => storage.getMarketSetting(market),
  updateMarketSettings: (market: string, settings: Record<string, unknown>) =>
    storage.upsertMarketSettings(market, settings as any),
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
      const visibleMarkets = selected === "all" ? markets : [selected as PaymentMarket];
      const [overview, paymentMethods] = await Promise.all([
        dependencies.overview(visibleMarkets),
        Promise.all(visibleMarkets.map(async market => {
          const settings = await dependencies.getMarketSettings(market);
          return {
            market,
            stripeEnabled: settings?.stripeEnabled ?? true,
            stripeReady: dependencies.stripeConfigured(market),
            vivaEnabled: settings?.vivaEnabled ?? false,
          };
        })),
      ]);
      return res.json({ ...overview, paymentMethods,
        alertRecipient: PAYMENT_ALERT_RECIPIENT });
    } catch {
      return res.status(503).json({ message: "Payment health history is currently unavailable" });
    }
  });
  app.put("/admin/api/payments/providers/:market", authenticateAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const market = String(req.params.market || "");
    const { provider, enabled } = req.body || {};
    if (!["ro", "fr", "com"].includes(market) ||
        !["stripe", "viva"].includes(provider) || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "Invalid payment method setting" });
    }
    if (!allowedMarkets(req).includes(market as PaymentMarket)) {
      return res.status(403).json({ message: "Marketplace access denied" });
    }
    try {
      const field = provider === "stripe" ? "stripeEnabled" : "vivaEnabled";
      const settings = await dependencies.updateMarketSettings(market, { [field]: enabled });
      return res.json({
        market,
        stripeEnabled: settings.stripeEnabled ?? true,
        stripeReady: dependencies.stripeConfigured(market as PaymentMarket),
        vivaEnabled: settings.vivaEnabled ?? false,
      });
    } catch {
      return res.status(503).json({ message: "Payment settings could not be saved" });
    }
  });
  app.post("/admin/api/payments/health/check-auth", authenticateAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { provider, market } = req.body || {};
    if (!["viva", "paypal", "stripe"].includes(provider) || !["ro", "fr", "com"].includes(market) ||
        (provider === "paypal" && market !== "fr")) return res.status(400).json({ message: "Invalid payment account" });
    if (!allowedMarkets(req).includes(market)) return res.status(403).json({ message: "Marketplace access denied" });
    try {
      if (provider === "viva") await dependencies.vivaAuth(market, "manual-admin-auth-check");
      else if (provider === "paypal") await dependencies.paypalAuth();
      else await dependencies.stripeAuth(market);
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: false });
    }
  });
}
