-- ============================================================================
-- MIGRATION: Convert parking space occupancy views to materialized views
-- ============================================================================
-- Problem: The `latest_space_occupancy` view does a DISTINCT ON over the entire
-- parking_space_occupancy_snapshots table on every query, causing timeouts.
--
-- Solution: Convert to materialized view with time filter, matching the pattern
-- used for metered carparks (latest_metered_carpark_occupancy).
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING VIEWS
-- ============================================================================
-- Must drop in order due to dependencies

DROP VIEW IF EXISTS latest_space_occupancy_with_location CASCADE;
DROP VIEW IF EXISTS latest_space_occupancy CASCADE;

-- ============================================================================
-- 2. CREATE MATERIALIZED VIEW FOR LATEST OCCUPANCY
-- ============================================================================

CREATE MATERIALIZED VIEW latest_space_occupancy AS
SELECT DISTINCT ON (feature_id)
  id,
  feature_id,
  parking_space_id,
  occupancy_status,
  occupancy_date_changed,
  ingested_at,
  is_valid,
  is_vacant,
  -- Flag records as stale if last update was > 2 hours ago
  (occupancy_date_changed < NOW() - INTERVAL '2 hours') as is_stale
FROM parking_space_occupancy_snapshots
WHERE is_valid = true
  -- OPTIMIZATION: Only look at last 2 hours of data for performance
  AND ingested_at >= NOW() - INTERVAL '2 hours'
ORDER BY feature_id, ingested_at DESC;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_latest_space_occupancy_pk ON latest_space_occupancy(feature_id);

-- ============================================================================
-- 3. CREATE MATERIALIZED VIEW WITH LOCATION JOIN
-- ============================================================================

CREATE MATERIALIZED VIEW latest_space_occupancy_with_location AS
SELECT
  -- IDs
  o.feature_id,
  o.parking_space_id,

  -- Location
  s.latitude,
  s.longitude,

  -- Location names (English)
  s.region,
  s.district,
  s.sub_district,
  s.street,
  s.section_of_street,

  -- Location names (Traditional Chinese)
  s.region_tc,
  s.district_tc,
  s.sub_district_tc,
  s.street_tc,
  s.section_of_street_tc,

  -- Location names (Simplified Chinese)
  s.region_sc,
  s.district_sc,
  s.sub_district_sc,
  s.street_sc,
  s.section_of_street_sc,

  -- Vehicle info
  s.vehicle_type,

  -- Occupancy status
  o.occupancy_status,
  o.is_vacant,
  o.occupancy_date_changed,
  o.is_stale
FROM latest_space_occupancy o
JOIN parking_space_info s ON o.parking_space_id = s.parking_space_id;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_latest_space_occupancy_with_location_pk ON latest_space_occupancy_with_location(feature_id);

-- ============================================================================
-- 4. CREATE REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_latest_space_occupancy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set a longer statement timeout for this operation (30 seconds)
  SET LOCAL statement_timeout = '30s';

  -- Refresh base view first
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_space_occupancy;

  -- Then refresh the joined view
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_space_occupancy_with_location;

  -- Reset to default timeout
  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing parking space views: %', SQLERRM;
  RESET statement_timeout;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_latest_space_occupancy() TO anon;
GRANT EXECUTE ON FUNCTION refresh_latest_space_occupancy() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_latest_space_occupancy() TO service_role;

-- ============================================================================
-- 5. GRANT SELECT ON MATERIALIZED VIEWS
-- ============================================================================

GRANT SELECT ON latest_space_occupancy TO anon;
GRANT SELECT ON latest_space_occupancy TO authenticated;
GRANT SELECT ON latest_space_occupancy_with_location TO anon;
GRANT SELECT ON latest_space_occupancy_with_location TO authenticated;

-- ============================================================================
-- 6. INITIAL REFRESH
-- ============================================================================

SELECT refresh_latest_space_occupancy();

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW latest_space_occupancy IS
  'Materialized view of latest valid occupancy status for each parking space. Time-filtered for performance. Refreshed every 5 minutes by cron job.';

COMMENT ON MATERIALIZED VIEW latest_space_occupancy_with_location IS
  'Latest occupancy joined with location data - main API view. Refreshed every 5 minutes by cron job.';

COMMENT ON FUNCTION refresh_latest_space_occupancy() IS
  'Refreshes the parking space occupancy materialized views with extended timeout (30s)';
