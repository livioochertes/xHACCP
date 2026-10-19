import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { optionalAuth, type AuthRequest } from "./authentication";
import { authenticateAdmin, canAccessMarket } from "./admin-routes";
import {
  deleteTrackedCart,
  getAuthenticatedCartTrackingInput,
  getCartTrackingKeyHashFromRequest,
  getGuestCartTrackingInput,
  listAbandonedCartAdminRows,
  syncTrackedCart,
} from "./cart-abandonment";

const cartMonitoringLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const SUPPORTED_MARKETS = ["ro", "fr", "com"] as const;

export function registerCartAbandonmentRoutes(app: Express): void {
  app.post(
    "/api/cart-monitoring",
    cartMonitoringLimiter,
    optionalAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const cartKeyHash = getCartTrackingKeyHashFromRequest(req);
        if (!cartKeyHash) {
          const staleKey = getCartTrackingKeyHashFromRequest(req, false);
          if (staleKey) await deleteTrackedCart(staleKey);
          return res.status(204).end();
        }

        const input = req.userId
          ? await getAuthenticatedCartTrackingInput(req)
          : await getGuestCartTrackingInput(req, req.body?.items);
        if (!input) return res.status(204).end();

        await syncTrackedCart({
          cartKeyHash: input.cartKeyHash,
          market: input.market,
          userId: "userId" in input ? input.userId : null,
          items: input.items,
          activityAt: "activityAt" in input ? input.activityAt : null,
        });
        return res.status(204).end();
      } catch (error) {
        console.error("[Cart Abandonment] Could not sync consented cart", error);
        return res.status(503).json({ message: "Cart monitoring is temporarily unavailable" });
      }
    },
  );

  app.delete("/api/cart-monitoring", cartMonitoringLimiter, async (req: Request, res: Response) => {
    try {
      const cartKeyHash = getCartTrackingKeyHashFromRequest(req, false);
      if (cartKeyHash) await deleteTrackedCart(cartKeyHash);
      return res.status(204).end();
    } catch (error) {
      console.error("[Cart Abandonment] Could not remove consented cart record", error);
      return res.status(503).json({ message: "Cart monitoring removal is temporarily unavailable" });
    }
  });

  app.get(
    "/admin/api/cart-abandonment",
    authenticateAdmin,
    async (req: Request, res: Response) => {
      const requestedMarket = typeof req.query.market === "string" ? req.query.market : "all";
      if (requestedMarket !== "all" && !SUPPORTED_MARKETS.includes(requestedMarket as any)) {
        return res.status(400).json({ message: "Unsupported market" });
      }
      const markets = requestedMarket === "all"
        ? [...SUPPORTED_MARKETS].filter(market => canAccessMarket(req as any, market))
        : canAccessMarket(req as any, requestedMarket)
          ? [requestedMarket]
          : [];
      if (!markets.length) return res.status(403).json({ message: "Access denied for this market" });
      try {
        const carts = await listAbandonedCartAdminRows(markets);
        return res.json({ carts });
      } catch (error) {
        console.error("[Cart Abandonment] Admin list failed", error);
        return res.status(500).json({ message: "Could not load abandoned carts" });
      }
    },
  );
}
