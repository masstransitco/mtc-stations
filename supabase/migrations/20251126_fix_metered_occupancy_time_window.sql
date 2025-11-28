-- Fix: Extend time window from 1 hour to 6 hours to match trending rankings
-- Problem: Carparks with activity in 6-hour trending window but no data in 1-hour
-- vacancy window show 0 vacant spaces or don't render at all

-- Drop and recreate with extended time filter
DROP MATERIALIZED VIEW IF EXISTS latest_metered_carpark_occupancy CASCADE;

CREATE MATERIALIZED VIEW latest_metered_carpark_occupancy AS
WITH latest_spaces AS (
  SELECT DISTINCT ON (parking_space_id)
    parking_space_id,
    occupancy_status,
    is_vacant,
    occupancy_date_changed,
    ingested_at
  FROM metered_space_occupancy_snapshots
  WHERE is_valid = true
    AND ingested_at >= NOW() - INTERVAL '6 hours'  -- Extended to match trending rankings window
  ORDER BY parking_space_id, ingested_at DESC
)
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
GROUP BY c.carpark_id, c.name, c.name_tc, c.district, c.district_tc, c.latitude, c.longitude, c.total_spaces
HAVING COUNT(ls.parking_space_id) > 0;

-- Create indexes for faster queries
CREATE INDEX idx_mat_metered_carpark_id ON latest_metered_carpark_occupancy(carpark_id);
CREATE INDEX idx_mat_metered_carpark_district ON latest_metered_carpark_occupancy(district);
CREATE INDEX idx_mat_metered_carpark_vacancy ON latest_metered_carpark_occupancy(vacant_spaces DESC);

-- Recreate the refresh function (ensure it exists)
CREATE OR REPLACE FUNCTION refresh_latest_metered_carpark_occupancy()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  REFRESH MATERIALIZED VIEW latest_metered_carpark_occupancy;
  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing metered carpark views: %', SQLERRM;
END;
$$;

COMMENT ON MATERIALIZED VIEW latest_metered_carpark_occupancy IS
  'Materialized view of aggregated real-time occupancy data per metered carpark. Uses 6-hour time window to match trending rankings. Refreshed every 5 minutes by cron job.';
