-- Migration: Product quantity field
-- Applied: 2026-06-09
-- Description: Adds product_quantity text column for net content display (e.g. "5L", "500g")

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_quantity TEXT;
