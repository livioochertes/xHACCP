CREATE TABLE IF NOT EXISTS ai_recommendation_campaigns (
  id SERIAL PRIMARY KEY,
  market VARCHAR(10) NOT NULL,
  product_ids JSONB NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_recommendation_campaign_market_dates_idx
  ON ai_recommendation_campaigns (market, starts_at, ends_at);