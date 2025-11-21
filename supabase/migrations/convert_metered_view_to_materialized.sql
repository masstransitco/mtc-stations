-- Migration: Convert metered carpark view to materialized view with refresh function
-- Description: Fixes timeout issues by using materialized view instead of regular view
-- Date: 2025-11-19

-- ============================================================================
-- 1. DROP THE EXISTING VIEW
-- ============================================================================

DROP VIEW IF EXISTS latest_metered_carpark_occupancy CASCADE;

-- ============================================================================
-- 2. CREATE MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW latest_metered_carpark_occupancy AS
WITH latest_spaces AS (
  SELECT DISTINCT ON (parking_space_id)
    parking_space_id,
    occupancy_status,
    is_vacant,
    occupancy_date_changed,
    ingested_at
  FROM metered_space_occupancy_snapshots
  WHERE is_valid = true
  ORDER BY parking_space_id, ingested_at DESC
)
SELECT
  c.carpark_id,
  c.name,
  c.name_tc,
  c.district,
  c.district_tc,
  c.latitude,
  c.longitude,
  c.total_spaces,
  COUNT(s.parking_space_id) as tracked_spaces,
  COUNT(ls.parking_space_id) as spaces_with_data,
  SUM(CASE WHEN ls.is_vacant THEN 1 ELSE 0 END) as vacant_spaces,
  SUM(CASE WHEN NOT ls.is_vacant THEN 1 ELSE 0 END) as occupied_spaces,
  ROUND(
    COALESCE(
      SUM(CASE WHEN ls.is_vacant THEN 1 ELSE 0 END)::numeric /
      NULLIF(COUNT(ls.parking_space_id), 0) * 100,
      0
    ),
    1
  ) as vacancy_rate,
  MAX(ls.ingested_at) as last_updated
FROM metered_carpark_info c
LEFT JOIN metered_space_info s ON s.carpark_id = c.carpark_id AND s.has_real_time_tracking = true
LEFT JOIN latest_spaces ls ON ls.parking_space_id = s.parking_space_id
GROUP BY c.carpark_id, c.name, c.name_tc, c.district, c.district_tc, c.latitude, c.longitude, c.total_spaces
HAVING COUNT(ls.parking_space_id) > 0;

-- Create index on materialized view for faster queries
CREATE INDEX IF NOT EXISTS idx_mat_metered_carpark_district
  ON latest_metered_carpark_occupancy(district);
CREATE INDEX IF NOT EXISTS idx_mat_metered_carpark_vacancy
  ON latest_metered_carpark_occupancy(vacant_spaces DESC);

-- ============================================================================
-- 3. CREATE REFRESH FUNCTION
-- ============================================================================

-- Function to refresh the materialized view with extended timeout
CREATE OR REPLACE FUNCTION refresh_latest_metered_carpark_occupancy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set a longer statement timeout for this operation (30 seconds)
  SET LOCAL statement_timeout = '30s';

  -- Refresh the materialized view concurrently to avoid locking
  -- Note: CONCURRENTLY requires a unique index, so we'll use standard refresh
  REFRESH MATERIALIZED VIEW latest_metered_carpark_occupancy;

  -- Reset to default timeout
  RESET statement_timeout;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_latest_metered_carpark_occupancy() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_latest_metered_carpark_occupancy() TO service_role;

-- ============================================================================
-- 4. INITIAL REFRESH
-- ============================================================================

-- Perform initial refresh to populate the materialized view
SELECT refresh_latest_metered_carpark_occupancy();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW latest_metered_carpark_occupancy IS
  'Materialized view of aggregated real-time occupancy data per metered carpark. Refreshed every 5 minutes by cron job.';
COMMENT ON FUNCTION refresh_latest_metered_carpark_occupancy() IS
  'Refreshes the latest_metered_carpark_occupancy materialized view with extended timeout (30s)';
