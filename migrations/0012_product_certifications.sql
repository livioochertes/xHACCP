ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "certifications" jsonb NOT NULL DEFAULT '[]'::jsonb;