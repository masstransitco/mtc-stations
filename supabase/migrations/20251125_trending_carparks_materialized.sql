-- Trending Indoor Carparks Materialized View
-- Pre-computes the top 10 most active indoor carparks based on vacancy changes
-- Activity Score = (changes * 10) + (variance / 2) + (data_points * 0.5)
-- Refreshed every 5 minutes via cron job

-- Create materialized view for trending indoor carparks
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_carparks_cache AS
WITH snapshots_with_prev AS (
  -- Get snapshots with previous vacancy value for comparison
  SELECT
    park_id,
    vacancy,
    LAG(vacancy) OVER (PARTITION BY park_id ORDER BY ingested_at) as prev_vacancy
  FROM parking_vacancy_snapshots
  WHERE vehicle_type = 'privateCar'
    AND is_valid = true
    AND ingested_at > NOW() - INTERVAL '6 hours'
),
activity_metrics AS (
  -- Calculate activity metrics per carpark
  SELECT
    park_id,
    COUNT(*) FILTER (WHERE vacancy IS DISTINCT FROM prev_vacancy AND prev_vacancy IS NOT NULL) as changes,
    COALESCE(STDDEV(vacancy), 0) as variance,
    COUNT(*) as data_points
  FROM snapshots_with_prev
  GROUP BY park_id
  HAVING COUNT(*) >= 2
)
SELECT
  lv.park_id,
  lv.name,
  lv.display_address,
  lv.latitude,
  lv.longitude,
  lv.district,
  lv.opening_status,
  lv.vehicle_type,
  lv.vacancy,
  lv.vacancy_dis,
  lv.vacancy_ev,
  lv.lastupdate,
  lv.is_stale,
  ROUND((am.changes * 10 + am.variance / 2 + am.data_points * 0.5)::NUMERIC, 2) as activity_score,
  NOW() as cached_at
FROM latest_vacancy_with_location lv
JOIN activity_metrics am ON lv.park_id = am.park_id
WHERE lv.vehicle_type = 'privateCar'
  AND lv.opening_status = 'OPEN'
  AND lv.vacancy > 0
ORDER BY activity_score DESC
LIMIT 10;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_carparks_cache_pk
ON trending_carparks_cache(park_id);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_trending_carparks_cache_score
ON trending_carparks_cache(activity_score DESC);

-- Refresh function with error handling
CREATE OR REPLACE FUNCTION refresh_trending_carparks()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the cron job
  RAISE WARNING 'Failed to refresh trending_carparks_cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
