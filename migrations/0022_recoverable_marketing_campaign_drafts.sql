ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS marketing_campaigns_deleted_at_idx
  ON marketing_campaigns(deleted_at);
