-- Add indoor_venue_id column to connected_carparks
-- This stores the UUID of the indoor venue from the PMTiles data
-- Used to filter the indoor overlay to show only the selected carpark's venue

ALTER TABLE connected_carparks
ADD COLUMN IF NOT EXISTS indoor_venue_id TEXT;

-- Update venue IDs based on carpark name matching
-- Data from analysis/connected-carparks-venue-overlap.csv

UPDATE connected_carparks SET indoor_venue_id = 'd444d110-8f0b-4ca4-8da6-72c4a1e6747c' WHERE name ILIKE '%V City%';
UPDATE connected_carparks SET indoor_venue_id = 'b44cf139-5938-408b-af48-649dfd09694e' WHERE name ILIKE '%Tai Po Market%';
UPDATE connected_carparks SET indoor_venue_id = 'e0b46dd5-03c0-47b9-bca8-5a0e3e7d8a23' WHERE name ILIKE '%Tseung Kwan O Station%';
UPDATE connected_carparks SET indoor_venue_id = 'c0f44c5a-428f-4aad-b685-e17cb03a9971' WHERE name ILIKE '%Cheung Wah Industrial%';
UPDATE connected_carparks SET indoor_venue_id = 'b20660aa-e70c-4f68-9976-ad43e189af2d' WHERE name ILIKE '%Reason Group Tower%';
UPDATE connected_carparks SET indoor_venue_id = 'd8a56ae7-c4e1-42f2-8295-75da2610f05a' WHERE name ILIKE '%International Enterprise Centre%';
UPDATE connected_carparks SET indoor_venue_id = '2bc15dfc-bd37-4c4b-8d1f-0e961caa1dfc' WHERE name ILIKE '%83 Tai Lin Pai%';
UPDATE connected_carparks SET indoor_venue_id = '7f585493-62ff-454d-95a6-e9ad08a29106' WHERE name ILIKE '%Megacube%';
UPDATE connected_carparks SET indoor_venue_id = 'c1a340b1-0065-411c-892b-39c5a8bd4142' WHERE name ILIKE '%Centre Parc%';
UPDATE connected_carparks SET indoor_venue_id = '669659e0-4b83-4113-a116-b45db6d5794d' WHERE name ILIKE '%CCT Telecom%';
UPDATE connected_carparks SET indoor_venue_id = '889dcb57-e012-4cb9-8180-8b33e76c83a8' WHERE name ILIKE '%International Trade Centre%';
UPDATE connected_carparks SET indoor_venue_id = 'fc14426e-a7ac-4814-9a85-4be633252aea' WHERE name ILIKE '%Trend Plaza%';
UPDATE connected_carparks SET indoor_venue_id = '00fe3d57-a38d-4b5a-8f27-15045af7380b' WHERE name ILIKE '%COS Centre%';
UPDATE connected_carparks SET indoor_venue_id = '069568ca-7779-44ea-8773-7a6d9a0839b5' WHERE name ILIKE '%Everest Industrial%';
UPDATE connected_carparks SET indoor_venue_id = '1652598f-c2c2-458c-951f-64366586a5e1' WHERE name ILIKE '%Kwai Hing Government%';
UPDATE connected_carparks SET indoor_venue_id = '87a12555-5f85-4e4f-b7a2-afdb703fe7e3' WHERE name ILIKE '%PopCorn%';
UPDATE connected_carparks SET indoor_venue_id = '5b5385db-0989-41b3-ad6b-9bcb2916a16b' WHERE name ILIKE '%Kowloon City Government%';
UPDATE connected_carparks SET indoor_venue_id = '7c697c97-720f-4f4a-9fa3-fdb6bcd008db' WHERE name ILIKE '%Maritime%' OR name ILIKE '%青衣城%';
UPDATE connected_carparks SET indoor_venue_id = '44b25699-624e-461b-a452-bba3f796fa23' WHERE name ILIKE '%Grand Central Plaza%';
UPDATE connected_carparks SET indoor_venue_id = '9a64c7d4-17fd-4ae9-954c-34ebbcaf2645' WHERE name ILIKE '%Mong Kok East%';
UPDATE connected_carparks SET indoor_venue_id = 'ec16c323-c77f-4f76-a6ba-2a9a65fe7937' WHERE name ILIKE '%Nam Cheong%';
UPDATE connected_carparks SET indoor_venue_id = 'f9f93951-67f2-4b98-b86c-a3fec6209fe5' WHERE name ILIKE '%Kwun Tong Station%';
UPDATE connected_carparks SET indoor_venue_id = '304a44c9-2c10-4a17-828b-6dbb59d1ddbf' WHERE name ILIKE '%Metro Centre%';
UPDATE connected_carparks SET indoor_venue_id = '6fbe327d-d208-4734-85c8-40e5a3eb5d3b' WHERE name ILIKE '%Millennium City 2%';
UPDATE connected_carparks SET indoor_venue_id = 'b672b181-8e8f-4e10-8cd1-035241405003' WHERE name ILIKE '%Millennium City 1%';
UPDATE connected_carparks SET indoor_venue_id = 'cd730608-8a49-4d4e-b440-77d0c00c74e8' WHERE name ILIKE '%Chinachem Tsuen Wan%';
UPDATE connected_carparks SET indoor_venue_id = '1b5a957e-cfb6-4e19-97c2-7cebe05612be' WHERE name ILIKE '%Peninsula Tower%';
UPDATE connected_carparks SET indoor_venue_id = 'c35ffdb7-b7f2-456a-a736-bc27fae5957b' WHERE name ILIKE '%Honour Industrial%';
UPDATE connected_carparks SET indoor_venue_id = 'f9b2a10d-6804-40ed-a0a9-82c3c80383bf' WHERE name ILIKE '%Skyline Plaza%';
UPDATE connected_carparks SET indoor_venue_id = '63e7d8cb-eee6-4144-bca0-bb61e5016212' WHERE name ILIKE '%Premier Centre%';
UPDATE connected_carparks SET indoor_venue_id = '402d0a0a-e6df-4a19-952d-6fc371dedc2e' WHERE name ILIKE '%Causeway Bay Station%';
UPDATE connected_carparks SET indoor_venue_id = 'bdefc096-9715-4987-a2d0-910cfdf95132' WHERE name ILIKE '%LOHAS%';
UPDATE connected_carparks SET indoor_venue_id = 'e279ca60-ec56-4186-8839-09c0048f60c2' WHERE name ILIKE '%Tai Wai Station%';
UPDATE connected_carparks SET indoor_venue_id = 'b9b2f6ff-582d-40b0-b82d-027e950e6791' WHERE name ILIKE '%Admiralty%';
UPDATE connected_carparks SET indoor_venue_id = 'c270ead6-7bea-4034-90f5-aca854937177' WHERE name ILIKE '%Tung Chung%';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_connected_carparks_indoor_venue_id ON connected_carparks(indoor_venue_id);
