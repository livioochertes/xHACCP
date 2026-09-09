-- Migration: Optional EAN/GTIN product identifier
-- Description: Stores an optional EAN/GTIN value for WMS and catalog matching.

ALTER TABLE products ADD COLUMN IF NOT EXISTS ean VARCHAR(14);