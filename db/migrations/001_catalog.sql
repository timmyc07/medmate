CREATE TABLE IF NOT EXISTS source_imports (
  dataset_key text PRIMARY KEY,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer NOT NULL CHECK (row_count >= 0),
  batch_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_registry_fda (
  institution_name text NOT NULL,
  institution_status text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  street_address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  is_nhi_contracted boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz NOT NULL,
  PRIMARY KEY (institution_name, city, district, street_address)
);

CREATE TABLE IF NOT EXISTS pharmacy_contracts (
  institution_code text PRIMARY KEY,
  institution_name text NOT NULL,
  institution_type text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  service_area text NOT NULL DEFAULT '',
  contract_type text NOT NULL DEFAULT '',
  services text NOT NULL DEFAULT '',
  opening_hours text,
  termination_date date,
  contract_start_date date,
  source_updated_at timestamptz NOT NULL,
  latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  geocoded_at timestamptz,
  geocode_provider text
);
CREATE INDEX IF NOT EXISTS pharmacy_contracts_name_idx ON pharmacy_contracts (institution_name);
CREATE INDEX IF NOT EXISTS pharmacy_contracts_address_idx ON pharmacy_contracts (address);
CREATE INDEX IF NOT EXISTS pharmacy_contracts_termination_idx ON pharmacy_contracts (termination_date);
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS geocode_provider text;
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS opening_hours text;
CREATE INDEX IF NOT EXISTS pharmacy_contracts_coordinates_idx ON pharmacy_contracts (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS medicines (
  license_number text PRIMARY KEY,
  cancellation_status text NOT NULL DEFAULT '',
  cancellation_date date,
  cancellation_reason text NOT NULL DEFAULT '',
  valid_until date,
  name text NOT NULL,
  english_name text NOT NULL DEFAULT '',
  indications text NOT NULL DEFAULT '',
  dosage_form text NOT NULL DEFAULT '',
  applicant_name text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS medicines_name_idx ON medicines (name);
CREATE INDEX IF NOT EXISTS medicines_validity_idx ON medicines (valid_until, cancellation_status);
