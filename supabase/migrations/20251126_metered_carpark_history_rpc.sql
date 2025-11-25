-- Create RPC function for metered carpark vacancy history
-- This is more efficient than doing two queries from the API

CREATE OR REPLACE FUNCTION get_metered_carpark_history(
  p_carpark_id TEXT,
  p_hours INTEGER DEFAULT 6
)
RETURNS TABLE (
  time_bucket TIMESTAMP,
  vacant_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH carpark_spaces AS (
    SELECT parking_space_id
    FROM metered_space_info
    WHERE carpark_id = p_carpark_id
      AND has_real_time_tracking = true
  )
  SELECT
    -- Use date_trunc('hour') then add 5-minute bucket offset
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
$$;

COMMENT ON FUNCTION get_metered_carpark_history(TEXT, INTEGER) IS
  'Returns vacancy history for a metered carpark grouped by 5-minute intervals';

-- Grant access
GRANT EXECUTE ON FUNCTION get_metered_carpark_history(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_metered_carpark_history(TEXT, INTEGER) TO authenticated;
