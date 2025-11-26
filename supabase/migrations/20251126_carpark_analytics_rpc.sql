-- Migration: Carpark Analytics RPC Function
-- Description: Replaces raw pg client usage in /api/carpark/[id] with proper RPC
-- Date: 2025-11-26

-- ============================================================================
-- 1. CARPARK DETAILS WITH ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_carpark_analytics(
  p_park_id TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_carpark JSON;
  v_time_series JSON;
  v_result JSON;
BEGIN
  -- Get carpark details with capacity
  SELECT json_build_object(
    'park_id', ld.park_id,
    'name', ld.name,
    'display_address', ld.display_address,
    'latitude', ld.latitude,
    'longitude', ld.longitude,
    'district', ld.district,
    'current_vacancy', ld.current_vacancy,
    'max_capacity', ld.max_capacity,
    'size_category', ld.size_category,
    'lastupdate', ld.lastupdate,
    'ingested_at', ld.ingested_at
  ) INTO v_carpark
  FROM (
    SELECT DISTINCT ON (v.park_id)
      v.park_id,
      c.name,
      c.display_address,
      c.latitude,
      c.longitude,
      c.district,
      v.vacancy as current_vacancy,
      cap.max_capacity,
      CASE
        WHEN cap.max_capacity < 50 THEN 'Small'
        WHEN cap.max_capacity < 100 THEN 'Medium'
        WHEN cap.max_capacity < 200 THEN 'Large'
        ELSE 'Very Large'
      END as size_category,
      v.lastupdate,
      v.ingested_at
    FROM parking_vacancy_snapshots v
    JOIN carpark_info c ON v.park_id = c.park_id
    LEFT JOIN (
      SELECT park_id, MAX(vacancy) as max_capacity
      FROM parking_vacancy_snapshots
      WHERE vehicle_type = 'privateCar' AND is_valid = true
      GROUP BY park_id
    ) cap ON v.park_id = cap.park_id
    WHERE v.vehicle_type = 'privateCar'
      AND v.is_valid = true
      AND v.park_id = p_park_id
    ORDER BY v.park_id, v.ingested_at DESC
  ) ld
  WHERE ld.max_capacity IS NOT NULL;

  -- Return null if carpark not found
  IF v_carpark IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get hourly time-series data
  SELECT json_agg(ts ORDER BY ts.hour) INTO v_time_series
  FROM (
    SELECT
      DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
      ROUND(AVG(vacancy)::numeric, 2) as avg_vacancy,
      MIN(vacancy) as min_vacancy,
      MAX(vacancy) as max_vacancy,
      COUNT(*) as snapshot_count,
      ROUND(COALESCE(STDDEV(vacancy), 0)::numeric, 2) as vacancy_stddev
    FROM parking_vacancy_snapshots
    WHERE park_id = p_park_id
      AND vehicle_type = 'privateCar'
      AND is_valid = true
      AND ingested_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong')
    ORDER BY hour DESC
    LIMIT 168
  ) ts;

  -- Build result with carpark and time_series
  v_result := json_build_object(
    'carpark', v_carpark,
    'time_series', COALESCE(v_time_series, '[]'::json)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_carpark_analytics(TEXT, INTEGER) IS
  'Returns carpark details with hourly time-series analytics data';

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_carpark_analytics(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_carpark_analytics(TEXT, INTEGER) TO authenticated;
