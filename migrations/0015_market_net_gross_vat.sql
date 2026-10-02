-- Market-scoped net/gross selling prices and immutable tax snapshots.
ALTER TABLE "product_markets"
  ADD COLUMN IF NOT EXISTS "price_net" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "price_gross" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "price_display_mode" varchar(10);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "subtotal_net" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "vat_percentage" numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "vat_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "discount_net_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "discount_gross_amount" numeric(10, 2);

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "price_net" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "total_price_net" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "vat_percentage" numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "vat_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "display_price" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "price_display_mode" varchar(10);

-- Preserve the visible price at rollout: French legacy prices are net, while
-- Romanian and international legacy prices are gross. Do not add any missing
-- product-market memberships; null overrides continue inheriting products.price.
UPDATE "product_markets" AS pm
SET "price_display_mode" = COALESCE(
  pm."price_display_mode",
  CASE WHEN pm."market" = 'fr' THEN 'net' ELSE 'gross' END
);

UPDATE "product_markets" AS pm
SET
  "price_net" = CASE
    WHEN pm."market" = 'fr' THEN pm."price"
    ELSE ROUND(pm."price" / (1 + GREATEST(COALESCE(ms."default_vat_percentage", 0), 0) / 100), 2)
  END,
  "price_gross" = CASE
    WHEN pm."market" = 'fr' THEN ROUND(pm."price" * (1 + GREATEST(COALESCE(ms."default_vat_percentage", 0), 0) / 100), 2)
    ELSE pm."price"
  END
FROM "market_settings" AS ms
WHERE pm."market" = ms."market"
  AND pm."price" IS NOT NULL
  AND (pm."price_net" IS NULL OR pm."price_gross" IS NULL);

UPDATE "product_markets" AS pm
SET
  "price_net" = CASE
    WHEN pm."market" = 'fr' THEN pm."price"
    ELSE pm."price"
  END,
  "price_gross" = pm."price"
WHERE pm."price" IS NOT NULL
  AND (pm."price_net" IS NULL OR pm."price_gross" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "market_settings" AS ms WHERE ms."market" = pm."market");