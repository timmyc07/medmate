CREATE TABLE IF NOT EXISTS retail_crawl_queue (
  source_id uuid NOT NULL REFERENCES medicine_price_sources(source_id) ON DELETE CASCADE,
  product_url text NOT NULL,
  round_id uuid NOT NULL,
  product_index integer NOT NULL CHECK (product_index > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','unavailable')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz,
  last_error text,
  PRIMARY KEY (source_id, product_url)
);

CREATE INDEX IF NOT EXISTS retail_crawl_queue_pending_idx
  ON retail_crawl_queue (round_id, source_id, last_attempt_at NULLS FIRST, product_index)
  WHERE status = 'pending';

-- Positional cursors can already have skipped products; start one complete snapshot round.
DROP TABLE IF EXISTS retail_crawl_state;
