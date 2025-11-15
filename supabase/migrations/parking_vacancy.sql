-- Parking Vacancy Data Migration
-- Creates tables for storing Hong Kong Government car park vacancy data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Car park basic information table (optional - for reference data)
CREATE TABLE IF NOT EXISTS carpark_info (
  park_id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  display_address TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  district TEXT,
  nature VARCHAR(20),  -- 'government' or 'commercial'
  carpark_type VARCHAR(50),  -- 'multi-storey', 'off-street', 'metered'
  opening_status VARCHAR(20),  -- 'OPEN' or 'CLOSED'
  contact_no TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_carpark_info_location
  ON carpark_info(latitude, longitude);

-- Create index for district filtering
CREATE INDEX IF NOT EXISTS idx_carpark_info_district
  ON carpark_info(district);

-- Parking vacancy snapshots table (main data table)
CREATE TABLE IF NOT EXISTS parking_vacancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  park_id VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL,  -- 'privateCar', 'LGV', 'HGV', 'CV', 'coach', 'motorCycle'
  vacancy_type CHAR(1) NOT NULL,  -- 'A', 'B', 'C'
  vacancy INTEGER NOT NULL,
  vacancy_dis INTEGER,  -- Disabled parking spaces available
  vacancy_ev INTEGER,   -- EV charging spaces available
  vacancy_unl INTEGER,  -- Unloading spaces available
  category VARCHAR(20), -- 'HOURLY', 'DAILY', 'MONTHLY'
  lastupdate TIMESTAMP NOT NULL,  -- From API (car park owner's timestamp)
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- When we ingested this data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_park_id
  ON parking_vacancy_snapshots(park_id);

CREATE INDEX IF NOT EXISTS idx_parking_vacancy_vehicle_type
  ON parking_vacancy_snapshots(vehicle_type);

CREATE INDEX IF NOT EXISTS idx_parking_vacancy_ingested_at
  ON parking_vacancy_snapshots(ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_parking_vacancy_park_vehicle
  ON parking_vacancy_snapshots(park_id, vehicle_type, ingested_at DESC);

-- Create index for time-series queries
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_lastupdate
  ON parking_vacancy_snapshots(lastupdate DESC);

-- Composite index for latest vacancy queries
CREATE INDEX IF NOT EXISTS idx_parking_vacancy_latest
  ON parking_vacancy_snapshots(park_id, vehicle_type, lastupdate DESC);

-- Add comment to tables
COMMENT ON TABLE carpark_info IS 'Basic information about Hong Kong car parks';
COMMENT ON TABLE parking_vacancy_snapshots IS 'Time-series parking vacancy data snapshots';

-- Add comments to important columns
COMMENT ON COLUMN parking_vacancy_snapshots.vacancy_type IS 'A=Actual count, B=Availability flag, C=Closed';
COMMENT ON COLUMN parking_vacancy_snapshots.lastupdate IS 'Timestamp from car park operator (API data)';
COMMENT ON COLUMN parking_vacancy_snapshots.ingested_at IS 'Timestamp when we ingested this record';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_carpark_info_updated_at
  BEFORE UPDATE ON carpark_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional - uncomment if needed)
-- ALTER TABLE carpark_info ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE parking_vacancy_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (optional - uncomment if needed)
-- CREATE POLICY "Public read access" ON carpark_info FOR SELECT USING (true);
-- CREATE POLICY "Public read access" ON parking_vacancy_snapshots FOR SELECT USING (true);

-- Grant permissions (adjust as needed for your service role)
-- GRANT SELECT, INSERT, UPDATE ON carpark_info TO service_role;
-- GRANT SELECT, INSERT ON parking_vacancy_snapshots TO service_role;
-- GRANT USAGE, SELECT ON SEQUENCE parking_vacancy_snapshots_id_seq TO service_role;
