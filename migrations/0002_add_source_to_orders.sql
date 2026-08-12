ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'website';

-- Unique constraint prevents concurrent manual/automatic invoice generation from inserting duplicates.
-- Uses IF NOT EXISTS pattern via a conditional to be idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_order_id_unique' AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_unique" UNIQUE ("order_id");
  END IF;
END$$;
