import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function startDbKeepAlive() {
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.warn('[DB Keep-Alive] ping eșuat, Neon se trezește...', (err as Error).message);
    }
  }, KEEP_ALIVE_INTERVAL_MS);
  console.log('[DB Keep-Alive] Activ — ping la fiecare 4 minute');
}