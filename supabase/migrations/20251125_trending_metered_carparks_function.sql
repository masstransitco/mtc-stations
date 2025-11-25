-- Function to get trending metered carparks based on activity in the last N hours
-- This function counts snapshot records per carpark as a measure of activity
-- Carparks with more snapshots have more frequent updates = more activity

CREATE OR REPLACE FUNCTION get_trending_metered_carparks(hours_ago INT DEFAULT 6, result_limit INT DEFAULT 10)
RETURNS TABLE (
  carpark_id VARCHAR(255),
  name VARCHAR(255),
  name_tc VARCHAR(255),
  district VARCHAR(100),
  district_tc VARCHAR(100),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  total_spaces INT,
  tracked_spaces BIGINT,
  spaces_with_data BIGINT,
  vacant_spaces BIGINT,
  occupied_spaces BIGINT,
  vacancy_rate NUMERIC,
  last_updated TIMESTAMP,
  activity_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH carpark_activity AS (
    -- Simple count of snapshot records per carpark (more snapshots = more activity)
    SELECT
      msi.carpark_id,
      COUNT(*) as snapshot_count
    FROM metered_space_occupancy_snapshots msos
    JOIN metered_space_info msi ON msos.parking_space_id = msi.parking_space_id
    WHERE msos.ingested_at > NOW() - (hours_ago || ' hours')::INTERVAL
      AND msos.is_valid = true
    GROUP BY msi.carpark_id
    HAVING COUNT(*) > 100  -- Only carparks with significant activity
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
    ROUND((ca.snapshot_count)::NUMERIC, 2) as activity_score
  FROM latest_metered_carpark_occupancy lm
  JOIN carpark_activity ca ON lm.carpark_id = ca.carpark_id
  WHERE lm.vacant_spaces > 0
  ORDER BY activity_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Index to speed up the join
CREATE INDEX IF NOT EXISTS idx_metered_space_info_carpark_tracking
ON metered_space_info(carpark_id)
WHERE has_real_time_tracking = true;
