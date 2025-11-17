-- =====================================================
-- Non-Metered Parking Spaces Schema
-- =====================================================
-- This migration creates tables and views for tracking
-- occupancy of 145 non-metered parking spaces in New Territories
-- Data source: https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus
-- =====================================================

-- =====================================================
-- 1. PARKING SPACE INFO TABLE (Static Reference Data)
-- =====================================================
-- Stores location and metadata for 145 parking spaces
-- Populated from non-metered-parking.json GeoJSON file

CREATE TABLE IF NOT EXISTS parking_space_info (
  feature_id INTEGER PRIMARY KEY,
  parking_space_id VARCHAR(50) UNIQUE NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,

  -- Location hierarchy (3 languages: EN, TC Traditional Chinese, SC Simplified Chinese)
  region VARCHAR(50),
  region_tc VARCHAR(50),
  region_sc VARCHAR(50),

  district VARCHAR(100),
  district_tc VARCHAR(100),
  district_sc VARCHAR(100),

  sub_district VARCHAR(100),
  sub_district_tc VARCHAR(100),
  sub_district_sc VARCHAR(100),

  street VARCHAR(200),
  street_tc VARCHAR(200),
  street_sc VARCHAR(200),

  section_of_street TEXT,
  section_of_street_tc TEXT,
  section_of_street_sc TEXT,

  -- Vehicle type: A (Any), C (Coach), D (Disabled)
  vehicle_type CHAR(1) CHECK (vehicle_type IN ('A', 'C', 'D')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for parking_space_info
CREATE INDEX idx_parking_space_location ON parking_space_info(latitude, longitude);
CREATE INDEX idx_parking_space_district ON parking_space_info(district);
CREATE INDEX idx_parking_space_vehicle_type ON parking_space_info(vehicle_type);
CREATE INDEX idx_parking_space_sub_district ON parking_space_info(sub_district);

-- =====================================================
-- 2. OCCUPANCY SNAPSHOTS TABLE (Time-Series Data)
-- =====================================================
-- Stores real-time occupancy status from CSV API
-- Ingested every 5 minutes via cron job

CREATE TABLE IF NOT EXISTS parking_space_occupancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  feature_id INTEGER NOT NULL REFERENCES parking_space_info(feature_id),
  parking_space_id VARCHAR(50) NOT NULL,

  -- Occupancy status: V (Vacant), O (Occupied), NU (Not Updated)
  occupancy_status VARCHAR(2) NOT NULL CHECK (occupancy_status IN ('V', 'O', 'NU')),

  -- When the occupancy status was last changed (from government API)
  occupancy_date_changed TIMESTAMP,

  -- When we ingested this record
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Generated columns for easier querying
  is_valid BOOLEAN GENERATED ALWAYS AS (occupancy_status IN ('V', 'O')) STORED,
  is_vacant BOOLEAN GENERATED ALWAYS AS (occupancy_status = 'V') STORED
);

-- Indexes for parking_space_occupancy_snapshots
CREATE INDEX idx_space_occupancy_feature_id ON parking_space_occupancy_snapshots(feature_id);
CREATE INDEX idx_space_occupancy_parking_space_id ON parking_space_occupancy_snapshots(parking_space_id);
CREATE INDEX idx_space_occupancy_ingested_at ON parking_space_occupancy_snapshots(ingested_at DESC);
CREATE INDEX idx_space_occupancy_is_valid ON parking_space_occupancy_snapshots(is_valid) WHERE is_valid = true;
CREATE INDEX idx_space_occupancy_is_vacant ON parking_space_occupancy_snapshots(is_vacant) WHERE is_vacant = true;

-- Composite index for latest record queries
CREATE INDEX idx_space_occupancy_feature_ingested ON parking_space_occupancy_snapshots(feature_id, ingested_at DESC);

-- =====================================================
-- 3. LATEST OCCUPANCY VIEW
-- =====================================================
-- Returns the most recent VALID occupancy record for each parking space
-- Filters out "NU" (Not Updated) records

CREATE OR REPLACE VIEW latest_space_occupancy AS
SELECT DISTINCT ON (feature_id)
  id,
  feature_id,
  parking_space_id,
  occupancy_status,
  occupancy_date_changed,
  ingested_at,
  is_valid,
  is_vacant,
  -- Flag records as stale if last update was > 2 hours ago
  (occupancy_date_changed < NOW() - INTERVAL '2 hours') as is_stale
FROM parking_space_occupancy_snapshots
WHERE is_valid = true  -- Only include V (Vacant) or O (Occupied), exclude NU
ORDER BY feature_id, ingested_at DESC;

-- =====================================================
-- 4. LATEST OCCUPANCY WITH LOCATION VIEW
-- =====================================================
-- Main view for API consumption
-- Joins latest occupancy status with static location info

CREATE OR REPLACE VIEW latest_space_occupancy_with_location AS
SELECT
  -- IDs
  o.feature_id,
  o.parking_space_id,

  -- Location
  s.latitude,
  s.longitude,

  -- Location names (English)
  s.region,
  s.district,
  s.sub_district,
  s.street,
  s.section_of_street,

  -- Location names (Traditional Chinese)
  s.region_tc,
  s.district_tc,
  s.sub_district_tc,
  s.street_tc,
  s.section_of_street_tc,

  -- Location names (Simplified Chinese)
  s.region_sc,
  s.district_sc,
  s.sub_district_sc,
  s.street_sc,
  s.section_of_street_sc,

  -- Vehicle type
  s.vehicle_type,

  -- Occupancy status
  o.occupancy_status,
  o.is_vacant,
  o.occupancy_date_changed,
  o.ingested_at,
  o.is_stale
FROM latest_space_occupancy o
JOIN parking_space_info s ON o.feature_id = s.feature_id;

-- =====================================================
-- 5. OCCUPANCY STATISTICS VIEW
-- =====================================================
-- Provides summary statistics by district and vehicle type

CREATE OR REPLACE VIEW parking_space_statistics AS
SELECT
  s.district,
  s.district_tc,
  s.vehicle_type,
  COUNT(*) as total_spaces,
  SUM(CASE WHEN o.is_vacant THEN 1 ELSE 0 END) as vacant_spaces,
  SUM(CASE WHEN NOT o.is_vacant THEN 1 ELSE 0 END) as occupied_spaces,
  ROUND(100.0 * SUM(CASE WHEN o.is_vacant THEN 1 ELSE 0 END) / COUNT(*), 2) as vacancy_rate
FROM parking_space_info s
LEFT JOIN latest_space_occupancy o ON s.feature_id = o.feature_id
GROUP BY s.district, s.district_tc, s.vehicle_type
ORDER BY s.district, s.vehicle_type;

-- =====================================================
-- 6. INGESTION QUALITY METRICS VIEW
-- =====================================================
-- Tracks data quality for each ingestion batch

CREATE OR REPLACE VIEW parking_space_ingestion_metrics AS
SELECT
  DATE_TRUNC('hour', ingested_at) as ingestion_hour,
  COUNT(*) as total_records,
  SUM(CASE WHEN is_valid THEN 1 ELSE 0 END) as valid_records,
  SUM(CASE WHEN NOT is_valid THEN 1 ELSE 0 END) as invalid_records,
  SUM(CASE WHEN is_vacant THEN 1 ELSE 0 END) as vacant_count,
  SUM(CASE WHEN occupancy_status = 'O' THEN 1 ELSE 0 END) as occupied_count,
  SUM(CASE WHEN occupancy_status = 'NU' THEN 1 ELSE 0 END) as not_updated_count,
  ROUND(100.0 * SUM(CASE WHEN NOT is_valid THEN 1 ELSE 0 END) / COUNT(*), 2) as invalid_percentage
FROM parking_space_occupancy_snapshots
GROUP BY DATE_TRUNC('hour', ingested_at)
ORDER BY ingestion_hour DESC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE parking_space_info IS 'Static reference data for 145 non-metered parking spaces in New Territories';
COMMENT ON TABLE parking_space_occupancy_snapshots IS 'Time-series occupancy data ingested every 5 minutes from government CSV API';
COMMENT ON VIEW latest_space_occupancy IS 'Most recent valid occupancy status for each parking space';
COMMENT ON VIEW latest_space_occupancy_with_location IS 'Latest occupancy joined with location data - main API view';
COMMENT ON VIEW parking_space_statistics IS 'Summary statistics by district and vehicle type';
COMMENT ON VIEW parking_space_ingestion_metrics IS 'Data quality metrics for monitoring ingestion health';
