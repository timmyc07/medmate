CREATE TABLE IF NOT EXISTS retail_crawl_state (
  source_id uuid PRIMARY KEY REFERENCES medicine_price_sources(source_id) ON DELETE CASCADE,
  sitemap_index integer NOT NULL DEFAULT 0 CHECK (sitemap_index >= 0),
  product_offset integer NOT NULL DEFAULT 0 CHECK (product_offset >= 0),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
