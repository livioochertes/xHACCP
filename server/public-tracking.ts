import type { Express } from "express";
import type { Order } from "@shared/schema";
import rateLimit from "express-rate-limit";

const DEFAULT_PUBLIC_APP_URL = "https://xhaccp.fr";
const publicTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).send("Veuillez réessayer plus tard."),
});

type PublicTrackingOrder = Pick<Order, "market" | "awbNumber" | "awbCourier">;

export interface PublicTrackingDependencies {
  getOrderByPublicOrderRef: (publicOrderRef: string) => Promise<PublicTrackingOrder | undefined>;
  createTrackingClient: () => PublicTrackingClient | null | Promise<PublicTrackingClient | null>;
}

export interface PublicTrackingClient {
  getTracking(awbNumber: string): Promise<unknown>;
}

export function getPublicAppUrl(): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (process.env.NODE_ENV !== "production" && devDomain) return `https://${devDomain}`;

  return DEFAULT_PUBLIC_APP_URL;
}

export function buildPublicTrackingUrl(publicOrderRef: string | null | undefined): string | null {
  if (!publicOrderRef) return null;
  return `${getPublicAppUrl()}/tracking/${encodeURIComponent(publicOrderRef)}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function trackingOrderLabel(order: Pick<Order, "publicOrderRef">): string {
  return order.publicOrderRef || "commande";
}

export function registerPublicTrackingRoute(
  app: Express,
  dependencies: PublicTrackingDependencies,
): void {
  app.get("/tracking/:publicOrderRef", publicTrackingLimiter, async (req, res) => {
    try {
      const order = await dependencies.getOrderByPublicOrderRef(req.params.publicOrderRef);
      if (
        !order ||
        order.market !== "fr" ||
        !order.awbNumber ||
        order.awbCourier?.toLowerCase() !== "myflyingbox"
      ) {
        return res.status(404).send("Suivi indisponible");
      }

      const trackingClient = await dependencies.createTrackingClient();
      if (!trackingClient) {
        return res.status(503).send("Le suivi est temporairement indisponible");
      }

      const trackingInfo = await trackingClient.getTracking(order.awbNumber);
      const trackingJson = JSON.stringify(trackingInfo, null, 2);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!doctype html>
        <html lang="fr">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Suivi de votre colis - xHACCP</title>
            <style>
              body { font-family: Arial, sans-serif; color: #243447; background: #f5f7fa; margin: 0; padding: 24px; }
              main { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
              h1 { color: #1a4f8a; font-size: 24px; margin-top: 0; }
              .awb { background: #eef8ee; border-left: 4px solid #27ae60; padding: 12px 16px; margin: 20px 0; }
              pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 14px; overflow: auto; white-space: pre-wrap; }
              .muted { color: #68737d; font-size: 14px; }
            </style>
          </head>
          <body>
            <main>
              <h1>Suivi de votre colis</h1>
              <p class="awb"><strong>Transporteur :</strong> MyFlyingBox<br><strong>N° de suivi :</strong> ${escapeHtml(order.awbNumber)}</p>
              <p class="muted">Les dernières informations communiquées par le transporteur sont affichées ci-dessous.</p>
              <pre>${escapeHtml(trackingJson)}</pre>
            </main>
          </body>
        </html>`);
    } catch (error) {
      console.error("Public MyFlyingBox tracking error:", error);
      return res.status(502).send("Le suivi est temporairement indisponible");
    }
  });
}