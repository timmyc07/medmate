ALTER TABLE medicines ADD COLUMN IF NOT EXISTS usage_dosage text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS medicine_ingredients (
  license_number text NOT NULL REFERENCES medicines(license_number) ON DELETE CASCADE,
  component_index integer NOT NULL CHECK (component_index > 0),
  prescription_label text NOT NULL DEFAULT '',
  ingredient_name text NOT NULL DEFAULT '',
  ingredient_code text NOT NULL DEFAULT '',
  content_description text NOT NULL DEFAULT '',
  content_value text NOT NULL DEFAULT '',
  content_unit text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL,
  PRIMARY KEY (license_number, component_index)
);
CREATE INDEX IF NOT EXISTS medicine_ingredients_name_idx ON medicine_ingredients (ingredient_name);

CREATE TABLE IF NOT EXISTS medicine_safety_communications (
  message_id text PRIMARY KEY CHECK (message_id ~ '^[0-9a-f]{64}$'),
  publication_date date NOT NULL,
  ingredient text NOT NULL DEFAULT '',
  scope_text text NOT NULL DEFAULT '',
  indications text NOT NULL DEFAULT '',
  mechanism text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  safety_analysis text NOT NULL DEFAULT '',
  tfda_communication text NOT NULL DEFAULT '',
  link_method text NOT NULL CHECK (link_method IN ('exact-license-text', 'announcement-only')),
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS medicine_safety_date_idx ON medicine_safety_communications (publication_date DESC);

CREATE TABLE IF NOT EXISTS medicine_safety_license_links (
  message_id text NOT NULL REFERENCES medicine_safety_communications(message_id) ON DELETE CASCADE,
  license_number text NOT NULL REFERENCES medicines(license_number) ON DELETE CASCADE,
  link_method text NOT NULL CHECK (link_method = 'exact-license-text'),
  evidence text NOT NULL DEFAULT '',
  PRIMARY KEY (message_id, license_number)
);
CREATE INDEX IF NOT EXISTS medicine_safety_license_idx ON medicine_safety_license_links (license_number);
