-- Migration: Exhaustive Metered Carpark Ranking Snapshots
-- Description: Store complete ranking snapshots for all metered carparks every refresh
-- Date: 2025-11-26

-- ============================================================================
-- 1. RANKING SNAPSHOT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS metered_carpark_ranking_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id UUID NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carpark_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  activity_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  state_changes INTEGER NOT NULL DEFAULT 0,
  total_tracked_spaces INTEGER
);

-- Index for querying all carparks in a snapshot
CREATE INDEX idx_ranking_snapshot_id ON metered_carpark_ranking_snapshots(snapshot_id);

-- Index for time-based queries (list snapshots in time range)
CREATE INDEX idx_ranking_snapshot_at ON metered_carpark_ranking_snapshots(snapshot_at DESC);

-- Index for carpark history queries
CREATE INDEX idx_ranking_carpark_time ON metered_carpark_ranking_snapshots(carpark_id, snapshot_at DESC);

-- Note: Partial index with NOW() is not supported (not immutable)
-- The snapshot_at DESC index will be used for cleanup queries instead

-- ============================================================================
-- 2. SNAPSHOT METADATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS metered_carpark_snapshot_metadata (
  snapshot_id UUID PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL,
  total_carparks INTEGER NOT NULL,
  active_carparks INTEGER NOT NULL,
  top_carpark_id TEXT,
  top_activity_score NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshot_meta_time ON metered_carpark_snapshot_metadata(snapshot_at DESC);

-- ============================================================================
-- 3. CAPTURE SNAPSHOT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION capture_metered_carpark_ranking_snapshot()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot_id UUID := gen_random_uuid();
  v_snapshot_at TIMESTAMPTZ := NOW();
  v_total_carparks INTEGER;
  v_active_carparks INTEGER;
  v_top_carpark_id TEXT;
  v_top_score NUMERIC(10,2);
BEGIN
  SET LOCAL statement_timeout = '120s';

  -- Calculate activity scores for ALL carparks and insert snapshot
  -- Uses same logic as trending_metered_carparks_cache but without LIMIT and HAVING filter
  WITH state_changes AS (
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
  ),
  all_carparks_ranked AS (
    -- Include ALL carparks from metered_carpark_info, even those with 0 activity
    SELECT
      c.carpark_id,
      COALESCE(sc.activity_score, 0)::NUMERIC(10,2) as activity_score,
      COALESCE(sc.activity_score, 0)::INTEGER as state_changes,
      (SELECT COUNT(*)::INTEGER FROM metered_space_info ms
       WHERE ms.carpark_id = c.carpark_id AND ms.has_real_time_tracking = true
      ) as total_tracked_spaces,
      ROW_NUMBER() OVER (ORDER BY COALESCE(sc.activity_score, 0) DESC, c.carpark_id) as rank
    FROM metered_carpark_info c
    LEFT JOIN state_changes sc ON c.carpark_id = sc.carpark_id
  )
  INSERT INTO metered_carpark_ranking_snapshots
    (snapshot_id, snapshot_at, carpark_id, rank, activity_score, state_changes, total_tracked_spaces)
  SELECT
    v_snapshot_id,
    v_snapshot_at,
    carpark_id,
    rank::INTEGER,
    activity_score,
    state_changes,
    total_tracked_spaces
  FROM all_carparks_ranked;

  -- Get summary stats
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE activity_score > 0)
  INTO v_total_carparks, v_active_carparks
  FROM metered_carpark_ranking_snapshots
  WHERE snapshot_id = v_snapshot_id;

  -- Get top carpark info
  SELECT carpark_id, activity_score
  INTO v_top_carpark_id, v_top_score
  FROM metered_carpark_ranking_snapshots
  WHERE snapshot_id = v_snapshot_id AND rank = 1;

  -- Insert metadata
  INSERT INTO metered_carpark_snapshot_metadata
    (snapshot_id, snapshot_at, total_carparks, active_carparks, top_carpark_id, top_activity_score)
  VALUES
    (v_snapshot_id, v_snapshot_at, v_total_carparks, v_active_carparks, v_top_carpark_id, v_top_score);

  RETURN v_snapshot_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error capturing ranking snapshot: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- 4. RETRIEVAL FUNCTIONS
-- ============================================================================

-- Get list of available snapshots for time picker
CREATE OR REPLACE FUNCTION get_ranking_snapshot_list(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  snapshot_id UUID,
  snapshot_at TIMESTAMPTZ,
  total_carparks INTEGER,
  active_carparks INTEGER,
  top_carpark_id TEXT,
  top_activity_score NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.snapshot_id,
    m.snapshot_at,
    m.total_carparks,
    m.active_carparks,
    m.top_carpark_id,
    m.top_activity_score
  FROM metered_carpark_snapshot_metadata m
  WHERE m.snapshot_at BETWEEN p_start_time AND p_end_time
  ORDER BY m.snapshot_at DESC
  LIMIT p_limit;
END;
$$;

-- Get rankings for a specific snapshot with carpark info
CREATE OR REPLACE FUNCTION get_ranking_snapshot(
  p_snapshot_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  carpark_id TEXT,
  rank INTEGER,
  activity_score NUMERIC,
  state_changes INTEGER,
  total_tracked_spaces INTEGER,
  name TEXT,
  name_tc TEXT,
  district TEXT,
  district_tc TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  total_spaces INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.carpark_id,
    rs.rank,
    rs.activity_score,
    rs.state_changes,
    rs.total_tracked_spaces,
    ci.name::TEXT,
    ci.name_tc::TEXT,
    ci.district::TEXT,
    ci.district_tc::TEXT,
    ci.latitude,
    ci.longitude,
    ci.total_spaces
  FROM metered_carpark_ranking_snapshots rs
  JOIN metered_carpark_info ci ON rs.carpark_id = ci.carpark_id
  WHERE rs.snapshot_id = p_snapshot_id
  ORDER BY rs.rank ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get latest snapshot rankings with live vacancy data
CREATE OR REPLACE FUNCTION get_latest_ranking_snapshot_with_vacancy(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_district TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
  v_latest_snapshot_id UUID;
  v_latest_snapshot_at TIMESTAMPTZ;
  v_total INTEGER;
BEGIN
  -- Get the most recent snapshot
  SELECT m.snapshot_id, m.snapshot_at
  INTO v_latest_snapshot_id, v_latest_snapshot_at
  FROM metered_carpark_snapshot_metadata m
  ORDER BY m.snapshot_at DESC
  LIMIT 1;

  IF v_latest_snapshot_id IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'No snapshots available');
  END IF;

  -- Get total count for pagination
  SELECT COUNT(*)
  INTO v_total
  FROM metered_carpark_ranking_snapshots rs
  JOIN metered_carpark_info ci ON rs.carpark_id = ci.carpark_id
  WHERE rs.snapshot_id = v_latest_snapshot_id
    AND (p_district IS NULL OR ci.district = p_district);

  SELECT JSON_BUILD_OBJECT(
    'snapshot', JSON_BUILD_OBJECT(
      'snapshot_id', v_latest_snapshot_id,
      'snapshot_at', v_latest_snapshot_at
    ),
    'total', v_total,
    'rankings', (
      SELECT COALESCE(JSON_AGG(row_to_json(r) ORDER BY r.rank), '[]'::json)
      FROM (
        SELECT
          rs.carpark_id,
          rs.rank,
          rs.activity_score,
          rs.state_changes,
          ci.name,
          ci.name_tc,
          ci.district,
          ci.district_tc,
          ci.latitude,
          ci.longitude,
          ci.total_spaces,
          COALESCE(lm.vacant_spaces, 0) as vacant_spaces,
          COALESCE(lm.occupied_spaces, 0) as occupied_spaces,
          COALESCE(lm.vacancy_rate, 0) as vacancy_rate,
          lm.last_updated
        FROM metered_carpark_ranking_snapshots rs
        JOIN metered_carpark_info ci ON rs.carpark_id = ci.carpark_id
        LEFT JOIN latest_metered_carpark_occupancy lm ON rs.carpark_id = lm.carpark_id
        WHERE rs.snapshot_id = v_latest_snapshot_id
          AND (p_district IS NULL OR ci.district = p_district)
        ORDER BY rs.rank ASC
        LIMIT p_limit
        OFFSET p_offset
      ) r
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Get carpark ranking history over time
CREATE OR REPLACE FUNCTION get_carpark_ranking_history(
  p_carpark_id TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  snapshot_at TIMESTAMPTZ,
  rank INTEGER,
  activity_score NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.snapshot_at,
    rs.rank,
    rs.activity_score
  FROM metered_carpark_ranking_snapshots rs
  WHERE rs.carpark_id = p_carpark_id
    AND rs.snapshot_at > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY rs.snapshot_at DESC;
END;
$$;

-- ============================================================================
-- 5. CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ranking_snapshots(
  p_retention_days INTEGER DEFAULT 7
)
RETURNS TABLE (deleted_snapshots BIGINT, deleted_metadata BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_retention_days || ' days')::INTERVAL;
  v_deleted_snapshots BIGINT;
  v_deleted_metadata BIGINT;
BEGIN
  -- Delete old snapshots
  DELETE FROM metered_carpark_ranking_snapshots
  WHERE snapshot_at < v_cutoff;
  GET DIAGNOSTICS v_deleted_snapshots = ROW_COUNT;

  -- Delete old metadata
  DELETE FROM metered_carpark_snapshot_metadata
  WHERE snapshot_at < v_cutoff;
  GET DIAGNOSTICS v_deleted_metadata = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_snapshots, v_deleted_metadata;
END;
$$;

-- ============================================================================
-- 6. PERMISSIONS
-- ============================================================================

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION capture_metered_carpark_ranking_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION get_ranking_snapshot_list(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ranking_snapshot(UUID, INTEGER, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_latest_ranking_snapshot_with_vacancy(INTEGER, INTEGER, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_carpark_ranking_history(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_ranking_snapshots(INTEGER) TO service_role;

-- Grant table access
GRANT SELECT ON metered_carpark_ranking_snapshots TO anon, authenticated;
GRANT SELECT ON metered_carpark_snapshot_metadata TO anon, authenticated;
GRANT INSERT, DELETE ON metered_carpark_ranking_snapshots TO service_role;
GRANT INSERT, DELETE ON metered_carpark_snapshot_metadata TO service_role;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE metered_carpark_ranking_snapshots IS 'Exhaustive ranking snapshots for all metered carparks, captured every refresh (~5 min), retained for 7 days';
COMMENT ON TABLE metered_carpark_snapshot_metadata IS 'Metadata for each snapshot batch for quick lookups and time picker';
COMMENT ON FUNCTION capture_metered_carpark_ranking_snapshot() IS 'Captures complete ranking snapshot for all ~649 metered carparks using same activity score logic as trending';
COMMENT ON FUNCTION get_ranking_snapshot_list(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS 'Lists available snapshots in a time range for snapshot picker';
COMMENT ON FUNCTION get_ranking_snapshot(UUID, INTEGER, INTEGER) IS 'Gets rankings for a specific historical snapshot';
COMMENT ON FUNCTION get_latest_ranking_snapshot_with_vacancy(INTEGER, INTEGER, TEXT) IS 'Gets latest rankings with live vacancy data';
COMMENT ON FUNCTION get_carpark_ranking_history(TEXT, INTEGER) IS 'Gets ranking history over time for a single carpark';
COMMENT ON FUNCTION cleanup_old_ranking_snapshots(INTEGER) IS 'Cleans up snapshots older than retention period';
