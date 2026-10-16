ALTER TABLE medicine_price_sources
  ADD COLUMN IF NOT EXISTS crawl_not_before timestamptz;
