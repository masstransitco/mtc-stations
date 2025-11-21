# Metered Parking Grouping Analysis

## Executive Summary

We can successfully group Hong Kong's 20,374 individual metered parking spaces into **1,310 logical carpark groups** based on their geographic location and administrative naming.

## Grouping Strategy

### Grouping Key
Group parking spaces by:
1. **District** (e.g., "SAI KUNG", "SHAM SHUI PO")
2. **SubDistrict** (e.g., "HANG HAU EAST", "LAI CHI KOK NORTH")
3. **Street** (e.g., "CLEAR WATER BAY SECOND BEACH")
4. **SectionOfStreet** (e.g., "CLEAR WATER BAY SECOND BEACH CAR PARK")

This creates natural groupings that represent physical carpark locations.

## Group Statistics

### Overall Numbers
- **Total Groups**: 1,310 metered carparks
- **Total Spaces**: 20,374 individual parking spaces
- **Average Group Size**: 15.6 spaces per carpark

### Group Size Distribution

| Threshold | Number of Groups |
|-----------|-----------------|
| ≥ 2 spaces | 1,270 (97%) |
| ≥ 5 spaces | 974 (74%) |
| ≥ 10 spaces | 650 (50%) |
| ≥ 20 spaces | 332 (25%) |
| ≥ 50 spaces | 66 (5%) |
| ≥ 100 spaces | 6 (<1%) |

### Size Percentiles
- **Minimum**: 1 space
- **25th percentile**: 4 spaces
- **Median**: 9 spaces
- **75th percentile**: 20 spaces
- **Maximum**: 168 spaces

## Sample Large Carparks (Top 10)

| Rank | Carpark Name | District | Spaces | Geographic Spread |
|------|-------------|----------|--------|------------------|
| 1 | Clear Water Bay Second Beach Car Park | Sai Kung | 168 | 83m × 65m |
| 2 | Tai Mei Tuk Car Park | Tai Po | 163 | 81m × 77m |
| 3 | Gold Coast Hotel Car Park | Tuen Mun | 160 | 61m × 120m |
| 4 | Butterfly Beach Car Park | Tuen Mun | 152 | 104m × 147m |
| 5 | Tsui Lai Car Park | Northern | 103 | 66m × 60m |
| 6 | Dai Shing Street Car Park | Tai Po | 102 | 174m × 46m |
| 7 | Shun Ning Road 2 | Sham Shui Po | 98 | 674m × 783m* |
| 8 | Pak Tam Chung Car Park | Sai Kung | 98 | 140m × 72m |
| 9 | Wang Lok Street Car Park | Yuen Long | 94 | 64m × 73m |
| 10 | Yuen Tun Circuit | Tsuen Wan | 88 | 76m × 122m |

*Note: Some "groups" like "Shun Ning Road 2" may represent on-street parking along a long road segment rather than a concentrated carpark.

## Geographic Clustering Observations

### Compact Carparks (< 150m diameter)
Most groups represent compact, dedicated car parks similar to traditional multi-bay parking facilities:
- Clear Water Bay: 168 spaces in ~83m × 65m area
- Tai Mei Tuk: 163 spaces in ~81m × 77m area
- Wang Lok Street: 94 spaces in ~64m × 73m area

### Linear/Street Parking (> 500m length)
Some groups represent on-street metered parking along road segments:
- Shun Ning Road 2: 98 spaces spread over ~674m × 783m
- These are still logically grouped as one "carpark" in the government system

## District Distribution

| District | Spaces | % of Total |
|----------|--------|------------|
| Kowloon City | 2,632 | 12.9% |
| Sai Kung | 1,975 | 9.7% |
| Yau Tsim Mong | 1,954 | 9.6% |
| Sha Tin | 1,701 | 8.3% |
| Tai Po | 1,633 | 8.0% |
| Sham Shui Po | 1,402 | 6.9% |
| Tuen Mun | 1,298 | 6.4% |
| Yuen Long | 1,226 | 6.0% |
| Northern | 1,115 | 5.5% |
| Wan Chai | 1,032 | 5.1% |
| Others | 4,406 | 21.6% |

## Implementation Recommendations

### Option 1: Aggregate to Carpark Level (Recommended)
**Approach**: Group individual spaces and aggregate their occupancy data

**Benefits**:
- Reduces map complexity from 20,374 markers to 1,310 markers
- Matches user mental model (people look for "carparks" not individual spaces)
- Consistent with existing carpark vacancy display
- Easier to visualize and navigate

**Data Structure**:
```json
{
  "carpark_id": "SAI_KUNG_CLEAR_WATER_BAY_SECOND_BEACH",
  "name": "Clear Water Bay Second Beach Car Park",
  "district": "Sai Kung",
  "total_spaces": 168,
  "vacant_spaces": 42,
  "occupied_spaces": 126,
  "vacancy_rate": 25.0,
  "latitude": 22.287738,
  "longitude": 114.286719
}
```

**Display**:
- Circular marker (like existing carparks) with vacancy count
- Color gradient based on availability
- Click to see details (street, section, pricing, hours)

### Option 2: Show Individual Spaces
**Approach**: Display all 20,374 individual parking spaces

**Benefits**:
- Maximum detail and accuracy
- Shows exact location of each space

**Drawbacks**:
- 20,374 markers will clutter the map
- Poor UX at typical zoom levels
- Performance concerns
- Users don't typically need space-level precision for metered parking

### Option 3: Hybrid Approach
**Approach**:
- Show aggregated carparks by default
- Allow drill-down to individual spaces on click or at high zoom

**Benefits**:
- Best of both worlds
- Progressive disclosure of detail

**Complexity**: Higher implementation effort

## Real-Time Occupancy Coverage

Based on the occupancy API analysis:
- **Total Metered Spaces**: 20,374
- **Spaces with Real-Time Data**: ~6,800 (33%)
- **Coverage**: Only newer "smart" parking meters have sensors

### Recommendation
Filter to only show carparks with real-time occupancy data:
- Groups where at least 50% of spaces have real-time data
- Or groups where >10 spaces have real-time tracking
- This will reduce the ~1,310 groups to a more meaningful subset

## Database Schema Proposal

### Tables

**`metered_carpark_info`** - Static carpark groups
```sql
CREATE TABLE metered_carpark_info (
  carpark_id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  name_tc VARCHAR,
  name_sc VARCHAR,
  region VARCHAR,
  district VARCHAR,
  district_tc VARCHAR,
  sub_district VARCHAR,
  sub_district_tc VARCHAR,
  street VARCHAR,
  street_tc VARCHAR,
  section_of_street VARCHAR,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  total_spaces INTEGER NOT NULL,
  vehicle_types VARCHAR[], -- Array of A/C/G
  operating_periods VARCHAR[], -- Array of D/H/J/etc
  created_at TIMESTAMP DEFAULT NOW()
);
```

**`metered_space_info`** - Individual space details (for reference)
```sql
CREATE TABLE metered_space_info (
  parking_space_id VARCHAR PRIMARY KEY,
  carpark_id VARCHAR REFERENCES metered_carpark_info,
  pole_id INTEGER,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  vehicle_type CHAR(1), -- A/C/G
  longest_parking_period INTEGER, -- minutes
  operating_period VARCHAR(10),
  time_unit INTEGER, -- minutes
  payment_unit NUMERIC(5,2), -- HKD
  has_real_time_tracking BOOLEAN DEFAULT false
);
```

**`metered_space_occupancy_snapshots`** - Time-series data
```sql
CREATE TABLE metered_space_occupancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  parking_space_id VARCHAR,
  meter_status VARCHAR(10), -- N/NU
  occupancy_status VARCHAR(10), -- O/V
  occupancy_date_changed TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  is_vacant BOOLEAN GENERATED ALWAYS AS (occupancy_status = 'V') STORED
);
```

### Views

**`latest_metered_carpark_occupancy`** - Aggregated real-time view
```sql
CREATE VIEW latest_metered_carpark_occupancy AS
WITH latest_spaces AS (
  SELECT DISTINCT ON (parking_space_id)
    parking_space_id,
    occupancy_status,
    is_vacant,
    occupancy_date_changed
  FROM metered_space_occupancy_snapshots
  WHERE meter_status = 'N' -- Only active meters
  ORDER BY parking_space_id, ingested_at DESC
)
SELECT
  c.carpark_id,
  c.name,
  c.district,
  c.latitude,
  c.longitude,
  c.total_spaces,
  COUNT(s.parking_space_id) as tracked_spaces,
  SUM(CASE WHEN ls.is_vacant THEN 1 ELSE 0 END) as vacant_spaces,
  SUM(CASE WHEN NOT ls.is_vacant THEN 1 ELSE 0 END) as occupied_spaces,
  ROUND(SUM(CASE WHEN ls.is_vacant THEN 1 ELSE 0 END)::numeric /
        NULLIF(COUNT(s.parking_space_id), 0) * 100, 1) as vacancy_rate
FROM metered_carpark_info c
LEFT JOIN metered_space_info s ON s.carpark_id = c.carpark_id
LEFT JOIN latest_spaces ls ON ls.parking_space_id = s.parking_space_id
GROUP BY c.carpark_id, c.name, c.district, c.latitude, c.longitude, c.total_spaces;
```

## Next Steps

1. **Data Import**: Parse GeoJSON and create carpark groups
2. **Database Setup**: Create tables and import static data
3. **Cron Job**: Set up 5-minute occupancy ingestion
4. **API Endpoint**: Create `/api/metered-carparks` endpoint
5. **Map Integration**: Add metered carpark markers with aggregated vacancy
6. **Testing**: Verify grouping logic and occupancy calculations

## Conclusion

Grouping the 20,374 individual metered parking spaces into 1,310 logical carparks is:
- ✅ **Feasible**: Clear grouping criteria based on existing fields
- ✅ **Effective**: Reduces complexity while maintaining accuracy
- ✅ **User-friendly**: Matches how people think about parking
- ✅ **Performant**: Manageable number of map markers
- ✅ **Scalable**: Can drill down to space-level if needed

**Recommendation**: Proceed with Option 1 (Aggregate to Carpark Level) for initial implementation.
