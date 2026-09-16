-- Configurable WMS shipping origins, currently required for French MyFlyingBox orders.
CREATE TABLE IF NOT EXISTS wms_origin_addresses (
  id SERIAL PRIMARY KEY,
  market VARCHAR(10) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(2) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);