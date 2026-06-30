-- Migration: Invoice multi-market support
-- Applied: 2026-06-30
-- Description: Adds market, PDF, e-Factura, and external_ref fields to invoices;
--              adds invoice numbering config to company_settings;
--              creates invoice_counters table for per-market sequential numbering.

-- Invoices table: new columns for multi-market support
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS market VARCHAR(10) DEFAULT 'ro';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS efactura_status VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS efactura_ref TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_ref TEXT;

-- Company settings: per-company invoice numbering configuration
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_series VARCHAR(20) DEFAULT 'FACT';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_number_format VARCHAR(50) DEFAULT 'YYYY-NNNNNN';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_current_number INTEGER DEFAULT 0;

-- Invoice counters: per-market sequential numbering (fr=FACT, com=INV, ro=KTO via Smartbill)
CREATE TABLE IF NOT EXISTS invoice_counters (
  id SERIAL PRIMARY KEY,
  market VARCHAR(10) NOT NULL UNIQUE,
  series VARCHAR(20) NOT NULL DEFAULT 'FACT',
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default counters if not present
INSERT INTO invoice_counters (market, series, current_number)
VALUES ('ro', 'KTO', 0), ('fr', 'FACT', 0), ('com', 'INV', 0)
ON CONFLICT (market) DO NOTHING;
