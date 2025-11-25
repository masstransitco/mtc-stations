-- Fix: Trending carparks cache should only store rankings, not vacancy data
-- Vacancy data will be fetched live at query time to ensure real-time accuracy
-- Issue: Previous implementation captured vacancy as static snapshot at refresh time

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS trending_carparks_cache;

-- Create new view that only caches park_id and activity_score
CREATE MATERIALIZED VIEW trending_carparks_cache AS
WITH snapshots_with_prev AS (
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
  park_id,
  ROUND((changes * 10 + variance / 2 + data_points * 0.5)::NUMERIC, 2) as activity_score,
  NOW() as cached_at
FROM activity_metrics
ORDER BY activity_score DESC
LIMIT 10;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_trending_carparks_cache_pk ON trending_carparks_cache(park_id);

-- Refresh function with error handling
CREATE OR REPLACE FUNCTION refresh_trending_carparks()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to refresh trending_carparks_cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW trending_carparks_cache IS
  'Caches only park_id and activity_score for top 10 trending carparks. Vacancy data is fetched live at query time.';
