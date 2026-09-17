ALTER TABLE product_markets
  ADD COLUMN IF NOT EXISTS pennylane_product_id varchar(100),
  ADD COLUMN IF NOT EXISTS pennylane_accounting_account_id varchar(100);

ALTER TABLE invoices
  ALTER COLUMN invoice_number DROP NOT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS provider varchar(30),
  ADD COLUMN IF NOT EXISTS provider_status varchar(30),
  ADD COLUMN IF NOT EXISTS provider_invoice_id varchar(120),
  ADD COLUMN IF NOT EXISTS provider_invoice_url text,
  ADD COLUMN IF NOT EXISTS provider_pdf_url text,
  ADD COLUMN IF NOT EXISTS provider_error text,
  ADD COLUMN IF NOT EXISTS provider_last_attempt_at timestamp,
  ADD COLUMN IF NOT EXISTS provider_next_retry_at timestamp,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_external_ref_unique
  ON invoices (external_ref)
  WHERE external_ref IS NOT NULL;