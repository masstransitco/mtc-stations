-- Migration: Carpark Analytics RPC Functions
-- Created: 2025-11-21
-- Purpose: Optimize /admin/carparks page performance with server-side analytics

-- ============================================================================
-- 1. MATERIALIZED VIEW: Pre-computed carpark metrics
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_carpark_metrics AS
WITH capacity_data AS (
  SELECT
    park_id,
    MAX(vacancy) as max_capacity,
    MIN(ingested_at) as first_seen,
    MAX(ingested_at) as last_seen
  FROM parking_vacancy_snapshots
  WHERE vehicle_type = 'privateCar' AND is_valid = true
  GROUP BY park_id
),
latest_vacancy AS (
  SELECT DISTINCT ON (park_id)
    park_id,
    vacancy as current_vacancy,
    lastupdate,
    ingested_at
  FROM parking_vacancy_snapshots
  WHERE vehicle_type = 'privateCar' AND is_valid = true
  ORDER BY park_id, ingested_at DESC
),
recent_stats AS (
  SELECT
    park_id,
    STDDEV(vacancy) as vacancy_stddev,
    COUNT(*) as snapshot_count
  FROM parking_vacancy_snapshots
  WHERE vehicle_type = 'privateCar'
    AND is_valid = true
    AND ingested_at >= NOW() - INTERVAL '7 days'
  GROUP BY park_id
)
SELECT
  c.park_id,
  c.name,
  c.display_address,
  c.latitude,
  c.longitude,
  c.district,
  cap.max_capacity,
  CASE
    WHEN cap.max_capacity < 50 THEN 'Small'
    WHEN cap.max_capacity < 100 THEN 'Medium'
    WHEN cap.max_capacity < 200 THEN 'Large'
    ELSE 'Very Large'
  END as size_category,
  lv.current_vacancy,
  lv.lastupdate,
  lv.ingested_at as last_ingested_at,
  rs.vacancy_stddev,
  rs.snapshot_count,
  cap.first_seen,
  cap.last_seen,
  NOW() as computed_at
FROM carpark_info c
INNER JOIN capacity_data cap ON c.park_id = cap.park_id
LEFT JOIN latest_vacancy lv ON c.park_id = lv.park_id
LEFT JOIN recent_stats rs ON c.park_id = rs.park_id
WHERE cap.max_capacity IS NOT NULL;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_carpark_metrics_park_id ON mv_carpark_metrics(park_id);
CREATE INDEX IF NOT EXISTS idx_mv_carpark_metrics_district ON mv_carpark_metrics(district);
CREATE INDEX IF NOT EXISTS idx_mv_carpark_metrics_capacity ON mv_carpark_metrics(max_capacity DESC);
CREATE INDEX IF NOT EXISTS idx_mv_carpark_metrics_size ON mv_carpark_metrics(size_category);

-- ============================================================================
-- 2. FUNCTION: Refresh materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_carpark_metrics_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_carpark_metrics;
END;
$$;

COMMENT ON FUNCTION refresh_carpark_metrics_cache() IS 'Refreshes the carpark metrics materialized view. Should be called every 15 minutes via cron.';

-- ============================================================================
-- 3. MAIN FUNCTION: Get carpark analytics with time series
-- ============================================================================

CREATE OR REPLACE FUNCTION get_carpark_analytics(
  p_days INTEGER DEFAULT 7,
  p_district TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_sort_by TEXT DEFAULT 'capacity'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Build and execute the analytics query
  WITH filtered_carparks AS (
    SELECT *
    FROM mv_carpark_metrics
    WHERE (p_district IS NULL OR district = p_district)
    ORDER BY
      CASE
        WHEN p_sort_by = 'capacity' THEN max_capacity
        WHEN p_sort_by = 'activity' THEN COALESCE(vacancy_stddev, 0)
        ELSE max_capacity
      END DESC
    LIMIT p_limit
  ),
  time_series_data AS (
    SELECT
      v.park_id,
      DATE_TRUNC('hour', v.ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
      AVG(v.vacancy) as avg_vacancy,
      MIN(v.vacancy) as min_vacancy,
      MAX(v.vacancy) as max_vacancy,
      STDDEV(v.vacancy) as vacancy_stddev,
      COUNT(*) as snapshot_count
    FROM parking_vacancy_snapshots v
    INNER JOIN filtered_carparks fc ON v.park_id = fc.park_id
    WHERE v.vehicle_type = 'privateCar'
      AND v.is_valid = true
      AND v.ingested_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY v.park_id, DATE_TRUNC('hour', v.ingested_at AT TIME ZONE 'Asia/Hong_Kong')
  ),
  time_series_with_roc AS (
    SELECT
      park_id,
      hour,
      avg_vacancy,
      min_vacancy,
      max_vacancy,
      vacancy_stddev,
      snapshot_count,
      COALESCE(
        avg_vacancy - LAG(avg_vacancy) OVER (PARTITION BY park_id ORDER BY hour),
        0
      ) as rate_of_change
    FROM time_series_data
  ),
  carpark_aggregates AS (
    SELECT
      park_id,
      AVG(COALESCE(vacancy_stddev, 0)) as avg_variance,
      AVG(ABS(rate_of_change)) as avg_rate_change,
      MAX(hour) as latest_hour
    FROM time_series_with_roc
    GROUP BY park_id
  ),
  carpark_analytics AS (
    SELECT
      fc.*,
      ca.avg_variance,
      ca.avg_rate_change,
      -- Activity score: combination of variance and rate of change
      ROUND((COALESCE(ca.avg_variance, 0) * 0.5 + COALESCE(ca.avg_rate_change, 0) * 0.5) * 10) / 10 as activity_score,
      -- Aggregate time series as JSON array
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'hour', TO_CHAR(ts.hour AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
            'avg_vacancy', ROUND(ts.avg_vacancy::numeric, 2),
            'min_vacancy', ts.min_vacancy,
            'max_vacancy', ts.max_vacancy,
            'vacancy_stddev', ROUND(COALESCE(ts.vacancy_stddev, 0)::numeric, 2),
            'rate_of_change', ROUND(ts.rate_of_change::numeric, 2),
            'snapshot_count', ts.snapshot_count
          )
          ORDER BY ts.hour DESC
        )
        FROM time_series_with_roc ts
        WHERE ts.park_id = fc.park_id
        LIMIT 168  -- 7 days * 24 hours
      ) as time_series
    FROM filtered_carparks fc
    LEFT JOIN carpark_aggregates ca ON fc.park_id = ca.park_id
  )
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'filters', JSON_BUILD_OBJECT(
      'district', p_district,
      'days', p_days,
      'limit', p_limit,
      'sort_by', p_sort_by
    ),
    'carparks', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'park_id', park_id,
          'name', name,
          'display_address', display_address,
          'latitude', latitude,
          'longitude', longitude,
          'district', district,
          'current_vacancy', current_vacancy,
          'max_capacity', max_capacity,
          'size_category', size_category,
          'activity_score', COALESCE(activity_score, 0),
          'avg_variance', ROUND(COALESCE(avg_variance, 0)::numeric, 2),
          'avg_rate_change', ROUND(COALESCE(avg_rate_change, 0)::numeric, 2),
          'lastupdate', TO_CHAR(lastupdate AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
          'time_series', COALESCE(time_series, '[]'::json)
        )
      )
      FROM carpark_analytics
    ),
    'total', (SELECT COUNT(*) FROM carpark_analytics),
    'generated_at', TO_CHAR(NOW() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_carpark_analytics(INTEGER, TEXT, INTEGER, TEXT) IS
'Returns comprehensive carpark analytics with time series data in a single query.
Optimized for /admin/carparks page. Expected execution time: <500ms';

-- ============================================================================
-- 4. FUNCTION: Get detailed time series for a single carpark
-- ============================================================================

CREATE OR REPLACE FUNCTION get_carpark_time_series(
  p_park_id TEXT,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '7 days',
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_granularity TEXT DEFAULT 'hour'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
  v_trunc_format TEXT;
BEGIN
  -- Determine time truncation based on granularity
  v_trunc_format := CASE
    WHEN p_granularity = 'minute' THEN 'minute'
    WHEN p_granularity = 'day' THEN 'day'
    ELSE 'hour'
  END;

  WITH time_series AS (
    SELECT
      DATE_TRUNC(v_trunc_format, ingested_at AT TIME ZONE 'Asia/Hong_Kong') as timestamp,
      AVG(vacancy) as avg_vacancy,
      MIN(vacancy) as min_vacancy,
      MAX(vacancy) as max_vacancy,
      STDDEV(vacancy) as variance,
      COUNT(*) as snapshot_count
    FROM parking_vacancy_snapshots
    WHERE park_id = p_park_id
      AND vehicle_type = 'privateCar'
      AND is_valid = true
      AND ingested_at >= p_start_time
      AND ingested_at <= p_end_time
    GROUP BY DATE_TRUNC(v_trunc_format, ingested_at AT TIME ZONE 'Asia/Hong_Kong')
    ORDER BY timestamp DESC
  ),
  time_series_with_metrics AS (
    SELECT
      timestamp,
      avg_vacancy,
      min_vacancy,
      max_vacancy,
      variance,
      snapshot_count,
      COALESCE(avg_vacancy - LAG(avg_vacancy) OVER (ORDER BY timestamp), 0) as rate_of_change,
      -- Get capacity for occupancy calculation
      (SELECT max_capacity FROM mv_carpark_metrics WHERE park_id = p_park_id) as capacity
    FROM time_series
  )
  SELECT JSON_BUILD_OBJECT(
    'park_id', p_park_id,
    'start_time', TO_CHAR(p_start_time AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'end_time', TO_CHAR(p_end_time AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'granularity', p_granularity,
    'time_series', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'timestamp', TO_CHAR(timestamp AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS'),
          'avg_vacancy', ROUND(avg_vacancy::numeric, 2),
          'min_vacancy', min_vacancy,
          'max_vacancy', max_vacancy,
          'variance', ROUND(COALESCE(variance, 0)::numeric, 2),
          'rate_of_change', ROUND(rate_of_change::numeric, 2),
          'occupancy_rate', CASE
            WHEN capacity > 0 THEN ROUND(((capacity - avg_vacancy) / capacity * 100)::numeric, 2)
            ELSE 0
          END,
          'snapshot_count', snapshot_count
        )
        ORDER BY timestamp DESC
      )
      FROM time_series_with_metrics
    ),
    'total_points', (SELECT COUNT(*) FROM time_series_with_metrics)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_carpark_time_series(TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) IS
'Returns detailed time series data for a single carpark with configurable granularity';

-- ============================================================================
-- 5. FUNCTION: Get district-level analytics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_district_analytics(
  p_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH district_stats AS (
    SELECT
      m.district,
      COUNT(*) as carpark_count,
      SUM(m.max_capacity) as total_capacity,
      AVG(m.current_vacancy) as avg_vacancy,
      SUM(m.current_vacancy) as total_vacancy,
      AVG(CASE
        WHEN m.max_capacity > 0
        THEN (m.max_capacity - m.current_vacancy)::float / m.max_capacity * 100
        ELSE 0
      END) as avg_utilization_rate,
      AVG(m.vacancy_stddev) as avg_activity
    FROM mv_carpark_metrics m
    WHERE m.district IS NOT NULL
    GROUP BY m.district
  ),
  district_time_patterns AS (
    SELECT
      c.district,
      EXTRACT(HOUR FROM v.ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour_of_day,
      AVG(v.vacancy) as avg_vacancy
    FROM parking_vacancy_snapshots v
    INNER JOIN carpark_info c ON v.park_id = c.park_id
    WHERE v.vehicle_type = 'privateCar'
      AND v.is_valid = true
      AND v.ingested_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY c.district, EXTRACT(HOUR FROM v.ingested_at AT TIME ZONE 'Asia/Hong_Kong')
  ),
  district_peak_hours AS (
    SELECT DISTINCT ON (district)
      district,
      hour_of_day as peak_hour,
      avg_vacancy as peak_vacancy
    FROM district_time_patterns
    ORDER BY district, avg_vacancy ASC
  )
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'days', p_days,
    'districts', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'district', ds.district,
          'carpark_count', ds.carpark_count,
          'total_capacity', ds.total_capacity,
          'avg_vacancy', ROUND(ds.avg_vacancy::numeric, 2),
          'total_vacancy', ds.total_vacancy,
          'avg_utilization_rate', ROUND(ds.avg_utilization_rate::numeric, 2),
          'avg_activity', ROUND(COALESCE(ds.avg_activity, 0)::numeric, 2),
          'peak_hour', dph.peak_hour,
          'peak_vacancy', ROUND(COALESCE(dph.peak_vacancy, 0)::numeric, 2)
        )
        ORDER BY ds.total_capacity DESC
      )
      FROM district_stats ds
      LEFT JOIN district_peak_hours dph ON ds.district = dph.district
    ),
    'total_districts', (SELECT COUNT(DISTINCT district) FROM district_stats),
    'generated_at', TO_CHAR(NOW() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_district_analytics(INTEGER) IS
'Returns district-level aggregate analytics and peak hour analysis';

-- ============================================================================
-- 6. FUNCTION: Compare multiple carparks
-- ============================================================================

CREATE OR REPLACE FUNCTION get_carpark_comparison(
  p_park_ids TEXT[],
  p_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH carpark_stats AS (
    SELECT
      m.park_id,
      m.name,
      m.max_capacity,
      m.current_vacancy,
      m.vacancy_stddev,
      AVG(v.vacancy) as avg_vacancy_period,
      STDDEV(v.vacancy) as period_variance,
      MIN(v.vacancy) as min_vacancy_period,
      MAX(v.vacancy) as max_vacancy_period
    FROM mv_carpark_metrics m
    LEFT JOIN parking_vacancy_snapshots v ON m.park_id = v.park_id
      AND v.vehicle_type = 'privateCar'
      AND v.is_valid = true
      AND v.ingested_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE m.park_id = ANY(p_park_ids)
    GROUP BY m.park_id, m.name, m.max_capacity, m.current_vacancy, m.vacancy_stddev
  ),
  peak_times AS (
    SELECT
      v.park_id,
      EXTRACT(HOUR FROM v.ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
      AVG(v.vacancy) as avg_vacancy
    FROM parking_vacancy_snapshots v
    WHERE v.park_id = ANY(p_park_ids)
      AND v.vehicle_type = 'privateCar'
      AND v.is_valid = true
      AND v.ingested_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY v.park_id, EXTRACT(HOUR FROM v.ingested_at AT TIME ZONE 'Asia/Hong_Kong')
  ),
  peak_hours AS (
    SELECT DISTINCT ON (park_id)
      park_id,
      hour as peak_utilization_hour,
      avg_vacancy
    FROM peak_times
    ORDER BY park_id, avg_vacancy ASC
  )
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'days', p_days,
    'carparks', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'park_id', cs.park_id,
          'name', cs.name,
          'max_capacity', cs.max_capacity,
          'current_vacancy', cs.current_vacancy,
          'avg_vacancy', ROUND(COALESCE(cs.avg_vacancy_period, 0)::numeric, 2),
          'min_vacancy', cs.min_vacancy_period,
          'max_vacancy', cs.max_vacancy_period,
          'variance', ROUND(COALESCE(cs.period_variance, 0)::numeric, 2),
          'volatility_score', ROUND(
            CASE
              WHEN cs.avg_vacancy_period > 0
              THEN (cs.period_variance / cs.avg_vacancy_period * 100)
              ELSE 0
            END::numeric, 2
          ),
          'avg_utilization_rate', ROUND(
            CASE
              WHEN cs.max_capacity > 0
              THEN ((cs.max_capacity - cs.avg_vacancy_period) / cs.max_capacity * 100)
              ELSE 0
            END::numeric, 2
          ),
          'peak_hour', ph.peak_utilization_hour
        )
      )
      FROM carpark_stats cs
      LEFT JOIN peak_hours ph ON cs.park_id = ph.park_id
    ),
    'generated_at', TO_CHAR(NOW() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD"T"HH24:MI:SS')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_carpark_comparison(TEXT[], INTEGER) IS
'Compares multiple carparks side-by-side with volatility and utilization metrics';

-- ============================================================================
-- Initial refresh of materialized view
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_carpark_metrics;
