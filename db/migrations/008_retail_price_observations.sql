CREATE TABLE IF NOT EXISTS medicine_price_sources (
  source_id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  source_kind text NOT NULL CHECK (source_kind IN ('ecommerce','pharmacy','hospital')),
  base_url text NOT NULL,
  terms_url text NOT NULL DEFAULT '',
  robots_checked_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source_updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS medicine_price_observations (
  observation_id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES medicine_price_sources(source_id) ON DELETE CASCADE,
  external_product_id text NOT NULL,
  product_name text NOT NULL,
  specification_raw text NOT NULL DEFAULT '',
  listed_price numeric(12,2) CHECK (listed_price > 0),
  sale_price numeric(12,2) NOT NULL CHECK (sale_price > 0),
  currency text NOT NULL DEFAULT 'TWD',
  captured_at timestamptz NOT NULL,
  captured_date date NOT NULL,
  product_url text NOT NULL,
  availability text NOT NULL DEFAULT 'unknown',
  match_method text NOT NULL DEFAULT 'none' CHECK (match_method IN ('none','exact-license','exact-drug-code','manual')),
  license_number text REFERENCES medicines(license_number) ON DELETE SET NULL,
  drug_code text,
  match_confidence numeric(4,3) CHECK (match_confidence >= 0 AND match_confidence <= 1),
  raw_payload_hash text NOT NULL CHECK (raw_payload_hash ~ '^[0-9a-f]{64}$'),
  parser_version text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS medicine_price_observations_source_product_day_key
  ON medicine_price_observations (source_id, external_product_id, captured_date);

CREATE INDEX IF NOT EXISTS medicine_price_observations_license_idx ON medicine_price_observations (license_number, captured_at DESC) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS medicine_price_observations_source_idx ON medicine_price_observations (source_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS medicine_price_matches (
  observation_id uuid PRIMARY KEY REFERENCES medicine_price_observations(observation_id) ON DELETE CASCADE,
  license_number text NOT NULL REFERENCES medicines(license_number) ON DELETE CASCADE,
  match_method text NOT NULL CHECK (match_method IN ('exact-license','exact-drug-code','manual')),
  status text NOT NULL CHECK (status IN ('approved','rejected','pending')) DEFAULT 'pending',
  evidence_url text NOT NULL,
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE OR REPLACE VIEW medicine_price_90d_stats AS
SELECT m.license_number, o.currency, count(*)::int AS observation_count,
       count(DISTINCT o.source_id)::int AS source_count,
       round(avg(o.sale_price), 2) AS average_price,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY o.sale_price) AS median_price,
       min(o.sale_price) AS minimum_price, max(o.sale_price) AS maximum_price
FROM medicine_price_observations o
JOIN medicine_price_matches m ON m.observation_id = o.observation_id AND m.status = 'approved'
WHERE o.captured_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' AND o.sale_price > 0
GROUP BY m.license_number, o.currency;
