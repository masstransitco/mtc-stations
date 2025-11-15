-- Data Quality Improvements Migration
-- Adds is_valid flag, staleness detection, and helper views

-- Add is_valid column to flag records with actual data (vacancy >= 0)
ALTER TABLE parking_vacancy_snapshots
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN GENERATED ALWAYS AS (vacancy >= 0) STORED;

-- Note: is_stale is calculated dynamically in views since NOW() is not immutable
-- We'll use lastupdate timestamp comparison in queries instead

-- Create index on is_valid for faster queries
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_is_valid
  ON parking_vacancy_snapshots(is_valid);

-- Create index on lastupdate for staleness queries
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_lastupdate_recent
  ON parking_vacancy_snapshots(lastupdate DESC);

-- Composite index for latest valid vacancy queries
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_valid_latest
  ON parking_vacancy_snapshots(park_id, vehicle_type, is_valid, ingested_at DESC)
  WHERE is_valid = true;

-- View: Latest vacancy snapshot for all car parks (includes invalid data)
CREATE OR REPLACE VIEW latest_parking_vacancy AS
SELECT DISTINCT ON (park_id, vehicle_type)
  id,
  park_id,
  vehicle_type,
  vacancy_type,
  vacancy,
  vacancy_dis,
  vacancy_ev,
  vacancy_unl,
  category,
  lastupdate,
  ingested_at,
  is_valid,
  (lastupdate < NOW() - INTERVAL '2 hours') as is_stale,
  created_at
FROM parking_vacancy_snapshots
ORDER BY park_id, vehicle_type, ingested_at DESC;

-- View: Latest VALID vacancy only (filters out vacancy = -1)
CREATE OR REPLACE VIEW latest_valid_parking_vacancy AS
SELECT DISTINCT ON (park_id, vehicle_type)
  id,
  park_id,
  vehicle_type,
  vacancy_type,
  vacancy,
  vacancy_dis,
  vacancy_ev,
  vacancy_unl,
  category,
  lastupdate,
  ingested_at,
  (lastupdate < NOW() - INTERVAL '2 hours') as is_stale,
  created_at
FROM parking_vacancy_snapshots
WHERE is_valid = true
ORDER BY park_id, vehicle_type, ingested_at DESC;

-- View: Data quality metrics by ingestion batch
CREATE OR REPLACE VIEW ingestion_quality_metrics AS
SELECT
  DATE_TRUNC('minute', ingested_at) as ingestion_time,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_valid = true) as valid_records,
  COUNT(*) FILTER (WHERE is_valid = false) as offline_records,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_valid = false) / COUNT(*), 2) as offline_percent,
  COUNT(*) FILTER (WHERE lastupdate < NOW() - INTERVAL '2 hours') as stale_records,
  COUNT(DISTINCT park_id) as unique_carparks,
  COUNT(DISTINCT park_id) FILTER (WHERE is_valid = true) as carparks_with_valid_data
FROM parking_vacancy_snapshots
GROUP BY DATE_TRUNC('minute', ingested_at)
ORDER BY ingestion_time DESC;

-- View: Current availability summary by vehicle type
CREATE OR REPLACE VIEW current_availability_by_vehicle_type AS
SELECT
  vehicle_type,
  COUNT(*) as total_carparks,
  COUNT(*) FILTER (WHERE vacancy_type = 'A' AND vacancy > 0) as available_type_a,
  COUNT(*) FILTER (WHERE vacancy_type = 'B' AND vacancy = 1) as available_type_b,
  COUNT(*) FILTER (WHERE vacancy_type = 'C') as closed_type_c,
  COUNT(*) FILTER (WHERE vacancy = -1) as offline,
  SUM(CASE WHEN vacancy_type = 'A' AND vacancy > 0 THEN vacancy ELSE 0 END) as total_available_spaces
FROM latest_parking_vacancy
GROUP BY vehicle_type
ORDER BY vehicle_type;

-- Add comments
COMMENT ON COLUMN parking_vacancy_snapshots.is_valid IS 'True when vacancy >= 0 (actual data available), False when vacancy = -1 (offline/unknown)';

COMMENT ON VIEW latest_parking_vacancy IS 'Most recent vacancy snapshot for each car park and vehicle type (includes offline data)';
COMMENT ON VIEW latest_valid_parking_vacancy IS 'Most recent VALID vacancy snapshot (excludes vacancy = -1)';
COMMENT ON VIEW ingestion_quality_metrics IS 'Data quality metrics grouped by ingestion batch';
COMMENT ON VIEW current_availability_by_vehicle_type IS 'Current availability summary by vehicle type';
