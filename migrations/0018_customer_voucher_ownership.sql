ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS activation_months INTEGER,
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS vouchers_owner_user_idx
  ON vouchers(owner_user_id);

CREATE TABLE IF NOT EXISTS customer_password_setup_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_password_setup_tokens_user_idx
  ON customer_password_setup_tokens(user_id);
