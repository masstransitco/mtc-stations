-- Fix: Add time window to latest_valid_parking_vacancy to prevent full table scan
-- Issue: The view had no ingested_at filter, causing it to scan 1.7M rows on every refresh
-- This caused statement_timeout errors in the cron jobs

-- Must drop dependent view first
DROP MATERIALIZED VIEW IF EXISTS latest_vacancy_with_location;
DROP MATERIALIZED VIEW IF EXISTS latest_valid_parking_vacancy;

-- Recreate with time filter (1 hour window like latest_parking_vacancy)
CREATE MATERIALIZED VIEW latest_valid_parking_vacancy AS
SELECT DISTINCT ON (park_id, vehicle_type)
  id, park_id, vehicle_type, vacancy_type, vacancy,
  vacancy_dis, vacancy_ev, vacancy_unl, category,
  lastupdate, ingested_at,
  (lastupdate < (now() - '02:00:00'::interval)) AS is_stale,
  created_at
FROM parking_vacancy_snapshots
WHERE is_valid = true
  AND ingested_at >= NOW() - INTERVAL '1 hour'  -- ADD TIME FILTER
ORDER BY park_id, vehicle_type, ingested_at DESC;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_latest_valid_parking_vacancy_pk
ON latest_valid_parking_vacancy(park_id, vehicle_type);

-- Recreate dependent view
CREATE MATERIALIZED VIEW latest_vacancy_with_location AS
SELECT
  v.park_id, c.name, c.display_address, c.latitude, c.longitude,
  c.district, c.opening_status, c.contact_no, v.vehicle_type,
  v.vacancy_type, v.vacancy, v.vacancy_dis, v.vacancy_ev,
  v.vacancy_unl, v.category, v.lastupdate, v.ingested_at, v.is_stale
FROM latest_valid_parking_vacancy v
JOIN carpark_info c ON v.park_id = c.park_id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_latest_vacancy_with_location_pk
ON latest_vacancy_with_location(park_id, vehicle_type);

COMMENT ON MATERIALIZED VIEW latest_valid_parking_vacancy IS
  'Latest valid parking vacancy per park_id/vehicle_type. Only scans last 1 hour of data.';

COMMENT ON MATERIALIZED VIEW latest_vacancy_with_location IS
  'Latest valid parking vacancy with location info joined from carpark_info.';
