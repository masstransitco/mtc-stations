-- Track position changes for trending carparks
-- This enables showing up/down indicators in the UI

-- Table to store previous rankings for regular carparks
CREATE TABLE IF NOT EXISTS trending_carparks_previous (
  park_id VARCHAR(50) PRIMARY KEY,
  rank INTEGER NOT NULL,
  activity_score NUMERIC(10,2),
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store previous rankings for metered carparks
CREATE TABLE IF NOT EXISTS trending_metered_carparks_previous (
  carpark_id TEXT PRIMARY KEY,
  rank INTEGER NOT NULL,
  activity_score NUMERIC(10,2),
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update refresh function to save previous rankings before refresh
CREATE OR REPLACE FUNCTION refresh_trending_caches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '120s';

  -- Save current rankings as previous before refresh (regular carparks)
  DELETE FROM trending_carparks_previous;
  INSERT INTO trending_carparks_previous (park_id, rank, activity_score, cached_at)
  SELECT
    park_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_carparks_cache;

  -- Save current rankings as previous before refresh (metered carparks)
  DELETE FROM trending_metered_carparks_previous;
  INSERT INTO trending_metered_carparks_previous (carpark_id, rank, activity_score, cached_at)
  SELECT
    carpark_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_metered_carparks_cache;

  -- Now refresh the caches
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_metered_carparks_cache;

  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing trending caches: %', SQLERRM;
END;
$$;

-- Function to get trending carparks with rank changes
CREATE OR REPLACE FUNCTION get_trending_carparks_with_changes()
RETURNS TABLE (
  park_id VARCHAR(50),
  activity_score NUMERIC,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_change INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.park_id,
    c.activity_score,
    ROW_NUMBER() OVER (ORDER BY c.activity_score DESC)::INTEGER as current_rank,
    p.rank as previous_rank,
    CASE
      WHEN p.rank IS NULL THEN NULL
      ELSE p.rank - ROW_NUMBER() OVER (ORDER BY c.activity_score DESC)::INTEGER
    END as rank_change
  FROM trending_carparks_cache c
  LEFT JOIN trending_carparks_previous p ON c.park_id = p.park_id
  ORDER BY c.activity_score DESC;
END;
$$;

-- Function to get trending metered carparks with rank changes
CREATE OR REPLACE FUNCTION get_trending_metered_carparks_with_changes()
RETURNS TABLE (
  carpark_id VARCHAR(255),
  activity_score NUMERIC,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_change INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.carpark_id,
    c.activity_score,
    ROW_NUMBER() OVER (ORDER BY c.activity_score DESC)::INTEGER as current_rank,
    p.rank as previous_rank,
    CASE
      WHEN p.rank IS NULL THEN NULL
      ELSE p.rank - ROW_NUMBER() OVER (ORDER BY c.activity_score DESC)::INTEGER
    END as rank_change
  FROM trending_metered_carparks_cache c
  LEFT JOIN trending_metered_carparks_previous p ON c.carpark_id::text = p.carpark_id
  ORDER BY c.activity_score DESC;
END;
$$;

-- Grant permissions
GRANT SELECT ON trending_carparks_previous TO anon, authenticated;
GRANT SELECT ON trending_metered_carparks_previous TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_trending_carparks_with_changes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_trending_metered_carparks_with_changes() TO anon, authenticated;

COMMENT ON TABLE trending_carparks_previous IS 'Stores previous refresh rankings for position change tracking';
COMMENT ON TABLE trending_metered_carparks_previous IS 'Stores previous refresh rankings for position change tracking';
COMMENT ON FUNCTION get_trending_carparks_with_changes() IS 'Returns trending carparks with rank change indicator (positive = moved up, negative = moved down)';
COMMENT ON FUNCTION get_trending_metered_carparks_with_changes() IS 'Returns trending metered carparks with rank change indicator';
