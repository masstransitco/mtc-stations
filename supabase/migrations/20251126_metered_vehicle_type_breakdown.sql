-- Migration: Add vehicle type breakdown function for metered carparks
-- Description: RPC to get vehicle type breakdown with real-time vacancy per carpark
-- Date: 2025-11-26

CREATE OR REPLACE FUNCTION get_metered_carpark_vehicle_breakdown(p_carpark_id VARCHAR)
RETURNS TABLE (
  vehicle_type CHAR(1),
  total_spaces BIGINT,
  tracked_spaces BIGINT,
  vacant_spaces BIGINT,
  occupied_spaces BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_occupancy AS (
    SELECT DISTINCT ON (snap.parking_space_id)
      snap.parking_space_id,
      snap.is_vacant
    FROM metered_space_occupancy_snapshots snap
    JOIN metered_space_info info ON info.parking_space_id = snap.parking_space_id
    WHERE info.carpark_id = p_carpark_id
      AND info.has_real_time_tracking = true
      AND snap.is_valid = true
      AND snap.ingested_at >= NOW() - INTERVAL '1 hour'
    ORDER BY snap.parking_space_id, snap.ingested_at DESC
  )
  SELECT
    UPPER(COALESCE(s.vehicle_type, 'A'))::CHAR(1) as vehicle_type,
    COUNT(*)::BIGINT as total_spaces,
    COUNT(CASE WHEN s.has_real_time_tracking THEN 1 END)::BIGINT as tracked_spaces,
    COUNT(CASE WHEN lo.is_vacant = true THEN 1 END)::BIGINT as vacant_spaces,
    COUNT(CASE WHEN lo.is_vacant = false THEN 1 END)::BIGINT as occupied_spaces
  FROM metered_space_info s
  LEFT JOIN latest_occupancy lo ON lo.parking_space_id = s.parking_space_id
  WHERE s.carpark_id = p_carpark_id
  GROUP BY UPPER(COALESCE(s.vehicle_type, 'A'))
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_metered_carpark_vehicle_breakdown IS 'Returns vehicle type breakdown with real-time vacancy for a specific metered carpark';

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_metered_carpark_vehicle_breakdown(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_metered_carpark_vehicle_breakdown(VARCHAR) TO authenticated;
