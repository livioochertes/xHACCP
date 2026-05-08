-- Migration: Multi-market support
-- Applied: 2026-05-08
-- Description: Adds market_settings, product_markets tables and orders.market column

-- 1. Market settings table (one row per market)
CREATE TABLE IF NOT EXISTS market_settings (
  id serial PRIMARY KEY,
  market varchar(10) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'RON',
  default_vat_percentage decimal(5,2) DEFAULT 19.00,
  free_shipping_threshold decimal(10,2) DEFAULT 1000.00,
  standard_shipping_cost decimal(10,2) DEFAULT 35.00,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 2. Product markets table (per-product market availability + overrides)
CREATE TABLE IF NOT EXISTS product_markets (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market varchar(10) NOT NULL,
  is_active boolean DEFAULT true,
  price decimal(10,2),               -- null = use product.price
  compare_at_price decimal(10,2),    -- null = use product.compareAtPrice
  currency varchar(3),               -- null = inherit from market_settings.currency
  in_stock boolean,                  -- null = use product-level stock
  stock_quantity integer,            -- null = use product-level stockQuantity
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT product_markets_product_id_market_unique UNIQUE (product_id, market)
);

-- 3. Add market column to orders (tracks which market/domain the order came from)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS market varchar(10);

-- 4. Seed default market settings (idempotent)
INSERT INTO market_settings (market, label, currency, default_vat_percentage, free_shipping_threshold, standard_shipping_cost, is_active)
VALUES
  ('ro', 'România', 'RON', 19.00, 1000.00, 35.00, true),
  ('com', 'International', 'EUR', 0.00, 200.00, 15.00, true),
  ('fr', 'France', 'EUR', 20.00, 150.00, 12.00, false)
ON CONFLICT (market) DO NOTHING;
