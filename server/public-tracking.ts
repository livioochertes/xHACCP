import type { Express } from "express";
import type { Order } from "@shared/schema";
import rateLimit, { MemoryStore, type Store } from "express-rate-limit";

const DEFAULT_PUBLIC_APP_URL = "https://xhaccp.fr";
const PUBLIC_TRACKING_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_TRACKING_LIMIT = 10;
const PUBLIC_TRACKING_RATE_LIMIT_TABLE = "public_tracking_rate_limits";

interface QueryResult<Row> {
  rows: Row[];
}

export interface PublicTrackingRateLimitQuery {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

type RateLimitRow = {
  total_hits: number;
  reset_at: Date | string;
};

/**
 * A database-backed express-rate-limit store. The increment is a single
 * PostgreSQL upsert, so concurrent requests and separate application
 * instances serialize on the same client key.
 */
export class PostgresPublicTrackingRateLimitStore implements Store {
  private readonly querySource: PublicTrackingRateLimitQuery | (() => Promise<PublicTrackingRateLimitQuery>);
  private initialization: Promise<void> | undefined;
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private windowMs = PUBLIC_TRACKING_WINDOW_MS;
  private limit = PUBLIC_TRACKING_LIMIT;

  constructor(
    querySource: PublicTrackingRateLimitQuery | (() => Promise<PublicTrackingRateLimitQuery>),
  ) {
    this.querySource = querySource;
  }

  init(options: { windowMs: number; limit: number | unknown }): void {
    this.windowMs = options.windowMs;
    if (typeof options.limit === "number") this.limit = options.limit;

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      void this.removeExpiredRows();
    }, this.windowMs);
    this.cleanupTimer.unref?.();
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      await this.ensureInitialized();
      const result = await this.query<RateLimitRow>(
        `INSERT INTO ${PUBLIC_TRACKING_RATE_LIMIT_TABLE} (key, total_hits, reset_at)
         VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond'))
         ON CONFLICT (key) DO UPDATE SET
           total_hits = CASE
             WHEN ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}.reset_at <= NOW() THEN 1
             ELSE ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}.total_hits + 1
           END,
           reset_at = CASE
             WHEN ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}.reset_at <= NOW() THEN EXCLUDED.reset_at
             ELSE ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}.reset_at
           END
         RETURNING total_hits, reset_at`,
        [key, this.windowMs],
      );
      const row = result.rows[0];
      if (!row) throw new Error("shared limiter returned no counter row");

      return {
        totalHits: Number(row.total_hits),
        resetTime: new Date(row.reset_at),
      };
    } catch (error) {
      this.logStoreFailure(error);
      // Do not bypass protection when the shared store is unavailable.
      return {
        totalHits: this.limit + 1,
        resetTime: new Date(Date.now() + this.windowMs),
      };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.query(
        `UPDATE ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}
            SET total_hits = GREATEST(total_hits - 1, 0)
          WHERE key = $1 AND reset_at > NOW()`,
        [key],
      );
    } catch (error) {
      this.logStoreFailure(error);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.query(
        `DELETE FROM ${PUBLIC_TRACKING_RATE_LIMIT_TABLE} WHERE key = $1`,
        [key],
      );
    } catch (error) {
      this.logStoreFailure(error);
    }
  }

  async resetAll(): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.query(`DELETE FROM ${PUBLIC_TRACKING_RATE_LIMIT_TABLE}`);
    } catch (error) {
      this.logStoreFailure(error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.query(
        `CREATE TABLE IF NOT EXISTS ${PUBLIC_TRACKING_RATE_LIMIT_TABLE} (
           key TEXT PRIMARY KEY,
           total_hits INTEGER NOT NULL,
           reset_at TIMESTAMPTZ NOT NULL
         )`,
      ).then(() => undefined);
    }
    return this.initialization;
  }

  private async removeExpiredRows(): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.query(
        `DELETE FROM ${PUBLIC_TRACKING_RATE_LIMIT_TABLE} WHERE reset_at <= NOW()`,
      );
    } catch (error) {
      this.logStoreFailure(error);
    }
  }

  private async query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>> {
    const querySource = typeof this.querySource === "function"
      ? await this.querySource()
      : this.querySource;
    return querySource.query<Row>(text, values);
  }

  private logStoreFailure(error: unknown): void {
    console.error(
      "[Public tracking limiter] shared store unavailable; requests are denied.",
      error instanceof Error ? error.message : error,
    );
  }
}

function createPublicTrackingRateLimitStore(): Store {
  if (!process.env.DATABASE_URL) {
    // Unit tests can exercise the route without provisioning a database.
    return new MemoryStore();
  }

  let querySource: Promise<PublicTrackingRateLimitQuery> | undefined;
  return new PostgresPublicTrackingRateLimitStore(async () => {
    querySource ??= import("./db.js").then(({ pool }) => pool);
    return querySource;
  });
}

const publicTrackingLimiter = rateLimit({
  windowMs: PUBLIC_TRACKING_WINDOW_MS,
  limit: PUBLIC_TRACKING_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  store: createPublicTrackingRateLimitStore(),
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