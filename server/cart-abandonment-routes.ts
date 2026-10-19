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

        if (req.userId) {
          const input = await getAuthenticatedCartTrackingInput(req);
          if (!input) {
            await deleteTrackedCart(cartKeyHash);
            return res.status(204).end();
          }
          await syncTrackedCart({
            cartKeyHash: input.cartKeyHash,
            market: input.market,
            userId: input.userId,
            items: input.items,
            consentAt: input.consentAt,
            activityAt: input.activityAt,
          });
          return res.status(204).end();
        }

        if (Array.isArray(req.body?.items) && req.body.items.length === 0) {
          await deleteTrackedCart(cartKeyHash);
          return res.status(204).end();
        }
        const input = await getGuestCartTrackingInput(req, req.body?.items);
        if (!input) return res.status(204).end();

        await syncTrackedCart({
          cartKeyHash: input.cartKeyHash,
          market: input.market,
          userId: null,
          items: input.items,
          consentAt: input.consentAt,
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
      const requestedLimit = Number(req.query.limit ?? 50);
      const requestedOffset = Number(req.query.offset ?? 0);
      if (requestedMarket !== "all" && !SUPPORTED_MARKETS.includes(requestedMarket as any)) {
        return res.status(400).json({ message: "Unsupported market" });
      }
      if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100 ||
          !Number.isSafeInteger(requestedOffset) || requestedOffset < 0) {
        return res.status(400).json({ message: "Invalid pagination" });
      }
      const markets = requestedMarket === "all"
        ? [...SUPPORTED_MARKETS].filter(market => canAccessMarket(req as any, market))
        : canAccessMarket(req as any, requestedMarket)
          ? [requestedMarket]
          : [];
      if (!markets.length) return res.status(403).json({ message: "Access denied for this market" });
      try {
        const result = await listAbandonedCartAdminRows(markets, requestedOffset, requestedLimit);
        return res.json(result);
      } catch (error) {
        console.error("[Cart Abandonment] Admin list failed", error);
        return res.status(500).json({ message: "Could not load abandoned carts" });
      }
    },
  );
}
