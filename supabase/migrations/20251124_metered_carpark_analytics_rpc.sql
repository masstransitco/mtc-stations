-- Migration: Metered Carpark Analytics RPC Functions
-- Created: 2025-11-24
-- Purpose: Optimize /admin/metered-carparks page performance with server-side analytics

-- ============================================================================
-- 1. MAIN FUNCTION: Get metered carpark analytics with time series
-- ============================================================================

CREATE OR REPLACE FUNCTION get_metered_carpark_analytics(
  p_district TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_min_spaces INTEGER DEFAULT 0,
  p_sort_by TEXT DEFAULT 'vacancy'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Build and execute the analytics query
  WITH latest_spaces AS (
    SELECT DISTINCT ON (parking_space_id)
      parking_space_id,
      occupancy_status,
      is_vacant,
      occupancy_date_changed,
      ingested_at
    FROM metered_space_occupancy_snapshots
    WHERE is_valid = true
      AND ingested_at >= NOW() - INTERVAL '2 hours'
    ORDER BY parking_space_id, ingested_at DESC
  ),
  carpark_summary AS (
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
    WHERE (p_district IS NULL OR c.district = p_district)
      AND c.total_spaces >= p_min_spaces
    GROUP BY c.carpark_id, c.name, c.name_tc, c.district, c.district_tc, c.latitude, c.longitude, c.total_spaces
    HAVING COUNT(ls.parking_space_id) > 0
  ),
  hourly_stats AS (
    SELECT
      s.carpark_id,
      DATE_TRUNC('hour', snap.ingested_at) as hour,
      AVG(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as avg_vacancy_rate,
      STDDEV(CASE WHEN snap.is_vacant THEN 1 ELSE 0 END) * 100 as vacancy_stddev,
      COUNT(DISTINCT snap.parking_space_id) as spaces_reporting
    FROM metered_space_info s
    JOIN metered_space_occupancy_snapshots snap ON snap.parking_space_id = s.parking_space_id
    WHERE snap.is_valid = true
      AND snap.ingested_at >= NOW() - INTERVAL '6 hours'
      AND s.carpark_id IN (SELECT carpark_id FROM carpark_summary)
    GROUP BY s.carpark_id, DATE_TRUNC('hour', snap.ingested_at)
  ),
  hourly_stats_with_roc AS (
    SELECT
      carpark_id,
      hour,
      avg_vacancy_rate,
      vacancy_stddev,
      spaces_reporting,
      COALESCE(
        avg_vacancy_rate - LAG(avg_vacancy_rate) OVER (PARTITION BY carpark_id ORDER BY hour),
        0
      ) as rate_of_change
    FROM hourly_stats
  ),
  activity_metrics AS (
    SELECT
      carpark_id,
      AVG(COALESCE(vacancy_stddev, 0)) as avg_variance,
      AVG(ABS(rate_of_change)) as avg_rate_change,
      STDDEV(avg_vacancy_rate) as overall_stddev
    FROM hourly_stats_with_roc
    GROUP BY carpark_id
  ),
  carpark_with_metrics AS (
    SELECT
      cs.*,
      am.avg_variance,
      am.avg_rate_change,
      am.overall_stddev,
      -- Activity score: combination of variance and rate of change
      ROUND((COALESCE(am.avg_variance, 0) * 0.3 + COALESCE(am.avg_rate_change, 0) * 0.3 + COALESCE(am.overall_stddev, 0) * 0.4)) as activity_score
    FROM carpark_summary cs
    LEFT JOIN activity_metrics am ON cs.carpark_id = am.carpark_id
  ),
  district_stats AS (
    SELECT
      district,
      district_tc,
      COUNT(*)::bigint as total_carparks,
      SUM(total_spaces)::bigint as total_spaces,
      SUM(tracked_spaces)::bigint as total_tracked_spaces,
      SUM(vacant_spaces)::bigint as total_vacant,
      SUM(occupied_spaces)::bigint as total_occupied,
      ROUND(AVG(vacancy_rate), 1) as avg_vacancy_rate
    FROM carpark_with_metrics
    GROUP BY district, district_tc
    ORDER BY COUNT(*) DESC
  ),
  overall_stats AS (
    SELECT
      COUNT(*)::bigint as total_carparks,
      SUM(total_spaces)::bigint as total_spaces,
      SUM(tracked_spaces)::bigint as total_tracked_spaces,
      SUM(vacant_spaces)::bigint as total_vacant,
      SUM(occupied_spaces)::bigint as total_occupied,
      ROUND(AVG(vacancy_rate), 1) as avg_vacancy_rate,
      MAX(last_updated) as last_updated
    FROM carpark_with_metrics
  ),
  sorted_filtered_carparks AS (
    SELECT *
    FROM carpark_with_metrics
    ORDER BY
      CASE
        WHEN p_sort_by = 'vacancy' THEN vacancy_rate
        WHEN p_sort_by = 'activity' THEN activity_score
        WHEN p_sort_by = 'capacity' THEN total_spaces
        ELSE vacancy_rate
      END DESC
    LIMIT p_limit
  )
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'filters', JSON_BUILD_OBJECT(
      'district', p_district,
      'limit', p_limit,
      'min_spaces', p_min_spaces,
      'sort_by', p_sort_by
    ),
    'carparks', (
      SELECT JSON_AGG(row_to_json(c))
      FROM sorted_filtered_carparks c
    ),
    'districts', (
      SELECT JSON_AGG(row_to_json(d))
      FROM district_stats d
    ),
    'stats', (
      SELECT row_to_json(s)
      FROM overall_stats s
    ),
    'total', (
      SELECT COUNT(*) FROM sorted_filtered_carparks
    ),
    'timestamp', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_metered_carpark_analytics(TEXT, INTEGER, INTEGER, TEXT) IS
'Optimized analytics for metered carparks with 6-hour activity window.
Returns carparks with vacancy rates, activity metrics, district breakdowns, and overall statistics.
Supports sorting by vacancy, activity, or capacity.
Time series data removed for performance - use separate endpoint for individual carpark trends.
Optimized for /admin/metered-carparks page. Expected execution time: <2000ms for 200 carparks';

-- ============================================================================
-- 2. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_metered_carpark_analytics(TEXT, INTEGER, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_metered_carpark_analytics(TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
