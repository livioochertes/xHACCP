import { pool } from './db.js';

export interface InvoiceCounter {
  market: string;
  series: string;
  currentNumber: number;
}

/**
 * Atomically increments the invoice counter for a given market and returns the next number.
 * Uses a DB-level UPDATE ... RETURNING for concurrency safety.
 */
export async function getNextInvoiceNumber(market: string): Promise<{ series: string; number: number; formatted: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure row exists
    await client.query(
      `INSERT INTO invoice_counters (market, series, current_number)
       VALUES ($1, $2, 0)
       ON CONFLICT (market) DO NOTHING`,
      [market, market === 'fr' ? 'FACT' : market === 'com' ? 'INV' : 'KTO']
    );

    const result = await client.query(
      `UPDATE invoice_counters
       SET current_number = current_number + 1,
           updated_at = NOW()
       WHERE market = $1
       RETURNING series, current_number`,
      [market]
    );

    await client.query('COMMIT');

    const row = result.rows[0];
    const series = row.series as string;
    const number = row.current_number as number;
    const year = new Date().getFullYear();
    const padded = String(number).padStart(6, '0');
    const formatted = `${series}-${year}-${padded}`;

    return { series, number, formatted };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update the series for a market (admin configurable).
 */
export async function setInvoiceSeries(market: string, series: string): Promise<void> {
  await pool.query(
    `INSERT INTO invoice_counters (market, series, current_number)
     VALUES ($1, $2, 0)
     ON CONFLICT (market) DO UPDATE SET series = $2, updated_at = NOW()`,
    [market, series]
  );
}

/**
 * Reset counter to a given number (admin use).
 */
export async function setInvoiceCurrentNumber(market: string, number: number): Promise<void> {
  await pool.query(
    `UPDATE invoice_counters SET current_number = $2, updated_at = NOW() WHERE market = $1`,
    [market, number]
  );
}

/**
 * Get current counter state for all markets.
 */
export async function getAllInvoiceCounters(): Promise<InvoiceCounter[]> {
  const result = await pool.query(
    `SELECT market, series, current_number as "currentNumber" FROM invoice_counters ORDER BY market`
  );
  return result.rows;
}
