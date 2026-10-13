CREATE TABLE IF NOT EXISTS sendgrid_campaign_history_imports (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL UNIQUE REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'running',
  provider_message_count INTEGER NOT NULL DEFAULT 0,
  processed_message_count INTEGER NOT NULL DEFAULT 0,
  matched_message_count INTEGER NOT NULL DEFAULT 0,
  unmatched_message_count INTEGER NOT NULL DEFAULT 0,
  imported_event_count INTEGER NOT NULL DEFAULT 0,
  skipped_event_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sendgrid_campaign_history_imports_status_idx
  ON sendgrid_campaign_history_imports(status, updated_at);
