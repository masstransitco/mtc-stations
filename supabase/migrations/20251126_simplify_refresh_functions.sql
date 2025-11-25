-- Simplify refresh functions and separate trending cache refresh
-- This ensures core vacancy views refresh quickly and trending is handled separately

-- Parking vacancy refresh - only core views (should be fast with time-filtered views)
CREATE OR REPLACE FUNCTION refresh_latest_parking_vacancy()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';

  REFRESH MATERIALIZED VIEW latest_parking_vacancy;
  REFRESH MATERIALIZED VIEW latest_valid_parking_vacancy;
  REFRESH MATERIALIZED VIEW latest_vacancy_with_location;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing parking vacancy views: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_latest_parking_vacancy() IS
  'Refreshes core parking vacancy views. Should complete in ~5-10s.';

-- Metered carpark refresh - only core view
CREATE OR REPLACE FUNCTION refresh_latest_metered_carpark_occupancy()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';

  REFRESH MATERIALIZED VIEW latest_metered_carpark_occupancy;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing metered carpark views: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_latest_metered_carpark_occupancy() IS
  'Refreshes core metered carpark occupancy view. Should complete in ~10-20s.';

-- Separate function for trending caches (can run less frequently, allows more time)
CREATE OR REPLACE FUNCTION refresh_trending_caches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '120s';

  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing trending caches: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_trending_caches() IS
  'Refreshes trending carpark caches. Separate from core vacancy refresh. May take up to 2 minutes.';
