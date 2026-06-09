-- Migration: Flexible product specs (key-value pairs)
-- Applied: 2026-06-09
-- Description: Adds specs JSONB column for arbitrary product characteristics

ALTER TABLE products ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '[]'::jsonb;
