CREATE TABLE IF NOT EXISTS nhi_medicine_catalog (
  drug_code text PRIMARY KEY,
  name text NOT NULL,
  english_name text NOT NULL DEFAULT '',
  ingredient text NOT NULL DEFAULT '',
  dosage_form text NOT NULL DEFAULT '',
  fda_license_id text,
  source_updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS medicine_usage (
  fee_year smallint NOT NULL CHECK (fee_year BETWEEN 100 AND 200),
  drug_code text NOT NULL REFERENCES nhi_medicine_catalog(drug_code),
  reporting_period_start text NOT NULL CHECK (reporting_period_start ~ '^[0-9]{5}$'),
  reporting_period_end text NOT NULL CHECK (reporting_period_end ~ '^[0-9]{5}$'),
  claim_quantity numeric(16, 1) NOT NULL CHECK (claim_quantity >= 0),
  package_claim_quantity numeric(16, 1) NOT NULL CHECK (package_claim_quantity >= 0),
  source_updated_at timestamptz NOT NULL,
  PRIMARY KEY (fee_year, drug_code)
);

CREATE INDEX IF NOT EXISTS medicine_usage_rank_idx
  ON medicine_usage (fee_year, package_claim_quantity DESC, drug_code ASC);

CREATE TABLE IF NOT EXISTS medicine_appearances (
  license_number text PRIMARY KEY,
  shape text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  imprint text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS medicine_usage_imports (
  fee_year smallint PRIMARY KEY,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer NOT NULL CHECK (row_count >= 0),
  reporting_period_start text NOT NULL,
  reporting_period_end text NOT NULL,
  batch_id uuid NOT NULL
);
