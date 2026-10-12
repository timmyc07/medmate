CREATE TABLE IF NOT EXISTS pharmacy_coordinate_candidates (
  institution_code text NOT NULL REFERENCES pharmacy_contracts(institution_code) ON DELETE CASCADE,
  candidate_index integer NOT NULL CHECK (candidate_index > 0),
  response_address text NOT NULL DEFAULT '',
  latitude double precision NOT NULL CHECK (latitude BETWEEN 21.5 AND 26.5),
  longitude double precision NOT NULL CHECK (longitude BETWEEN 118 AND 123),
  geocoded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (institution_code, candidate_index)
);

CREATE INDEX IF NOT EXISTS pharmacy_coordinate_candidates_location_idx
  ON pharmacy_coordinate_candidates (latitude, longitude);
