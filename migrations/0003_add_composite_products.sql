-- Configurable composite products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "is_composite" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS "composite_product_components" (
  "id" serial PRIMARY KEY,
  "parent_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "component_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "market" varchar(10) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "composite_components_parent_component_market_unique"
  ON "composite_product_components" ("parent_product_id", "component_product_id", "market");
CREATE INDEX IF NOT EXISTS "composite_components_parent_market_order_idx"
  ON "composite_product_components" ("parent_product_id", "market", "sort_order");

ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "composite_configuration" jsonb;
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "composite_configuration" jsonb;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'RON';

ALTER TABLE "invoice_items"
  ALTER COLUMN "product_name" TYPE text;