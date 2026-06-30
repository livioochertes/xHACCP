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
    console.log('DB migration OK');
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch(e => { console.error('Migration error:', e.message); process.exit(1); });
"
