-- 藥品平民化查詢的補充索引。
-- 口語症狀只接受可追溯的來源或人工核對資料；不從藥名推測療效。
CREATE TABLE IF NOT EXISTS medicine_symptoms (
  license_number text NOT NULL REFERENCES medicines(license_number) ON DELETE CASCADE,
  symptom text NOT NULL CHECK (length(btrim(symptom)) > 0),
  source_kind text NOT NULL CHECK (source_kind IN ('tfda-indication', 'curated-alias')),
  source_text text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL,
  PRIMARY KEY (license_number, symptom)
);

CREATE INDEX IF NOT EXISTS medicine_symptoms_symptom_idx
  ON medicine_symptoms (lower(symptom), license_number);

-- 價格必須以完整藥證字號精確配對；若官方來源只有健保代碼，先保存代碼，
-- 不以品名或數字尾碼猜測藥證關係。
CREATE TABLE IF NOT EXISTS medicine_prices (
  license_number text REFERENCES medicines(license_number) ON DELETE CASCADE,
  drug_code text,
  price numeric(12, 4) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'TWD',
  price_type text NOT NULL DEFAULT 'nhi-reimbursement',
  source_url text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL,
  CHECK (license_number IS NOT NULL OR drug_code IS NOT NULL),
  UNIQUE (license_number, drug_code, price_type)
);

CREATE INDEX IF NOT EXISTS medicine_prices_license_idx
  ON medicine_prices (license_number) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS medicine_prices_drug_code_idx
  ON medicine_prices (drug_code) WHERE drug_code IS NOT NULL;
