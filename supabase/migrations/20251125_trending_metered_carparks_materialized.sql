-- Trending Metered Carparks Materialized View
-- Pre-computes the top 10 most active metered carparks based on actual state changes (V↔O)
-- Refreshed every 5 minutes via cron job

-- Drop the old function-based approach
DROP FUNCTION IF EXISTS get_trending_metered_carparks(INT, INT);

-- Create materialized view for trending metered carparks
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_metered_carparks_cache AS
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
  lm.carpark_id,
  lm.name,
  lm.name_tc,
  lm.district,
  lm.district_tc,
  lm.latitude,
  lm.longitude,
  lm.total_spaces,
  lm.tracked_spaces,
  lm.spaces_with_data,
  lm.vacant_spaces,
  lm.occupied_spaces,
  lm.vacancy_rate,
  lm.last_updated,
  sc.activity_score::NUMERIC as activity_score,
  NOW() as cached_at
FROM latest_metered_carpark_occupancy lm
JOIN state_changes sc ON lm.carpark_id = sc.carpark_id
WHERE lm.vacant_spaces > 0
ORDER BY sc.activity_score DESC
LIMIT 10;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_metered_cache_pk
ON trending_metered_carparks_cache(carpark_id);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_trending_metered_cache_score
ON trending_metered_carparks_cache(activity_score DESC);

-- Refresh function with error handling
CREATE OR REPLACE FUNCTION refresh_trending_metered_carparks()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the cron job
  RAISE WARNING 'Failed to refresh trending_metered_carparks_cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
