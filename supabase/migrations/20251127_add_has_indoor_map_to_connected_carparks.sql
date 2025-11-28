-- Add has_indoor_map column to connected_carparks
-- This flag indicates which carparks have indoor venue tile data available

ALTER TABLE connected_carparks
ADD COLUMN IF NOT EXISTS has_indoor_map BOOLEAN DEFAULT FALSE;

-- Update carparks that have matching indoor venue data
-- These were identified by matching connected carpark names with the indoor venue list
-- from analysis/connected-carparks-venue-list.csv

UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'CCT Telecom Building';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Centre Parc';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Chinachem Tsuen Wan Plaza';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Cos Centre';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Honour Industrial Centre';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'International Trade Centre';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Maritime Square 1';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Millennium City 1';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Millennium City 2 & 3';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Peninsula Tower';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Popcorn 1';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'Skyline Plaza';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'The Lohas';
UPDATE connected_carparks SET has_indoor_map = TRUE WHERE name = 'V City';

-- Add comment for documentation
COMMENT ON COLUMN connected_carparks.has_indoor_map IS 'Whether this carpark has indoor venue tile data available for 3D rendering';
