ALTER TABLE sendgrid_campaign_webhook_events
  ADD COLUMN IF NOT EXISTS event_source VARCHAR(24) NOT NULL DEFAULT 'webhook';

UPDATE sendgrid_campaign_webhook_events
SET event_source = 'application'
WHERE event_type = 'app_unsubscribe';

CREATE INDEX IF NOT EXISTS sendgrid_campaign_webhook_source_idx
  ON sendgrid_campaign_webhook_events(recipient_id, event_source, event_type);
