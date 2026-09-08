-- WMS partner API: partner routing, hashed credentials, order fulfillment state,
-- shipments, events, inventory, idempotency, and request audit.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_order_ref VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'unassigned';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_partner_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_assigned_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

UPDATE orders
SET public_order_ref = 'ord_' || md5(id::text || ':' || coalesce(created_at::text, now()::text))
WHERE public_order_ref IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_order_ref_unique ON orders(public_order_ref);
CREATE INDEX IF NOT EXISTS orders_fulfillment_cursor_idx
  ON orders(confirmed_at, id);
CREATE INDEX IF NOT EXISTS orders_fulfillment_partner_idx
  ON orders(fulfillment_partner_id, fulfillment_status);

CREATE TABLE IF NOT EXISTS fulfillment_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(60) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_fulfillment (
  id SERIAL PRIMARY KEY,
  market VARCHAR(10) NOT NULL UNIQUE,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_api_keys (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE CASCADE,
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  key_prefix VARCHAR(32) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_shipments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE RESTRICT,
  parcel_id VARCHAR(100) NOT NULL,
  tracking_number VARCHAR(160),
  carrier VARCHAR(100),
  status VARCHAR(40) NOT NULL DEFAULT 'created',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(order_id, parcel_id)
);
CREATE INDEX IF NOT EXISTS wms_shipments_partner_order_idx ON wms_shipments(partner_id, order_id);

CREATE TABLE IF NOT EXISTS wms_order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE RESTRICT,
  event_id VARCHAR(160) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, event_id)
);
CREATE INDEX IF NOT EXISTS wms_order_events_order_occurred_idx ON wms_order_events(order_id, occurred_at);

CREATE TABLE IF NOT EXISTS wms_inventory (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE CASCADE,
  sku VARCHAR(160) NOT NULL,
  quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL,
  source_updated_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, sku)
);

CREATE TABLE IF NOT EXISTS wms_idempotency_keys (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES fulfillment_partners(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(160) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS wms_audit_logs (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES fulfillment_partners(id) ON DELETE SET NULL,
  api_key_id INTEGER REFERENCES wms_api_keys(id) ON DELETE SET NULL,
  request_id VARCHAR(120) NOT NULL,
  method VARCHAR(12) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wms_audit_logs_created_idx ON wms_audit_logs(created_at);