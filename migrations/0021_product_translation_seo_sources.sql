ALTER TABLE product_translations
  ADD COLUMN IF NOT EXISTS seo_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
