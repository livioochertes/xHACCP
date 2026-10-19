ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cart_tracking_key_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS orders_cart_tracking_key_hash_idx
  ON orders(cart_tracking_key_hash);

CREATE TABLE IF NOT EXISTS cart_abandonment_carts (
  id SERIAL PRIMARY KEY,
  cart_key_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  market VARCHAR(10) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_version VARCHAR(40) NOT NULL,
  consent_at TIMESTAMP NOT NULL,
  cart_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  abandoned_at TIMESTAMP,
  resolved_at TIMESTAMP,
  alert_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  alert_attempts INTEGER NOT NULL DEFAULT 0,
  alert_claimed_at TIMESTAMP,
  alert_attempted_at TIMESTAMP,
  alert_sent_at TIMESTAMP,
  alert_error TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cart_abandonment_carts_market_abandoned_idx
  ON cart_abandonment_carts(market, abandoned_at);

CREATE INDEX IF NOT EXISTS cart_abandonment_carts_expires_idx
  ON cart_abandonment_carts(expires_at);
