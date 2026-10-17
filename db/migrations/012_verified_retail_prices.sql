CREATE TABLE IF NOT EXISTS medicine_retail_license_verifications (
  license_number text PRIMARY KEY REFERENCES medicines(license_number) ON DELETE CASCADE,
  drug_category text NOT NULL,
  package_description text NOT NULL,
  valid_until date,
  cancelled boolean NOT NULL,
  verified_at timestamptz NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$')
);

ALTER TABLE medicine_price_matches ADD COLUMN IF NOT EXISTS specification text;
ALTER TABLE medicine_price_matches ADD COLUMN IF NOT EXISTS evidence jsonb;
ALTER TABLE medicine_price_matches ADD COLUMN IF NOT EXISTS license_source_sha256 text;
ALTER TABLE medicine_price_observations ADD COLUMN IF NOT EXISTS sku_id text;
ALTER TABLE retail_crawl_queue DROP CONSTRAINT IF EXISTS retail_crawl_queue_status_check;
ALTER TABLE retail_crawl_queue ADD CONSTRAINT retail_crawl_queue_status_check CHECK (status IN ('pending','succeeded','unavailable','excluded'));
CREATE INDEX IF NOT EXISTS medicine_price_observations_latest_url_idx
  ON medicine_price_observations (source_id, product_url, captured_at DESC);

-- 保留舊觀測供稽核，但停止全商城來源；新來源使用獨立的藥品限定清單。
UPDATE medicine_price_sources SET active=false
WHERE source_id IN ('f7c48f30-3c3c-4b09-9b0d-0d6e0e10ad01','48d8bf3d-3c42-40d0-a94f-37d91b00f6a2');
-- 此未使用的 view 混合不同包裝，不能作為藥品售價。
DROP VIEW IF EXISTS medicine_price_90d_stats;
