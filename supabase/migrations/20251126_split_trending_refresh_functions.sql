-- Split trending cache refresh functions to prevent synchronization issues
-- Problem: Both crons were refreshing BOTH trending caches, causing vacancy/ranking mismatches
-- Solution: Each cron refreshes only its own trending cache

-- Function for regular carparks trending (called by carpark-vacancy cron)
CREATE OR REPLACE FUNCTION refresh_trending_carparks_with_tracking()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '60s';

  -- Save current rankings as previous before refresh
  DELETE FROM trending_carparks_previous;
  INSERT INTO trending_carparks_previous (park_id, rank, activity_score, cached_at)
  SELECT
    park_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_carparks_cache;

  -- Refresh only the regular carparks trending cache
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing trending carparks cache: %', SQLERRM;
END;
$$;

-- Function for metered carparks trending (called by metered-carpark-occupancy cron)
CREATE OR REPLACE FUNCTION refresh_trending_metered_carparks_with_tracking()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '60s';

  -- Save current rankings as previous before refresh
  DELETE FROM trending_metered_carparks_previous;
  INSERT INTO trending_metered_carparks_previous (carpark_id, rank, activity_score, cached_at)
  SELECT
    carpark_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_metered_carparks_cache;

  -- Refresh only the metered carparks trending cache
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing trending metered carparks cache: %', SQLERRM;
END;
$$;

-- Keep the combined function for backward compatibility but mark as deprecated
-- (in case any other code still calls it)
CREATE OR REPLACE FUNCTION refresh_trending_caches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Log deprecation warning
  RAISE NOTICE 'DEPRECATED: refresh_trending_caches() called. Use refresh_trending_carparks_with_tracking() or refresh_trending_metered_carparks_with_tracking() instead.';

  SET LOCAL statement_timeout = '120s';

  -- Save current rankings as previous before refresh (regular carparks)
  DELETE FROM trending_carparks_previous;
  INSERT INTO trending_carparks_previous (park_id, rank, activity_score, cached_at)
  SELECT
    park_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_carparks_cache;

  -- Save current rankings as previous before refresh (metered carparks)
  DELETE FROM trending_metered_carparks_previous;
  INSERT INTO trending_metered_carparks_previous (carpark_id, rank, activity_score, cached_at)
  SELECT
    carpark_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_metered_carparks_cache;

  -- Refresh both caches
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing trending caches: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_trending_carparks_with_tracking() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_trending_metered_carparks_with_tracking() TO anon, authenticated;

COMMENT ON FUNCTION refresh_trending_carparks_with_tracking() IS 'Refreshes trending carparks cache with position tracking. Called by carpark-vacancy cron.';
COMMENT ON FUNCTION refresh_trending_metered_carparks_with_tracking() IS 'Refreshes trending metered carparks cache with position tracking. Called by metered-carpark-occupancy cron.';
COMMENT ON FUNCTION refresh_trending_caches() IS 'DEPRECATED: Refreshes both trending caches. Use split functions instead for proper synchronization.';
