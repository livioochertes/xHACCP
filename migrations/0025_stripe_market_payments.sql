ALTER TABLE market_settings
  ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS viva_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_attempt_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS stripe_checkout_fingerprint VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_checkout_attempt_id_unique
  ON orders (stripe_checkout_attempt_id);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) NOT NULL DEFAULT 'viva',
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(120);

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS renewal_order_id INTEGER REFERENCES orders(id);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_stripe_payment_intent_unique
  ON subscription_payments (stripe_payment_intent_id);
