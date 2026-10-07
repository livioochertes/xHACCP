CREATE TABLE IF NOT EXISTS marketing_prospect_lists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  market VARCHAR(10) NOT NULL DEFAULT 'fr',
  source_file VARCHAR(255) NOT NULL,
  contact_basis VARCHAR(60) NOT NULL,
  basis_confirmed_at TIMESTAMP NOT NULL,
  basis_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketing_prospect_lists_market_idx
  ON marketing_prospect_lists(market);

CREATE TABLE IF NOT EXISTS marketing_prospects (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  market VARCHAR(10) NOT NULL DEFAULT 'fr',
  restaurant_name VARCHAR(255),
  city VARCHAR(160),
  address TEXT,
  phone VARCHAR(50),
  website TEXT,
  food_safety_note TEXT,
  legal_representative VARCHAR(255),
  siret VARCHAR(32),
  source TEXT,
  subscription_status VARCHAR(24) NOT NULL DEFAULT 'not_subscribed',
  invitation_sent_at TIMESTAMP,
  newsletter_consent_at TIMESTAMP,
  newsletter_consent_version VARCHAR(60),
  newsletter_voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  voucher_email_sent_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_prospects_email_market_unique
  ON marketing_prospects(email, market);
CREATE INDEX IF NOT EXISTS marketing_prospects_market_status_idx
  ON marketing_prospects(market, subscription_status);

CREATE TABLE IF NOT EXISTS marketing_prospect_list_contacts (
  list_id INTEGER NOT NULL REFERENCES marketing_prospect_lists(id) ON DELETE CASCADE,
  prospect_id INTEGER NOT NULL REFERENCES marketing_prospects(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS marketing_prospect_list_contacts_prospect_idx
  ON marketing_prospect_list_contacts(prospect_id);
