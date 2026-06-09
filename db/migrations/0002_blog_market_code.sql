-- Migration: Blog market_code support
-- Applied: 2026-06-09
-- Description: Adds market_code column to blog_posts for per-market content segmentation

-- 1. Add market_code column (idempotent)
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS market_code VARCHAR(10) DEFAULT 'ro';

-- 2. Backfill existing rows from language column
--    en → com (English international market)
--    fr → fr  (French market)
--    everything else (ro / NULL) → ro
UPDATE blog_posts
SET market_code = CASE
  WHEN language = 'en' THEN 'com'
  WHEN language = 'fr' THEN 'fr'
  ELSE 'ro'
END
WHERE market_code IS NULL OR market_code = 'ro';
