-- Migration: Add is_service column to products table
-- Applied: 2026-07-14
-- Purpose: Allows marking products as services/subscriptions to hide volume discounts on storefront

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service boolean DEFAULT false;

-- One-time backfill: mark known subscription products
-- Run manually after deployment if not already done via admin panel:
-- UPDATE products SET is_service = true WHERE name ILIKE '%KitOff PRO%subscription%';
