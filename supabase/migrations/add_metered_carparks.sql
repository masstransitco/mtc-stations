-- Migration: Add Metered Carpark Tracking System
-- Description: Tables and views for tracking 649 metered carparks with real-time occupancy data
-- Date: 2025-11-17

-- ============================================================================
-- 1. METERED CARPARK INFO TABLE (Static Reference Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metered_carpark_info (
  carpark_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_tc VARCHAR(255),
  name_sc VARCHAR(255),
  region VARCHAR(100),
  region_tc VARCHAR(100),
  region_sc VARCHAR(100),
  district VARCHAR(100) NOT NULL,
  district_tc VARCHAR(100),
  district_sc VARCHAR(100),
  sub_district VARCHAR(100),
  sub_district_tc VARCHAR(100),
  sub_district_sc VARCHAR(100),
  street VARCHAR(255),
  street_tc VARCHAR(255),
  street_sc VARCHAR(255),
  section_of_street VARCHAR(255),
  section_of_street_tc VARCHAR(255),
  section_of_street_sc VARCHAR(255),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  total_spaces INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for metered_carpark_info
CREATE INDEX IF NOT EXISTS idx_metered_carpark_location ON metered_carpark_info(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_metered_carpark_district ON metered_carpark_info(district);

-- ============================================================================
-- 2. METERED SPACE INFO TABLE (Individual Space Details)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metered_space_info (
  parking_space_id VARCHAR(50) PRIMARY KEY,
  carpark_id VARCHAR(255) REFERENCES metered_carpark_info(carpark_id) ON DELETE CASCADE,
  pole_id INTEGER,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  vehicle_type CHAR(1), -- A (Any), C (Coach), G (Goods)
  longest_parking_period INTEGER, -- minutes
  operating_period VARCHAR(10), -- D, H, J, etc.
  time_unit INTEGER, -- minutes
  payment_unit NUMERIC(5, 2), -- HKD
  has_real_time_tracking BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for metered_space_info
CREATE INDEX IF NOT EXISTS idx_metered_space_carpark ON metered_space_info(carpark_id);
CREATE INDEX IF NOT EXISTS idx_metered_space_tracking ON metered_space_info(has_real_time_tracking);

-- ============================================================================
-- 3. METERED SPACE OCCUPANCY SNAPSHOTS (Time-Series Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metered_space_occupancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  parking_space_id VARCHAR(50) NOT NULL,
  meter_status VARCHAR(10) NOT NULL, -- N (Normal), NU (Not Usable)
  occupancy_status VARCHAR(10) NOT NULL, -- O (Occupied), V (Vacant)
  occupancy_date_changed TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  is_valid BOOLEAN GENERATED ALWAYS AS (meter_status = 'N') STORED,
  is_vacant BOOLEAN GENERATED ALWAYS AS (occupancy_status = 'V') STORED
);

-- Indexes for metered_space_occupancy_snapshots
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_space_ingested
  ON metered_space_occupancy_snapshots(parking_space_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_ingested
  ON metered_space_occupancy_snapshots(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_metered_occupancy_is_vacant
  ON metered_space_occupancy_snapshots(is_vacant)
  WHERE is_vacant = true;

-- ============================================================================
-- 4. VIEWS
-- ============================================================================

-- Latest valid occupancy per space
CREATE OR REPLACE VIEW latest_metered_space_occupancy AS
SELECT DISTINCT ON (parking_space_id)
  parking_space_id,
  meter_status,
  occupancy_status,
  is_vacant,
  occupancy_date_changed,
  ingested_at,
  (NOW() - occupancy_date_changed) > INTERVAL '2 hours' AS is_stale
FROM metered_space_occupancy_snapshots
WHERE is_valid = true
ORDER BY parking_space_id, ingested_at DESC;

-- Latest carpark occupancy with aggregated data
CREATE OR REPLACE VIEW latest_metered_carpark_occupancy AS
WITH latest_spaces AS (
  SELECT DISTINCT ON (parking_space_id)
    parking_space_id,
    occupancy_status,
    is_vacant,
    occupancy_date_changed,
    ingested_at
  FROM metered_space_occupancy_snapshots
  WHERE is_valid = true
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
HAVING COUNT(ls.parking_space_id) > 0; -- Only show carparks with real-time data

-- Statistics by district
CREATE OR REPLACE VIEW metered_carpark_statistics AS
SELECT
  district,
  district_tc,
  COUNT(*) as total_carparks,
  SUM(total_spaces) as total_spaces,
  SUM(tracked_spaces) as total_tracked_spaces,
  SUM(vacant_spaces) as total_vacant,
  SUM(occupied_spaces) as total_occupied,
  ROUND(AVG(vacancy_rate), 1) as avg_vacancy_rate
FROM latest_metered_carpark_occupancy
GROUP BY district, district_tc
ORDER BY total_carparks DESC;

-- Ingestion quality metrics
CREATE OR REPLACE VIEW metered_ingestion_metrics AS
WITH latest_batch AS (
  SELECT
    ingested_at,
    COUNT(*) as total_records,
    SUM(CASE WHEN is_valid THEN 1 ELSE 0 END) as valid_records,
    SUM(CASE WHEN NOT is_valid THEN 1 ELSE 0 END) as invalid_records,
    SUM(CASE WHEN is_vacant THEN 1 ELSE 0 END) as vacant_count,
    SUM(CASE WHEN NOT is_vacant AND is_valid THEN 1 ELSE 0 END) as occupied_count,
    ROUND(
      SUM(CASE WHEN is_vacant THEN 1 ELSE 0 END)::numeric /
      NULLIF(SUM(CASE WHEN is_valid THEN 1 ELSE 0 END), 0) * 100,
      1
    ) as vacancy_rate
  FROM metered_space_occupancy_snapshots
  WHERE ingested_at >= NOW() - INTERVAL '1 hour'
  GROUP BY ingested_at
  ORDER BY ingested_at DESC
  LIMIT 1
)
SELECT * FROM latest_batch;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE metered_carpark_info IS 'Static information about metered carpark groups (649 carparks with 10+ spaces)';
COMMENT ON TABLE metered_space_info IS 'Individual metered parking space details and pricing information';
COMMENT ON TABLE metered_space_occupancy_snapshots IS 'Time-series occupancy data for metered parking spaces';
COMMENT ON VIEW latest_metered_space_occupancy IS 'Most recent valid occupancy status per parking space';
COMMENT ON VIEW latest_metered_carpark_occupancy IS 'Aggregated real-time occupancy data per carpark';
COMMENT ON VIEW metered_carpark_statistics IS 'Summary statistics by district';
COMMENT ON VIEW metered_ingestion_metrics IS 'Data quality metrics for recent ingestion batches';
