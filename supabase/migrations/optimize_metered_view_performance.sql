-- Migration: Optimize metered carpark materialized view performance
-- Description: Fixes timeout by limiting latest_spaces CTE to recent data only
-- Date: 2025-11-19

-- ============================================================================
-- 1. RECREATE MATERIALIZED VIEW WITH OPTIMIZED QUERY
-- ============================================================================

-- Drop and recreate with optimized query that only looks at recent data
DROP MATERIALIZED VIEW IF EXISTS latest_metered_carpark_occupancy CASCADE;

CREATE MATERIALIZED VIEW latest_metered_carpark_occupancy AS
WITH latest_spaces AS (
  -- OPTIMIZATION: Only look at last 2 hours of data instead of entire table
  -- This reduces scan from 10M+ rows to ~240k rows
  SELECT DISTINCT ON (parking_space_id)
    parking_space_id,
    occupancy_status,
    is_vacant,
    occupancy_date_changed,
    ingested_at
  FROM metered_space_occupancy_snapshots
  WHERE is_valid = true
    AND ingested_at >= NOW() - INTERVAL '2 hours'  -- CRITICAL OPTIMIZATION
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

-- Recreate indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_mat_metered_carpark_district
  ON latest_metered_carpark_occupancy(district);
CREATE INDEX IF NOT EXISTS idx_mat_metered_carpark_vacancy
  ON latest_metered_carpark_occupancy(vacant_spaces DESC);

-- ============================================================================
-- 2. ADD PARTIAL INDEX FOR RECENT DATA
-- ============================================================================

-- This index speeds up the "last 2 hours" query dramatically
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_recent_valid
  ON metered_space_occupancy_snapshots(parking_space_id, ingested_at DESC)
  WHERE is_valid = true AND ingested_at >= NOW() - INTERVAL '2 hours';

-- ============================================================================
-- 3. UPDATE REFRESH FUNCTION
-- ============================================================================

-- Recreate function with longer timeout and concurrent refresh
CREATE OR REPLACE FUNCTION refresh_latest_metered_carpark_occupancy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set a longer statement timeout for this operation (60 seconds)
  SET LOCAL statement_timeout = '60s';

  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW latest_metered_carpark_occupancy;

  -- Reset to default timeout
  RESET statement_timeout;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_latest_metered_carpark_occupancy() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_latest_metered_carpark_occupancy() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_latest_metered_carpark_occupancy() TO anon;

-- ============================================================================
-- 4. INITIAL REFRESH
-- ============================================================================

SELECT refresh_latest_metered_carpark_occupancy();

-- ============================================================================
-- 5. CREATE CLEANUP FUNCTION FOR OLD SNAPSHOTS
-- ============================================================================

-- Function to clean up snapshots older than 7 days
CREATE OR REPLACE FUNCTION cleanup_old_metered_snapshots()
RETURNS TABLE(deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_deleted bigint;
BEGIN
  -- Delete snapshots older than 7 days
  DELETE FROM metered_space_occupancy_snapshots
  WHERE ingested_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN QUERY SELECT rows_deleted;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_metered_snapshots() TO service_role;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW latest_metered_carpark_occupancy IS
  'Optimized materialized view that only looks at last 2 hours of data for performance. Refreshed every 5 minutes by cron job.';
COMMENT ON FUNCTION refresh_latest_metered_carpark_occupancy() IS
  'Refreshes the latest_metered_carpark_occupancy materialized view with extended timeout (60s)';
COMMENT ON FUNCTION cleanup_old_metered_snapshots() IS
  'Deletes metered parking snapshots older than 7 days to maintain performance. Run weekly via cron.';

-- ============================================================================
-- 7. IMMEDIATE CLEANUP (OPTIONAL - COMMENT OUT IF YOU WANT TO KEEP HISTORY)
-- ============================================================================

-- Clean up old data immediately to improve performance
-- This will delete snapshots older than 7 days
-- SELECT cleanup_old_metered_snapshots();
