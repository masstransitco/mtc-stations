-- Get metered carpark vacancy history broken down by vehicle type
-- Returns separate time series for each vehicle type (A, G, C)
CREATE OR REPLACE FUNCTION get_metered_carpark_history_by_vehicle_type(
  p_carpark_id TEXT,
  p_hours INTEGER DEFAULT 6
)
RETURNS TABLE (
  time_bucket TIMESTAMP,
  vehicle_type CHAR(1),
  vacant_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH carpark_spaces AS (
    SELECT parking_space_id, UPPER(COALESCE(msi.vehicle_type, 'A')) as vtype
    FROM metered_space_info msi
    WHERE msi.carpark_id = p_carpark_id
      AND msi.has_real_time_tracking = true
  )
  SELECT
    (date_trunc('hour', s.ingested_at) +
      (floor(extract(minute from s.ingested_at)::integer / 5) * interval '5 minutes'))::TIMESTAMP as time_bucket,
    cs.vtype::CHAR(1) as vehicle_type,
    SUM(CASE WHEN s.is_vacant THEN 1 ELSE 0 END)::BIGINT as vacant_count,
    COUNT(*)::BIGINT as total_count
  FROM metered_space_occupancy_snapshots s
  JOIN carpark_spaces cs ON cs.parking_space_id = s.parking_space_id
  WHERE s.is_valid = true
    AND s.ingested_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY 1, cs.vtype
  ORDER BY 1 ASC, cs.vtype;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_metered_carpark_history_by_vehicle_type(TEXT, INTEGER) TO anon, authenticated;
