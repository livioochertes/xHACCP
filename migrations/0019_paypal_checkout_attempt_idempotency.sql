ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paypal_checkout_attempt_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS paypal_checkout_fingerprint VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_checkout_attempt_id_unique
  ON orders(paypal_checkout_attempt_id);
