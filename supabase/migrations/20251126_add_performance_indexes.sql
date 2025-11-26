-- Migration: Add Performance Indexes
-- Description: Optimize query performance for frequently accessed data patterns
-- Date: 2025-11-26
--
-- Analysis Summary:
-- 1. History queries filter on park_id + vehicle_type + is_valid + ingested_at range
-- 2. Trending view queries filter on vehicle_type='privateCar' + is_valid + 6-hour window
-- 3. Metered history uses parking_space_id + is_valid + ingested_at range
-- 4. Some existing indexes are redundant and can be cleaned up

-- ============================================================================
-- 1. PARKING_VACANCY_SNAPSHOTS - New Partial Indexes
-- ============================================================================

-- Optimize trending carparks materialized view refresh
-- Query pattern: WHERE vehicle_type = 'privateCar' AND is_valid = true AND ingested_at > NOW() - INTERVAL '6 hours'
-- This partial index targets the exact query pattern for significant speedup
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_trending_privatecar
ON parking_vacancy_snapshots(park_id, ingested_at DESC)
WHERE vehicle_type = 'privateCar' AND is_valid = true;

-- Optimize history API queries for valid data
-- Query pattern: WHERE park_id = ? AND vehicle_type = ? AND is_valid = true AND ingested_at >= ?
-- The partial index on is_valid = true reduces index size significantly
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_history_valid
ON parking_vacancy_snapshots(park_id, vehicle_type, ingested_at DESC)
WHERE is_valid = true;

-- ============================================================================
-- 2. METERED_SPACE_OCCUPANCY_SNAPSHOTS - Ensure optimal coverage
-- ============================================================================

-- Optimize metered carpark history RPC and materialized view refresh
-- Query pattern: WHERE parking_space_id IN (...) AND is_valid = true AND ingested_at >= ?
-- Query pattern: DISTINCT ON (parking_space_id) WHERE is_valid AND ingested_at >= window
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_valid_recent
ON metered_space_occupancy_snapshots(parking_space_id, ingested_at DESC)
WHERE is_valid = true;

-- Optimize trending metered carparks with time window filter
-- Query pattern: WHERE is_valid = true AND ingested_at > NOW() - INTERVAL '6 hours'
-- Partial index on ingested_at for time-windowed scans
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_ingested_valid
ON metered_space_occupancy_snapshots(ingested_at DESC)
WHERE is_valid = true;

-- ============================================================================
-- 3. CLEANUP REDUNDANT INDEXES (commented out - review before enabling)
-- ============================================================================

-- The following indexes may be redundant. Uncomment after verifying query plans:

-- idx_parking_vacancy_park_id is covered by idx_parking_vacancy_park_vehicle
-- DROP INDEX IF EXISTS idx_parking_vacancy_park_id;

-- idx_parking_vacancy_vehicle_type has low cardinality (only 6 values)
-- and is not useful as a leading column - queries always combine with park_id
-- DROP INDEX IF EXISTS idx_parking_vacancy_vehicle_type;

-- idx_parking_vacancy_lastupdate_recent duplicates idx_parking_vacancy_lastupdate
-- DROP INDEX IF EXISTS idx_parking_vacancy_lastupdate_recent;

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_parking_vacancy_trending_privatecar IS
  'Partial index optimizing trending carparks view refresh - filters privateCar + is_valid';

COMMENT ON INDEX idx_parking_vacancy_history_valid IS
  'Partial index optimizing history API queries - filters is_valid = true';

COMMENT ON INDEX idx_metered_occupancy_valid_recent IS
  'Partial index optimizing metered history RPC and view refresh - filters is_valid = true';

COMMENT ON INDEX idx_metered_occupancy_ingested_valid IS
  'Partial index optimizing time-windowed metered queries - filters is_valid = true';
