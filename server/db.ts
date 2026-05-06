import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Prevent unhandled 'error' events from crashing Node.js process
pool.on('error', (err) => {
  console.error('[DB Pool] Eroare conexiune (recuperabilă):', err.message);
});

export const db = drizzle({ client: pool, schema });

const KEEP_ALIVE_INTERVAL_MS = 3 * 60 * 1000;

export function startDbKeepAlive() {
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.warn('[DB Keep-Alive] ping eșuat, Neon se trezește...', (err as Error).message);
    }
  }, KEEP_ALIVE_INTERVAL_MS);
  console.log('[DB Keep-Alive] Activ — ping la fiecare 3 minute');
}
