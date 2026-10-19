import { createHash } from "node:crypto";
import type { Request } from "express";
import {
  and,
  desc,
  eq,
  gte,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  cartAbandonmentCarts,
  cartItems,
  orders,
  productMarkets,
  products,
  type CartAbandonmentCart,
  type CartAbandonmentLine,
} from "@shared/schema";
import {
  CART_ABANDONMENT_DELAY_MS,
  CART_MONITORING_CONSENT_COOKIE,
  CART_MONITORING_CONSENT_VERSION,
  CART_MONITORING_ID_COOKIE,
  CART_MONITORING_RETENTION_DAYS,
  isCartMonitoringConsentCookie,
  isValidCartMonitoringId,
  normalizeCartAbandonmentItems,
} from "@shared/cart-abandonment";
import { db } from "./db";
import { getSenderForMarket, sendEmailWithOutcome } from "./email-service";

export const CART_ABANDONMENT_ALERT_RECIPIENT = "info@namarteccl.com";
const ALERT_RETRY_DELAY_MS = 5 * 60 * 1000;
const STALE_ALERT_CLAIM_MS = 10 * 60 * 1000;
const MAX_ALERT_ATTEMPTS = 3;
const MONITOR_INTERVAL_MS = 60 * 1000;

let schemaReady: Promise<void> | null = null;

export function ensureCartAbandonmentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS cart_tracking_key_hash VARCHAR(64)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS orders_cart_tracking_key_hash_idx
        ON orders(cart_tracking_key_hash)
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cart_abandonment_carts (
          id SERIAL PRIMARY KEY,
          cart_key_hash VARCHAR(64) NOT NULL UNIQUE,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          market VARCHAR(10) NOT NULL,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          consent_version VARCHAR(40) NOT NULL,
          consent_at TIMESTAMP NOT NULL,
          cart_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          abandoned_at TIMESTAMP,
          resolved_at TIMESTAMP,
          alert_status VARCHAR(20) NOT NULL DEFAULT 'pending',
          alert_attempts INTEGER NOT NULL DEFAULT 0,
          alert_claimed_at TIMESTAMP,
          alert_attempted_at TIMESTAMP,
          alert_sent_at TIMESTAMP,
          alert_error TEXT,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cart_abandonment_carts_market_abandoned_idx
        ON cart_abandonment_carts(market, abandoned_at)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cart_abandonment_carts_expires_idx
        ON cart_abandonment_carts(expires_at)
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function getRequestCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function getCartTrackingKeyHashFromRequest(
  req: Request,
  requireConsent = true,
): string | undefined {
  const consent = getRequestCookie(req, CART_MONITORING_CONSENT_COOKIE);
  const cartId = getRequestCookie(req, CART_MONITORING_ID_COOKIE);
  if ((requireConsent && !isCartMonitoringConsentCookie(consent)) || !isValidCartMonitoringId(cartId)) {
    return undefined;
  }
  return createHash("sha256").update(cartId).digest("hex");
}

export function hashCartMonitoringId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalizeItems(items: CartAbandonmentLine[]): CartAbandonmentLine[] {
  return [...items]
    .map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.components?.length
        ? { components: [...item.components].sort((a, b) =>
            a.componentProductId - b.componentProductId || a.quantity - b.quantity) }
        : {}),
    }))
    .sort((a, b) => a.productId - b.productId ||
      JSON.stringify(a.components || []).localeCompare(JSON.stringify(b.components || [])));
}

function retentionDeadline(now: Date): Date {
  return new Date(now.getTime() + CART_MONITORING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function deleteTrackedCart(cartKeyHash: string): Promise<void> {
  await ensureCartAbandonmentSchema();
  await db.delete(cartAbandonmentCarts)
    .where(eq(cartAbandonmentCarts.cartKeyHash, cartKeyHash));
}

export async function syncTrackedCart(input: {
  cartKeyHash: string;
  market: string;
  userId: number | null;
  items: CartAbandonmentLine[];
  activityAt?: Date | null;
  now?: Date;
}): Promise<void> {
  await ensureCartAbandonmentSchema();
  const now = input.now || new Date();
  const items = canonicalizeItems(input.items);
  if (items.length === 0) {
    await deleteTrackedCart(input.cartKeyHash);
    return;
  }

  const [current] = await db.select()
    .from(cartAbandonmentCarts)
    .where(eq(cartAbandonmentCarts.cartKeyHash, input.cartKeyHash))
    .limit(1);
  const sameItems = current && JSON.stringify(canonicalizeItems(current.items || [])) === JSON.stringify(items);
  const sameOwner = current?.userId === input.userId && current?.market === input.market;

  // A page reload must not restart the inactivity clock when the cart itself
  // is unchanged. Only a changed snapshot or an expired row starts a new episode.
  if (sameItems && sameOwner && current && current.expiresAt > now) {
    return;
  }

  const updatedAt = input.activityAt && Number.isFinite(input.activityAt.getTime())
    ? input.activityAt
    : now;
  await db.insert(cartAbandonmentCarts).values({
    cartKeyHash: input.cartKeyHash,
    market: input.market,
    userId: input.userId,
    items,
    consentVersion: CART_MONITORING_CONSENT_VERSION,
    consentAt: now,
    cartUpdatedAt: updatedAt,
    abandonedAt: null,
    resolvedAt: null,
    alertStatus: "pending",
    alertAttempts: 0,
    alertClaimedAt: null,
    alertAttemptedAt: null,
    alertSentAt: null,
    alertError: null,
    expiresAt: retentionDeadline(now),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: cartAbandonmentCarts.cartKeyHash,
    set: {
      market: input.market,
      userId: input.userId,
      items,
      consentVersion: CART_MONITORING_CONSENT_VERSION,
      cartUpdatedAt: updatedAt,
      abandonedAt: null,
      resolvedAt: null,
      alertStatus: "pending",
      alertAttempts: 0,
      alertClaimedAt: null,
      alertAttemptedAt: null,
      alertSentAt: null,
      alertError: null,
      expiresAt: retentionDeadline(now),
      updatedAt: now,
    },
  });
}

async function findCompletedOrder(cart: CartAbandonmentCart) {
  const orderIdentity = cart.userId
    ? or(
        eq(orders.cartTrackingKeyHash, cart.cartKeyHash),
        and(eq(orders.userId, cart.userId), isNull(orders.cartTrackingKeyHash)),
      )
    : eq(orders.cartTrackingKeyHash, cart.cartKeyHash);
  const checkoutCompleted = or(
    eq(orders.paymentStatus, "paid"),
    inArray(orders.status, ["paid", "processing", "shipped", "delivered", "completed"]),
    and(
      inArray(orders.paymentMethod, ["cash", "cod", "cash_on_delivery", "cash on delivery"]),
      ne(orders.status, "cancelled"),
      ne(orders.status, "canceled"),
      ne(orders.status, "failed"),
    ),
  );
  const [order] = await db.select({ id: orders.id })
    .from(orders)
    .where(and(
      orderIdentity,
      eq(orders.market, cart.market),
      gte(orders.createdAt, cart.cartUpdatedAt),
      checkoutCompleted,
    ))
    .limit(1);
  return order;
}

async function resolveCompletedCarts(now: Date): Promise<void> {
  const rows = await db.select()
    .from(cartAbandonmentCarts)
    .where(and(
      isNotNull(cartAbandonmentCarts.abandonedAt),
      isNull(cartAbandonmentCarts.resolvedAt),
      gt(cartAbandonmentCarts.expiresAt, now),
    ))
    .limit(250);
  for (const cart of rows) {
    try {
      if (await findCompletedOrder(cart)) {
        await db.update(cartAbandonmentCarts)
          .set({ resolvedAt: now, updatedAt: now })
          .where(and(
            eq(cartAbandonmentCarts.id, cart.id),
            isNull(cartAbandonmentCarts.resolvedAt),
          ));
      }
    } catch (error) {
      console.error("[Cart Abandonment] Could not resolve completed cart", cart.id, error);
    }
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MARKET_COPY = {
  ro: {
    subject: "Coș abandonat xHACCP",
    title: "A fost detectat un coș abandonat",
    label: "Piață",
    lastActivity: "Ultima activitate",
    visitor: "Vizitator anonim",
    account: "Cont autentificat",
    items: "Produse",
    openAdmin: "Deschide Admin",
  },
  fr: {
    subject: "Panier abandonné xHACCP",
    title: "Un panier abandonné a été détecté",
    label: "Marché",
    lastActivity: "Dernière activité",
    visitor: "Visiteur anonyme",
    account: "Compte connecté",
    items: "Produits",
    openAdmin: "Ouvrir l’Admin",
  },
  com: {
    subject: "Abandoned xHACCP cart",
    title: "An abandoned cart was detected",
    label: "Market",
    lastActivity: "Last activity",
    visitor: "Anonymous visitor",
    account: "Signed-in account",
    items: "Products",
    openAdmin: "Open Admin",
  },
} as const;

async function getProductNames(items: CartAbandonmentLine[]): Promise<Map<number, string>> {
  const ids = new Set<number>();
  for (const item of items) {
    ids.add(item.productId);
    for (const component of item.components || []) ids.add(component.componentProductId);
  }
  if (!ids.size) return new Map();
  const rows = await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(inArray(products.id, [...ids]));
  return new Map(rows.map(row => [row.id, row.name]));
}

async function sendAbandonedCartAlert(cart: CartAbandonmentCart): Promise<void> {
  const now = new Date();
  const claimable = or(
    eq(cartAbandonmentCarts.alertStatus, "pending"),
    and(
      eq(cartAbandonmentCarts.alertStatus, "retryable"),
      lt(
        cartAbandonmentCarts.alertAttemptedAt,
        new Date(now.getTime() - ALERT_RETRY_DELAY_MS),
      ),
      lt(cartAbandonmentCarts.alertAttempts, MAX_ALERT_ATTEMPTS),
    ),
  );
  const [claimed] = await db.update(cartAbandonmentCarts)
    .set({
      alertStatus: "sending",
      alertClaimedAt: now,
      alertAttemptedAt: now,
      alertAttempts: sql`${cartAbandonmentCarts.alertAttempts} + 1`,
      alertError: null,
      updatedAt: now,
    })
    .where(and(
      eq(cartAbandonmentCarts.id, cart.id),
      isNull(cartAbandonmentCarts.resolvedAt),
      isNull(cartAbandonmentCarts.alertSentAt),
      claimable,
    ))
    .returning();
  if (!claimed) return;

  const market = claimed.market === "fr" || claimed.market === "com" ? claimed.market : "ro";
  const copy = MARKET_COPY[market];
  const productNames = await getProductNames(claimed.items || []);
  const itemLines = (claimed.items || []).slice(0, 30).map(item => {
    const name = productNames.get(item.productId) || `#${item.productId}`;
    const componentText = (item.components || [])
      .map(component => `${productNames.get(component.componentProductId) || `#${component.componentProductId}`} × ${component.quantity}`)
      .join(", ");
    return `• ${name}${componentText ? ` (${componentText})` : ""} × ${item.quantity}`;
  });
  const adminUrl = `https://xhaccp.${market}/admin`;
  const text = [
    copy.title,
    `${copy.label}: .${market}`,
    `${copy.visitor === MARKET_COPY.ro.visitor ? copy.visitor : (claimed.userId ? copy.account : copy.visitor)}`,
    `${copy.lastActivity}: ${claimed.cartUpdatedAt.toISOString()}`,
    "",
    copy.items,
    ...itemLines,
    "",
    `${copy.openAdmin}: ${adminUrl}`,
    "This is an internal alert only. No customer email address or IP address is included.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033">
      <h2>${escapeHtml(copy.title)}</h2>
      <p><strong>${escapeHtml(copy.label)}:</strong> .${escapeHtml(market)}</p>
      <p><strong>${escapeHtml(copy.lastActivity)}:</strong> ${escapeHtml(claimed.cartUpdatedAt.toISOString())}</p>
      <h3>${escapeHtml(copy.items)}</h3>
      <ul>${itemLines.map(line => `<li>${escapeHtml(line.replace(/^• /, ""))}</li>`).join("")}</ul>
      <p><a href="${escapeHtml(adminUrl)}">${escapeHtml(copy.openAdmin)}</a></p>
      <p style="font-size:12px;color:#64748b">Internal alert only. No customer email address or IP address is included.</p>
    </div>`;

  try {
    const outcome = await sendEmailWithOutcome({
      to: CART_ABANDONMENT_ALERT_RECIPIENT,
      from: getSenderForMarket(market),
      subject: `${copy.subject} · .${market}`,
      text,
      html,
      suppressRecipientLog: true,
      customArgs: { cart_abandonment_id: String(claimed.id) },
    });
    const finishedAt = new Date();
    const nextStatus = outcome.status === "accepted"
      ? "sent"
      : outcome.status === "unknown"
        ? "unknown"
        : outcome.retryable && claimed.alertAttempts < MAX_ALERT_ATTEMPTS
          ? "retryable"
          : "failed";
    await db.update(cartAbandonmentCarts)
      .set({
        alertStatus: nextStatus,
        alertSentAt: outcome.status === "accepted" ? finishedAt : null,
        alertClaimedAt: null,
        alertError: outcome.status === "accepted" ? null : outcome.status === "unknown"
          ? outcome.reason
          : outcome.reason,
        updatedAt: finishedAt,
      })
      .where(eq(cartAbandonmentCarts.id, claimed.id));
  } catch {
    // An interrupted send may already have been accepted by SendGrid. Mark it
    // ambiguous rather than risking duplicate alerts on the next scheduler run.
    await db.update(cartAbandonmentCarts)
      .set({
        alertStatus: "unknown",
        alertClaimedAt: null,
        alertError: "send_outcome_unknown",
        updatedAt: new Date(),
      })
      .where(eq(cartAbandonmentCarts.id, claimed.id));
    console.error("[Cart Abandonment] Alert outcome unknown for cart record", claimed.id);
  }
}

export async function listAbandonedCartAdminRows(markets: string[]): Promise<Array<Record<string, unknown>>> {
  await ensureCartAbandonmentSchema();
  const now = new Date();
  await resolveCompletedCarts(now);
  const rows = await db.select()
    .from(cartAbandonmentCarts)
    .where(and(
      inArray(cartAbandonmentCarts.market, markets),
      isNotNull(cartAbandonmentCarts.abandonedAt),
      isNull(cartAbandonmentCarts.resolvedAt),
      gt(cartAbandonmentCarts.expiresAt, now),
    ))
    .orderBy(desc(cartAbandonmentCarts.abandonedAt))
    .limit(250);
  const names = await getProductNames(rows.flatMap(row => row.items || []));
  return rows.map(row => ({
    id: row.id,
    market: row.market,
    accountType: row.userId ? "account" : "anonymous",
    items: (row.items || []).map(item => ({
      productId: item.productId,
      productName: names.get(item.productId) || `#${item.productId}`,
      quantity: item.quantity,
      components: (item.components || []).map(component => ({
        productId: component.componentProductId,
        name: names.get(component.componentProductId) || `#${component.componentProductId}`,
        quantity: component.quantity,
      })),
    })),
    cartUpdatedAt: row.cartUpdatedAt,
    abandonedAt: row.abandonedAt,
    alertStatus: row.alertStatus,
    alertAttempts: row.alertAttempts,
    alertSentAt: row.alertSentAt,
    alertError: row.alertError,
    expiresAt: row.expiresAt,
  }));
}

let monitorRunning = false;

export async function runCartAbandonmentMonitor(now = new Date()): Promise<{
  due: number;
  alertsAttempted: number;
  expired: number;
}> {
  if (monitorRunning) return { due: 0, alertsAttempted: 0, expired: 0 };
  monitorRunning = true;
  try {
    await ensureCartAbandonmentSchema();
    const expiredRows = await db.delete(cartAbandonmentCarts)
      .where(lt(cartAbandonmentCarts.expiresAt, now))
      .returning({ id: cartAbandonmentCarts.id });
    const cutoff = new Date(now.getTime() - CART_ABANDONMENT_DELAY_MS);
    const active = await db.select()
      .from(cartAbandonmentCarts)
      .where(and(
        isNull(cartAbandonmentCarts.abandonedAt),
        isNull(cartAbandonmentCarts.resolvedAt),
        gt(cartAbandonmentCarts.expiresAt, now),
        lte(cartAbandonmentCarts.cartUpdatedAt, cutoff),
      ))
      .limit(500);

    let due = 0;
    for (const cart of active) {
      try {
        if (await findCompletedOrder(cart)) {
          await db.update(cartAbandonmentCarts)
            .set({ resolvedAt: now, updatedAt: now })
            .where(and(
              eq(cartAbandonmentCarts.id, cart.id),
              isNull(cartAbandonmentCarts.resolvedAt),
            ));
          continue;
        }
        const [abandoned] = await db.update(cartAbandonmentCarts)
          .set({ abandonedAt: now, alertStatus: "pending", updatedAt: now })
          .where(and(
            eq(cartAbandonmentCarts.id, cart.id),
            isNull(cartAbandonmentCarts.abandonedAt),
            isNull(cartAbandonmentCarts.resolvedAt),
            lte(cartAbandonmentCarts.cartUpdatedAt, cutoff),
          ))
          .returning({ id: cartAbandonmentCarts.id });
        if (abandoned) due++;
      } catch (error) {
        console.error("[Cart Abandonment] Failed to evaluate cart record", cart.id, error);
      }
    }

    // A worker crash after sending can leave a claim behind. Its result is
    // ambiguous, so never retry it automatically and risk a duplicate email.
    await db.update(cartAbandonmentCarts)
      .set({
        alertStatus: "unknown",
        alertClaimedAt: null,
        alertError: "stale_send_claim_outcome_unknown",
        updatedAt: now,
      })
      .where(and(
        eq(cartAbandonmentCarts.alertStatus, "sending"),
        lt(cartAbandonmentCarts.alertClaimedAt, new Date(now.getTime() - STALE_ALERT_CLAIM_MS)),
      ));

    const sendable = await db.select()
      .from(cartAbandonmentCarts)
      .where(and(
        isNotNull(cartAbandonmentCarts.abandonedAt),
        isNull(cartAbandonmentCarts.resolvedAt),
        isNull(cartAbandonmentCarts.alertSentAt),
        or(
          eq(cartAbandonmentCarts.alertStatus, "pending"),
          and(
            eq(cartAbandonmentCarts.alertStatus, "retryable"),
            or(
              isNull(cartAbandonmentCarts.alertAttemptedAt),
              lt(cartAbandonmentCarts.alertAttemptedAt, new Date(now.getTime() - ALERT_RETRY_DELAY_MS)),
            ),
            lt(cartAbandonmentCarts.alertAttempts, MAX_ALERT_ATTEMPTS),
          ),
        ),
      ))
      .orderBy(desc(cartAbandonmentCarts.abandonedAt))
      .limit(100);
    let alertsAttempted = 0;
    for (const cart of sendable) {
      alertsAttempted++;
      try {
        await sendAbandonedCartAlert(cart);
      } catch (error) {
        console.error("[Cart Abandonment] Failed to send alert for record", cart.id, error);
      }
    }
    return { due, alertsAttempted, expired: expiredRows.length };
  } finally {
    monitorRunning = false;
  }
}

export function startCartAbandonmentMonitorScheduler(): void {
  void runCartAbandonmentMonitor().catch(() => {
    console.error("[Cart Abandonment] Initial monitor run failed");
  });
  const timer = setInterval(() => {
    void runCartAbandonmentMonitor().catch(() => {
      console.error("[Cart Abandonment] Monitor run failed");
    });
  }, MONITOR_INTERVAL_MS);
  timer.unref();
  console.log("[Cart Abandonment] Monitor started — checks every minute.");
}

export async function getGuestCartTrackingInput(
  req: Request,
  rawItems: unknown,
): Promise<{ cartKeyHash: string; market: string; items: CartAbandonmentLine[] } | null> {
  const cartKeyHash = getCartTrackingKeyHashFromRequest(req);
  if (!cartKeyHash) return null;
  const items = normalizeCartAbandonmentItems(rawItems);
  if (!items || items.length === 0) return null;
  const ids = [...new Set(items.flatMap(item => [
    item.productId,
    ...(item.components || []).map(component => component.componentProductId),
  ]))];
  const marketValue = (req as Request & { market?: string }).market;
  const market = marketValue === "fr" || marketValue === "com" ? marketValue : "ro";
  const available = await db.select({ id: products.id })
    .from(products)
    .innerJoin(productMarkets, and(
      eq(productMarkets.productId, products.id),
      eq(productMarkets.market, market),
    ))
    .where(and(
      inArray(products.id, ids),
      eq(products.status, "active"),
    ));
  if (new Set(available.map(product => product.id)).size !== ids.length) return null;
  return { cartKeyHash, market, items };
}

export async function getAuthenticatedCartTrackingInput(
  req: Request & { userId?: number },
): Promise<{ cartKeyHash: string; market: string; userId: number; items: CartAbandonmentLine[]; activityAt: Date | null } | null> {
  const cartKeyHash = getCartTrackingKeyHashFromRequest(req);
  if (!cartKeyHash || !req.userId) return null;
  await ensureCartAbandonmentSchema();
  const marketValue = (req as Request & { market?: string }).market;
  const market = marketValue === "fr" || marketValue === "com" ? marketValue : "ro";
  const rows = await db.select({
    productId: cartItems.productId,
    quantity: cartItems.quantity,
    compositeConfiguration: cartItems.compositeConfiguration,
    updatedAt: cartItems.updatedAt,
  }).from(cartItems)
    .where(and(
      eq(cartItems.userId, req.userId),
      eq(cartItems.market, market),
      isNotNull(cartItems.productId),
    ));
  const items = normalizeCartAbandonmentItems(rows.map(row => ({
    productId: row.productId,
    quantity: row.quantity,
    compositeConfiguration: row.compositeConfiguration,
  })));
  if (!items?.length) return null;
  const activityAt = rows.reduce<Date | null>((latest, row) => {
    if (!row.updatedAt) return latest;
    const updatedAt = new Date(row.updatedAt);
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, null);
  return { cartKeyHash, market, userId: req.userId, items, activityAt };
}
