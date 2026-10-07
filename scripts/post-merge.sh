#!/bin/bash
set -e
npm install
# Run safe non-interactive DB migration (avoids drizzle-kit interactive prompts)
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function migrate() {
  const client = await pool.connect();
  try {
    // Apply any pending schema changes safely (idempotent)
    await client.query(\`
      DO \$\$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'invoice_counters_market_unique'
        ) THEN
          ALTER TABLE invoice_counters ADD CONSTRAINT invoice_counters_market_unique UNIQUE (market);
        END IF;
      END \$\$;
    \`);
    await client.query(\`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE vouchers
        ADD COLUMN IF NOT EXISTS activation_months INTEGER,
        ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
      CREATE INDEX IF NOT EXISTS vouchers_owner_user_idx ON vouchers(owner_user_id);
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
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS paypal_checkout_attempt_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS paypal_checkout_fingerprint VARCHAR(64);
      CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_checkout_attempt_id_unique
        ON orders(paypal_checkout_attempt_id);
    \`);
    console.log('DB migration OK');
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch(e => { console.error('Migration error:', e.message); process.exit(1); });
"
