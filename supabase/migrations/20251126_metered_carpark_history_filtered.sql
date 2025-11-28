-- Migration: Add filtered history function for metered carparks
-- Description: RPC to get vacancy history filtered by vehicle types
-- Date: 2025-11-26

CREATE OR REPLACE FUNCTION get_metered_carpark_history_filtered(
  p_carpark_id TEXT,
  p_hours INTEGER DEFAULT 6,
  p_vehicle_types CHAR(1)[] DEFAULT ARRAY['A', 'C', 'G']
)
RETURNS TABLE (
  time_bucket TIMESTAMP,
  vacant_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH carpark_spaces AS (
    SELECT parking_space_id
    FROM metered_space_info
    WHERE carpark_id = p_carpark_id
      AND has_real_time_tracking = true
      AND UPPER(COALESCE(vehicle_type, 'A')) = ANY(p_vehicle_types)
  )
  SELECT
    date_trunc('hour', s.ingested_at) +
      (floor(extract(minute from s.ingested_at)::integer / 5) * interval '5 minutes') as time_bucket,
    SUM(CASE WHEN s.is_vacant THEN 1 ELSE 0 END)::BIGINT as vacant_count,
    COUNT(*)::BIGINT as total_count
  FROM metered_space_occupancy_snapshots s
  WHERE s.parking_space_id IN (SELECT parking_space_id FROM carpark_spaces)
    AND s.is_valid = true
    AND s.ingested_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY 1
  ORDER BY 1 ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_metered_carpark_history_filtered IS 'Returns 5-minute bucketed vacancy history filtered by vehicle types';

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_metered_carpark_history_filtered(TEXT, INTEGER, CHAR(1)[]) TO anon;
GRANT EXECUTE ON FUNCTION get_metered_carpark_history_filtered(TEXT, INTEGER, CHAR(1)[]) TO authenticated;
