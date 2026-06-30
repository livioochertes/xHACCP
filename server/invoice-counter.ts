import { pool } from './db.js';

export interface InvoiceCounter {
  market: string;
  series: string;
  currentNumber: number;
}

/**
 * Get the configured series for a market from company_settings (if set), otherwise fall back to default.
 * This allows per-market invoice series to be driven by company_settings.invoice_series.
 */
async function getSeriesFromCompanySettings(market: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT invoice_series FROM company_settings WHERE market_code = $1 AND invoice_series IS NOT NULL AND invoice_series != '' LIMIT 1`,
      [market]
    );
    return result.rows[0]?.invoice_series || null;
  } catch {
    return null;
  }
}

/**
 * Get the configured number format from company_settings (if set).
 * Supported format tokens: {SERIES}, {YEAR}, {NNNNNN} (with N-count for padding).
 * Default format: {SERIES}-{YEAR}-{NNNNNN}
 */
function applyNumberFormat(format: string | null, series: string, number: number): string {
  const year = new Date().getFullYear();
  const padded = String(number).padStart(6, '0');

  if (!format || format === 'YYYY-NNNNNN') {
    // Default format
    return `${series}-${year}-${padded}`;
  }

  // Support configurable format tokens
  return format
    .replace('{SERIES}', series)
    .replace('{YEAR}', String(year))
    .replace(/\{N+\}/g, (match) => String(number).padStart(match.length - 2, '0'));
}

/**
 * Atomically increments the invoice counter for a given market and returns the next number.
 * Series is driven by company_settings.invoice_series (if configured) with fallback to invoice_counters.series.
 * Format is driven by company_settings.invoice_number_format with fallback to default "{SERIES}-{YEAR}-{NNNNNN}".
 * Uses a DB-level UPDATE ... RETURNING for concurrency safety.
 */
export async function getNextInvoiceNumber(market: string): Promise<{ series: string; number: number; formatted: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if company_settings overrides the series for this market
    const companySeries = await getSeriesFromCompanySettings(market);
    const defaultSeries = market === 'fr' ? 'FACT' : market === 'com' ? 'INV' : 'KTO';
    const seriesToUse = companySeries || defaultSeries;

    // Get number format from company_settings
    let numberFormat: string | null = null;
    try {
      const fmtResult = await client.query(
        `SELECT invoice_number_format FROM company_settings WHERE market_code = $1 AND invoice_number_format IS NOT NULL AND invoice_number_format != '' LIMIT 1`,
        [market]
      );
      numberFormat = fmtResult.rows[0]?.invoice_number_format || null;
    } catch { /* ignore */ }

    // Ensure row exists with correct series
    await client.query(
      `INSERT INTO invoice_counters (market, series, current_number)
       VALUES ($1, $2, 0)
       ON CONFLICT (market) DO NOTHING`,
      [market, seriesToUse]
    );

    // If company_settings overrides series, keep counter series in sync
    if (companySeries) {
      await client.query(
        `UPDATE invoice_counters SET series = $2 WHERE market = $1 AND series != $2`,
        [market, companySeries]
      );
    }

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
    const formatted = applyNumberFormat(numberFormat, series, number);

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
