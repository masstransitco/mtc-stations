-- Fix: Trending metered carparks cache should only store rankings, not vacancy data
-- Vacancy data will be fetched live at query time to ensure real-time accuracy
-- Issue: Previous implementation captured vacant_spaces as static snapshot at refresh time

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS trending_metered_carparks_cache;

-- Create new view that only caches carpark_id and activity_score
CREATE MATERIALIZED VIEW trending_metered_carparks_cache AS
WITH state_changes AS (
  -- Count actual occupancy state changes (V→O or O→V transitions)
  -- using occupancy_date_changed which tracks when state actually changed
  SELECT
    msi.carpark_id,
    COUNT(DISTINCT (msos.parking_space_id, msos.occupancy_date_changed)) as activity_score
  FROM metered_space_occupancy_snapshots msos
  JOIN metered_space_info msi ON msos.parking_space_id = msi.parking_space_id
  WHERE msos.ingested_at > NOW() - INTERVAL '6 hours'
    AND msos.is_valid = true
    AND msos.occupancy_date_changed IS NOT NULL
    AND msos.occupancy_date_changed > NOW() - INTERVAL '6 hours'
  GROUP BY msi.carpark_id
  HAVING COUNT(DISTINCT (msos.parking_space_id, msos.occupancy_date_changed)) > 10
)
SELECT
  carpark_id,
  activity_score::NUMERIC,
  NOW() as cached_at
FROM state_changes
ORDER BY activity_score DESC
LIMIT 10;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_trending_metered_cache_pk ON trending_metered_carparks_cache(carpark_id);

-- Refresh function with error handling
CREATE OR REPLACE FUNCTION refresh_trending_metered_carparks()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to refresh trending_metered_carparks_cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW trending_metered_carparks_cache IS
  'Caches only carpark_id and activity_score for top 10 trending metered carparks. Vacancy data is fetched live at query time.';
