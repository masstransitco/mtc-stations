-- Migration: Metered Carpark Time Series RPC (Lazy Loading)
-- Created: 2025-11-24
-- Purpose: Separate endpoint for loading individual carpark time series on-demand

-- ============================================================================
-- FUNCTION: Get time series for a single metered carpark
-- ============================================================================

CREATE OR REPLACE FUNCTION get_metered_carpark_time_series(
  p_carpark_id TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH hourly_stats AS (
    SELECT
      DATE_TRUNC('hour', snap.ingested_at) as hour,
      AVG(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as avg_vacancy_rate,
      STDDEV(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as vacancy_stddev,
      COUNT(DISTINCT snap.parking_space_id) as spaces_reporting,
      MIN(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as min_vacancy_rate,
      MAX(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as max_vacancy_rate
    FROM metered_space_info s
    JOIN metered_space_occupancy_snapshots snap ON snap.parking_space_id = s.parking_space_id
    WHERE snap.is_valid = true
      AND snap.ingested_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND s.carpark_id = p_carpark_id
    GROUP BY DATE_TRUNC('hour', snap.ingested_at)
    ORDER BY hour DESC
  ),
  hourly_stats_with_roc AS (
    SELECT
      hour,
      avg_vacancy_rate,
      vacancy_stddev,
      spaces_reporting,
      min_vacancy_rate,
      max_vacancy_rate,
      COALESCE(
        avg_vacancy_rate - LAG(avg_vacancy_rate) OVER (ORDER BY hour),
        0
      ) as rate_of_change
    FROM hourly_stats
  )
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'carpark_id', p_carpark_id,
    'hours', p_hours,
    'data_points', (SELECT COUNT(*) FROM hourly_stats_with_roc),
    'time_series', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'hour', TO_CHAR(hour AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
          'avg_vacancy_rate', ROUND(avg_vacancy_rate::numeric, 1),
          'vacancy_stddev', ROUND(COALESCE(vacancy_stddev, 0)::numeric, 1),
          'rate_of_change', ROUND(rate_of_change::numeric, 1),
          'spaces_reporting', spaces_reporting,
          'min_vacancy_rate', ROUND(min_vacancy_rate::numeric, 1),
          'max_vacancy_rate', ROUND(max_vacancy_rate::numeric, 1)
        )
        ORDER BY hour DESC
      )
      FROM hourly_stats_with_roc
    ),
    'timestamp', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_metered_carpark_time_series(TEXT, INTEGER) IS
'Get time series data for a single metered carpark (lazy loading).
Returns hourly vacancy rates, stddev, and rate of change for the specified time window.
Designed for on-demand loading when user clicks "View Trend" button.
Expected execution time: <500ms per carpark';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_metered_carpark_time_series(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_metered_carpark_time_series(TEXT, INTEGER) TO authenticated;
