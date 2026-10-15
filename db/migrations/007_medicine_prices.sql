CREATE TABLE IF NOT EXISTS medicine_prices (
  drug_code text NOT NULL,
  license_number text REFERENCES medicines(license_number) ON DELETE SET NULL,
  drug_name text NOT NULL,
  specification text NOT NULL DEFAULT '',
  price numeric(12, 4) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'TWD',
  price_type text NOT NULL DEFAULT 'nhi-reimbursement',
  effective_from date NOT NULL,
  effective_until date,
  change_status text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_updated_at timestamptz NOT NULL,
  UNIQUE (drug_code, effective_from, price_type),
  CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS drug_name text NOT NULL DEFAULT '';
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS specification text NOT NULL DEFAULT '';
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS effective_from date;
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS effective_until date;
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS change_status text NOT NULL DEFAULT '';
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS source_sha256 text NOT NULL DEFAULT repeat('0', 64);
ALTER TABLE medicine_prices ADD COLUMN IF NOT EXISTS license_number text REFERENCES medicines(license_number) ON DELETE SET NULL;
ALTER TABLE medicine_prices ALTER COLUMN source_url SET DEFAULT '';
UPDATE medicine_prices SET effective_from = COALESCE(effective_from, source_updated_at::date) WHERE effective_from IS NULL;
ALTER TABLE medicine_prices ALTER COLUMN effective_from SET NOT NULL;
ALTER TABLE medicine_prices DROP CONSTRAINT IF EXISTS medicine_prices_license_number_drug_code_price_type_key;
ALTER TABLE medicine_prices DROP CONSTRAINT IF EXISTS medicine_prices_source_sha256_check;
ALTER TABLE medicine_prices ADD CONSTRAINT medicine_prices_source_sha256_check CHECK (source_sha256 ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS medicine_prices_drug_from_type_key
  ON medicine_prices (drug_code, effective_from, price_type);

CREATE INDEX IF NOT EXISTS medicine_prices_license_effective_idx
  ON medicine_prices (license_number, effective_from DESC)
  WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS medicine_prices_drug_effective_idx
  ON medicine_prices (drug_code, effective_from DESC);
