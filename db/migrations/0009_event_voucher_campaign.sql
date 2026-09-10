-- Public FR chef event voucher campaign and registrations

CREATE TABLE IF NOT EXISTS event_voucher_campaigns (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  market_code VARCHAR(10) NOT NULL DEFAULT 'fr',
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 20.00,
  valid_months INTEGER NOT NULL DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_voucher_registrations (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES event_voucher_campaigns(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  restaurant VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  consent_at TIMESTAMP NOT NULL,
  email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  email_sent_at TIMESTAMP,
  email_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT event_voucher_campaign_email_unique UNIQUE (campaign_id, email)
);

INSERT INTO event_voucher_campaigns
  (slug, name, market_code, discount_type, discount_value, valid_months, is_active)
VALUES
  ('chef-event-fr', 'Offre événement chefs FR', 'fr', 'percentage', 20.00, 12, TRUE)
ON CONFLICT (slug) DO NOTHING;