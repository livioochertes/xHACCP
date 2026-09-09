import type { Express, NextFunction, Request, Response } from "express";
import {
  authenticateWmsApiKey,
  getWmsOrderForPartner,
  hasScope,
  listWmsCatalog,
  listWmsOrders,
  acknowledgeWmsOrder,
  recordWmsEvent,
  requestBodyHash,
  reserveIdempotency,
  standardError,
  updateInventory,
  writeWmsAuditLog,
  type WmsAuthContext,
} from "./wms-service.js";

declare global {
  namespace Express {
    interface Request {
      wmsContext?: WmsAuthContext;
      wmsRequestId?: string;
    }
  }
}

const rateBuckets = new Map<string, { window: number; count: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

function requestId(req: Request): string {
  const incoming = String(req.header("X-Request-Id") || "").trim();
  return incoming && incoming.length <= 120 ? incoming : cryptoRandomId();
}

function cryptoRandomId(): string {
  return `wms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function sendError(res: Response, req: Request, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json(standardError(code, message, req.wmsRequestId || "unknown", details));
}

function requireScope(scope: "catalog:read" | "orders:read" | "orders:ack" | "orders:events" | "inventory:write") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.wmsContext || !hasScope(req.wmsContext, scope)) {
      return sendError(res, req, 403, "INSUFFICIENT_SCOPE", `Scope ${scope} is required`);
    }
    next();
  };
}

function parseDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function stableWriteResult(res: Response, result: { responseStatus: number; responseBody: any }) {
  return res.status(result.responseStatus).json(result.responseBody);
}

export function registerWmsRoutes(app: Express) {
  app.use("/api/wms/v1", (req, res, next) => {
    req.wmsRequestId = requestId(req);
    res.setHeader("X-Request-Id", req.wmsRequestId);
    // Health and order responses must not be cached by a proxy between the
    // scheduled monitor and the published app.
    res.setHeader("Cache-Control", "no-store");
    res.on("finish", () => {
      writeWmsAuditLog(req.wmsContext || null, {
        requestId: req.wmsRequestId || "unknown",
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
      }).catch(error => console.error("[WMS] audit write failed", error));
    });
    next();
  });

  app.get("/api/wms/v1/health", (_req, res) => {
    res.json({ ok: true, service: "xhaccp-wms-api", version: "v1", timestamp: new Date().toISOString() });
  });

  app.use("/api/wms/v1", async (req, res, next) => {
    if (req.path === "/health") return next();
    const authHeader = String(req.header("Authorization") || "");
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return sendError(res, req, 401, "UNAUTHENTICATED", "Bearer API key required");
    try {
      const context = await authenticateWmsApiKey(match[1]);
      if (!context) return sendError(res, req, 401, "UNAUTHENTICATED", "Invalid or revoked API key");
      req.wmsContext = context;
      const now = Date.now();
      const current = rateBuckets.get(String(context.apiKeyId));
      if (!current || now - current.window >= RATE_WINDOW_MS) {
        rateBuckets.set(String(context.apiKeyId), { window: now, count: 1 });
      } else {
        current.count += 1;
        if (current.count > RATE_LIMIT) {
          res.setHeader("Retry-After", "60");
          return sendError(res, req, 429, "RATE_LIMITED", "Rate limit exceeded");
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wms/v1/catalog", requireScope("catalog:read"), async (req, res) => {
    try {
      const context = req.wmsContext!;
      const market = req.query.market ? String(req.query.market) : undefined;
      if (market && !context.markets.includes(market)) {
        return sendError(res, req, 403, "MARKET_NOT_ALLOWED", "The API key is not routed to this market");
      }
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const updatedSince = parseDate(req.query.updated_since);
      if (req.query.updated_since && !updatedSince) {
        return sendError(res, req, 400, "INVALID_UPDATED_SINCE", "updated_since must be an ISO timestamp");
      }
      if (req.query.cursor && !String(req.query.cursor).trim()) {
        return sendError(res, req, 400, "INVALID_CURSOR", "cursor is invalid");
      }
      const result = await listWmsCatalog({
        context,
        market,
        updatedSince,
        cursor: req.query.cursor ? String(req.query.cursor) : undefined,
        limit,
      });
      res.json({ data: result.products, pagination: { next_cursor: result.nextCursor, limit } });
    } catch (error) {
      if ((error as any)?.code === "INVALID_CURSOR") {
        return sendError(res, req, 400, "INVALID_CURSOR", "cursor is invalid");
      }
      console.error("[WMS] list catalog failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to list catalog");
    }
  });

  app.get("/api/wms/v1/orders", requireScope("orders:read"), async (req, res) => {
    try {
      const context = req.wmsContext!;
      const market = req.query.market ? String(req.query.market) : undefined;
      if (market && !context.markets.includes(market)) {
        return sendError(res, req, 403, "MARKET_NOT_ALLOWED", "The API key is not routed to this market");
      }
      const statuses = req.query.status
        ? String(req.query.status).split(",").map(value => value.trim()).filter(Boolean)
        : undefined;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const updatedSince = parseDate(req.query.updated_since);
      if (req.query.updated_since && !updatedSince) {
        return sendError(res, req, 400, "INVALID_UPDATED_SINCE", "updated_since must be an ISO timestamp");
      }
      if (req.query.cursor && !String(req.query.cursor).trim()) {
        return sendError(res, req, 400, "INVALID_CURSOR", "cursor is invalid");
      }
      const result = await listWmsOrders({
        context,
        market,
        statuses,
        updatedSince,
        cursor: req.query.cursor ? String(req.query.cursor) : undefined,
        limit,
      });
      res.json({ data: result.orders, pagination: { next_cursor: result.nextCursor, limit } });
    } catch (error) {
      if ((error as any)?.code === "INVALID_CURSOR") {
        return sendError(res, req, 400, "INVALID_CURSOR", "cursor is invalid");
      }
      console.error("[WMS] list orders failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to list orders");
    }
  });

  app.get("/api/wms/v1/orders/:publicOrderRef", requireScope("orders:read"), async (req, res) => {
    try {
      const order = await getWmsOrderForPartner(req.params.publicOrderRef, req.wmsContext!);
      if (!order) return sendError(res, req, 404, "ORDER_NOT_FOUND", "Order not found");
      res.json({ data: order });
    } catch (error) {
      console.error("[WMS] get order failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to get order");
    }
  });

  app.post("/api/wms/v1/orders/:publicOrderRef/ack", requireScope("orders:ack"), async (req, res) => {
    try {
      const key = String(req.header("X-Idempotency-Key") || "").trim();
      if (!key || key.length > 160) return sendError(res, req, 400, "IDEMPOTENCY_KEY_REQUIRED", "X-Idempotency-Key is required");
      const hash = requestBodyHash(req.body);
      const reservation = await reserveIdempotency(req.wmsContext!, key, hash);
      if (reservation.state === "replay") return stableWriteResult(res, { responseStatus: reservation.record.responseStatus!, responseBody: reservation.record.responseBody });
      if (reservation.state === "in_progress") return sendError(res, req, 409, "IDEMPOTENCY_IN_PROGRESS", "A request with this idempotency key is already being processed");
      const result = await acknowledgeWmsOrder(req.params.publicOrderRef, req.wmsContext!, req.body);
      if (!result) return sendError(res, req, 404, "ORDER_NOT_FOUND", "Order not found");
      const body = { data: result };
      const { rememberIdempotency } = await import("./wms-service.js");
      await rememberIdempotency(req.wmsContext!, key, hash, 200, body);
      res.status(200).json(body);
    } catch (error: any) {
      if (error?.code === "IDEMPOTENCY_KEY_REUSED") return sendError(res, req, 409, error.code, error.message);
      console.error("[WMS] ack failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to acknowledge order");
    }
  });

  app.post("/api/wms/v1/orders/:publicOrderRef/events", requireScope("orders:events"), async (req, res) => {
    try {
      const key = String(req.header("X-Idempotency-Key") || "").trim();
      if (!key || key.length > 160) return sendError(res, req, 400, "IDEMPOTENCY_KEY_REQUIRED", "X-Idempotency-Key is required");
      const hash = requestBodyHash(req.body);
      const reservation = await reserveIdempotency(req.wmsContext!, key, hash);
      if (reservation.state === "replay") return stableWriteResult(res, { responseStatus: reservation.record.responseStatus!, responseBody: reservation.record.responseBody });
      if (reservation.state === "in_progress") return sendError(res, req, 409, "IDEMPOTENCY_IN_PROGRESS", "A request with this idempotency key is already being processed");
      const result = await recordWmsEvent(req.params.publicOrderRef, req.wmsContext!, req.body);
      if (result.kind === "not_found") return sendError(res, req, 404, "ORDER_NOT_FOUND", "Order not found");
      if (result.kind === "invalid") return sendError(res, req, 422, "INVALID_EVENT", "event_id, event_type and a valid occurred_at are required");
      const body = result.kind === "duplicate"
        ? { data: { event_id: result.event.eventId, status: result.event.status }, duplicate: true }
        : { data: { event_id: result.event_id, status: result.status } };
      const { rememberIdempotency } = await import("./wms-service.js");
      await rememberIdempotency(req.wmsContext!, key, hash, 200, body);
      res.status(200).json(body);
    } catch (error: any) {
      if (error?.code === "IDEMPOTENCY_KEY_REUSED") return sendError(res, req, 409, error.code, error.message);
      console.error("[WMS] event failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to record order event");
    }
  });

  app.post("/api/wms/v1/inventory", requireScope("inventory:write"), async (req, res) => {
    try {
      const key = String(req.header("X-Idempotency-Key") || "").trim();
      if (!key || key.length > 160) return sendError(res, req, 400, "IDEMPOTENCY_KEY_REQUIRED", "X-Idempotency-Key is required");
      const entries = Array.isArray(req.body) ? req.body : (req.body?.items || req.body?.inventory);
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
        return sendError(res, req, 422, "INVALID_INVENTORY_BATCH", "Inventory batch must contain between 1 and 1000 items");
      }
      const hash = requestBodyHash(req.body);
      const reservation = await reserveIdempotency(req.wmsContext!, key, hash);
      if (reservation.state === "replay") return stableWriteResult(res, { responseStatus: reservation.record.responseStatus!, responseBody: reservation.record.responseBody });
      if (reservation.state === "in_progress") return sendError(res, req, 409, "IDEMPOTENCY_IN_PROGRESS", "A request with this idempotency key is already being processed");
      const result = await updateInventory(req.wmsContext!, entries);
      const body = { data: result };
      const { rememberIdempotency } = await import("./wms-service.js");
      await rememberIdempotency(req.wmsContext!, key, hash, 200, body);
      res.status(200).json(body);
    } catch (error: any) {
      if (error?.code === "IDEMPOTENCY_KEY_REUSED") return sendError(res, req, 409, error.code, error.message);
      console.error("[WMS] inventory failed", error);
      sendError(res, req, 500, "INTERNAL_ERROR", "Unable to update inventory");
    }
  });

  app.use("/api/wms/v1", (error: any, req: Request, res: Response, _next: NextFunction) => {
    console.error("[WMS] unhandled route error", error);
    sendError(res, req, 500, "INTERNAL_ERROR", "Unexpected WMS API error");
  });
}