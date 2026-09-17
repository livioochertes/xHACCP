ALTER TABLE product_markets
  ADD COLUMN IF NOT EXISTS pennylane_product_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pennylane_accounting_account_id VARCHAR(100);

ALTER TABLE market_settings
  ADD COLUMN IF NOT EXISTS invoice_provider VARCHAR(30);