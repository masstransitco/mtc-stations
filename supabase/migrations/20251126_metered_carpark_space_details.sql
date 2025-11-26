-- Materialized view for latest metered space occupancy (fast lookup)
-- Scans the 50M+ snapshot table once and caches results
CREATE MATERIALIZED VIEW IF NOT EXISTS latest_metered_space_occupancy_mv AS
SELECT DISTINCT ON (parking_space_id)
  parking_space_id,
  meter_status,
  occupancy_status,
  is_vacant,
  occupancy_date_changed,
  ingested_at
FROM metered_space_occupancy_snapshots
WHERE is_valid = true
ORDER BY parking_space_id, ingested_at DESC;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_metered_space_occupancy_mv_pk
ON latest_metered_space_occupancy_mv(parking_space_id);

-- Function to refresh space-level occupancy (separate from carpark-level)
CREATE OR REPLACE FUNCTION refresh_latest_metered_space_occupancy()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '300s';
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_metered_space_occupancy_mv;
  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing metered space occupancy: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_latest_metered_space_occupancy() TO anon, authenticated, service_role;

-- Get individual metered parking space details with coordinates and real-time occupancy
-- Used for rendering individual space markers on the map
CREATE OR REPLACE FUNCTION get_metered_carpark_space_details(p_carpark_id TEXT)
RETURNS TABLE (
  parking_space_id VARCHAR(50),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  vehicle_type CHAR(1),
  is_vacant BOOLEAN,
  has_real_time_tracking BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.parking_space_id,
    s.latitude,
    s.longitude,
    UPPER(COALESCE(s.vehicle_type, 'A'))::CHAR(1) as vehicle_type,
    lo.is_vacant,
    s.has_real_time_tracking
  FROM metered_space_info s
  LEFT JOIN latest_metered_space_occupancy_mv lo
    ON lo.parking_space_id = s.parking_space_id
  WHERE s.carpark_id = p_carpark_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_metered_carpark_space_details(TEXT) TO anon, authenticated;

-- Update vehicle breakdown function to use materialized view
-- Previously filtered to last 1 hour which caused 0 counts for stale carparks
CREATE OR REPLACE FUNCTION get_metered_carpark_vehicle_breakdown(p_carpark_id TEXT)
RETURNS TABLE (
  vehicle_type CHAR(1),
  total_spaces BIGINT,
  tracked_spaces BIGINT,
  vacant_spaces BIGINT,
  occupied_spaces BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    UPPER(COALESCE(s.vehicle_type, 'A'))::CHAR(1) as vehicle_type,
    COUNT(*)::BIGINT as total_spaces,
    COUNT(CASE WHEN s.has_real_time_tracking THEN 1 END)::BIGINT as tracked_spaces,
    COUNT(CASE WHEN lo.is_vacant = true THEN 1 END)::BIGINT as vacant_spaces,
    COUNT(CASE WHEN lo.is_vacant = false THEN 1 END)::BIGINT as occupied_spaces
  FROM metered_space_info s
  LEFT JOIN latest_metered_space_occupancy_mv lo ON lo.parking_space_id = s.parking_space_id
  WHERE s.carpark_id = p_carpark_id
  GROUP BY UPPER(COALESCE(s.vehicle_type, 'A'))
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
