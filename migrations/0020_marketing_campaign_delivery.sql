ALTER TABLE marketing_prospects
  ADD COLUMN IF NOT EXISTS email_suppressed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_suppression_reason VARCHAR(40);

CREATE INDEX IF NOT EXISTS marketing_prospects_market_suppressed_idx
  ON marketing_prospects(market, email_suppressed_at);

CREATE TABLE IF NOT EXISTS marketing_campaign_batches (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_campaign_batches_campaign_number_unique
    UNIQUE (campaign_id, batch_number)
);

ALTER TABLE marketing_campaign_batches
  ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS marketing_campaign_batches_campaign_idx
  ON marketing_campaign_batches(campaign_id, status);

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES marketing_campaign_batches(id) ON DELETE CASCADE,
  prospect_id INTEGER REFERENCES marketing_prospects(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  attempted_at TIMESTAMP,
  accepted_at TIMESTAMP,
  delivered_at TIMESTAMP,
  last_event VARCHAR(32),
  last_event_at TIMESTAMP,
  last_error VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_campaign_recipients_campaign_email_unique
    UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_batch_status_idx
  ON marketing_campaign_recipients(batch_id, status);

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_prospect_idx
  ON marketing_campaign_recipients(prospect_id);

CREATE TABLE IF NOT EXISTS sendgrid_campaign_webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL UNIQUE,
  recipient_id INTEGER REFERENCES marketing_campaign_recipients(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMP,
  received_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sendgrid_campaign_webhook_recipient_idx
  ON sendgrid_campaign_webhook_events(recipient_id, event_type);
