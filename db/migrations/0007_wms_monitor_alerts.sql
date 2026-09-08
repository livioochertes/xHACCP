-- Durable state for the scheduled WMS credential monitor. It contains only
-- check names, safe failure fingerprints, and timestamps; never API keys.
CREATE TABLE IF NOT EXISTS wms_monitor_alerts (
  check_name VARCHAR(40) PRIMARY KEY,
  status VARCHAR(16) NOT NULL,
  failure_fingerprint VARCHAR(160),
  first_failed_at TIMESTAMP,
  last_checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_alerted_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);