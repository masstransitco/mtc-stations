# Metered Parking Implementation

## Overview

This document describes the implementation of the metered parking tracking system, which monitors and displays real-time occupancy data for 648 on-street metered carparks across Hong Kong, covering 17,219 parking spaces.

## System Architecture

### Data Flow
```
Government API (CSV)
  → Cron Job (Every 5 minutes)
  → Database (Snapshots + Aggregation)
  → REST API
  → Frontend (Map Markers + Details Component)
```

## Data Source

### Government API
- **Endpoint**: `https://resource.data.one.gov.hk/td/psiparkingspaces/`
  - **Space Info**: `spaceinfo/parkingspaces.csv` (Static data, 20,374 spaces)
  - **Occupancy Status**: `occupancystatus/occupancystatus.csv` (Real-time, updated every 5 min)

### Data Coverage
- **Total Spaces**: 20,374 individual metered parking spaces
- **Spaces with Real-time Tracking**: ~6,800 spaces (33%)
- **Grouped into Carparks**: 648 carparks (with ≥10 spaces per group)
- **Coverage**: 17,219 spaces with real-time data (98.6% of grouped spaces)

### Grouping Strategy
Individual parking spaces are grouped into logical carparks using:
- **District** + **SubDistrict** + **Street** + **SectionOfStreet**
- Minimum 10 spaces per carpark
- Geospatial centroid calculated from average lat/lng of all spaces

## Database Schema

### Tables

#### 1. `metered_carpark_info`
Static information about carpark groups.

```sql
CREATE TABLE metered_carpark_info (
  carpark_id VARCHAR(255) PRIMARY KEY,        -- Composite ID from location hierarchy
  name VARCHAR(255) NOT NULL,                 -- English name (e.g., "SHAN TONG ROAD 2")
  name_tc VARCHAR(255),                       -- Traditional Chinese name
  district VARCHAR(100) NOT NULL,             -- District (e.g., "TAI PO")
  district_tc VARCHAR(100),                   -- District in Chinese
  latitude NUMERIC(10, 7) NOT NULL,           -- Centroid latitude
  longitude NUMERIC(10, 7) NOT NULL,          -- Centroid longitude
  total_spaces INTEGER NOT NULL,              -- Total parking spaces in group
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Record**:
```json
{
  "carpark_id": "TAI_PO_TAI_PO_KAU_SHAN_TONG_ROAD_SHAN_TONG_ROAD_2",
  "name": "SHAN TONG ROAD 2",
  "name_tc": "山塘路 2",
  "district": "TAI PO",
  "latitude": 22.4406204,
  "longitude": 114.1702589,
  "total_spaces": 23
}
```

#### 2. `metered_space_info`
Individual parking space details.

```sql
CREATE TABLE metered_space_info (
  parking_space_id VARCHAR(50) PRIMARY KEY,   -- Government space ID
  carpark_id VARCHAR(255) REFERENCES metered_carpark_info(carpark_id),
  pole_id INTEGER,                            -- Physical pole/meter ID
  latitude NUMERIC(10, 7) NOT NULL,           -- Exact space location
  longitude NUMERIC(10, 7) NOT NULL,
  vehicle_type VARCHAR(10),                   -- A (Any), C (Coach), G (Goods)
  longest_parking_period INTEGER,             -- Max parking minutes
  operating_period VARCHAR(255),              -- e.g., "0800-2000"
  time_unit INTEGER,                          -- Minutes per billing unit
  payment_unit NUMERIC(10, 2),                -- Cost per time unit (HKD)
  has_real_time_tracking BOOLEAN DEFAULT false -- Updated by cron job
);
```

#### 3. `metered_space_occupancy_snapshots`
Time-series occupancy data.

```sql
CREATE TABLE metered_space_occupancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  parking_space_id VARCHAR(50) NOT NULL,
  meter_status VARCHAR(10) NOT NULL,          -- 'N' (Normal) or 'NU' (Not Updated)
  occupancy_status VARCHAR(10) NOT NULL,      -- 'V' (Vacant) or 'O' (Occupied)
  occupancy_date_changed TIMESTAMPTZ,         -- When status last changed
  ingested_at TIMESTAMPTZ DEFAULT NOW(),      -- When we recorded this snapshot

  -- Generated columns for query optimization
  is_valid BOOLEAN GENERATED ALWAYS AS (meter_status = 'N') STORED,
  is_vacant BOOLEAN GENERATED ALWAYS AS (occupancy_status = 'V') STORED
);

CREATE INDEX idx_metered_occupancy_space_time
  ON metered_space_occupancy_snapshots(parking_space_id, ingested_at DESC);
CREATE INDEX idx_metered_occupancy_ingested
  ON metered_space_occupancy_snapshots(ingested_at DESC);
```

### Views

#### `latest_metered_carpark_occupancy`
Aggregated real-time data per carpark (used by API).

```sql
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
  COUNT(s.parking_space_id) as tracked_spaces,        -- Spaces with sensors
  COUNT(ls.parking_space_id) as spaces_with_data,     -- Spaces with current data
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
LEFT JOIN metered_space_info s
  ON s.carpark_id = c.carpark_id AND s.has_real_time_tracking = true
LEFT JOIN latest_spaces ls
  ON ls.parking_space_id = s.parking_space_id
GROUP BY c.carpark_id, c.name, c.name_tc, c.district, c.district_tc,
         c.latitude, c.longitude, c.total_spaces
HAVING COUNT(ls.parking_space_id) > 0;
```

## Backend Implementation

### 1. Data Import Script
**File**: `scripts/import-metered-carparks.ts`

One-time script to import static carpark and space data:

```typescript
// Fetches parkingspaces.csv
// Groups spaces by location hierarchy
// Calculates centroid coordinates
// Filters to carparks with ≥10 spaces
// Inserts into metered_carpark_info and metered_space_info
```

**Usage**:
```bash
export NEXT_PUBLIC_SUPABASE_URL="..." && \
export SUPABASE_SERVICE_ROLE_KEY="..." && \
npx tsx scripts/import-metered-carparks.ts
```

### 2. Cron Job - Occupancy Ingestion
**File**: `app/api/cron/metered-carpark-occupancy/route.ts`

**Schedule**: Every 5 minutes (configured in `vercel.json`)

**Process**:
1. Verify cron secret authentication
2. Fetch `occupancystatus.csv` from government API
3. Parse CSV (20,394 records)
4. Transform date format: `"11/17/2025 02:06:04 PM"` → ISO 8601 with HK timezone
5. Batch insert snapshots (100 records per batch)
6. Update `has_real_time_tracking` flags (500 space IDs per batch)
7. Log statistics and return summary

**Key Features**:
- **Batch processing** to avoid URI size limits (Cloudflare 414 errors)
- **Date parsing** for government CSV format with 12/24-hour conversion
- **Tracking flag updates** to identify spaces with active sensors

**Response Example**:
```json
{
  "success": true,
  "timestamp": "2025-11-17T08:00:41.086Z",
  "total_records": 20394,
  "valid_records": 20085,
  "invalid_records": 309,
  "vacant_count": 5549,
  "occupied_count": 14536,
  "vacancy_rate": 28,
  "inserted": 20394
}
```

### 3. REST API - Carpark Data
**File**: `app/api/metered-carparks/route.ts`

**Endpoint**: `GET /api/metered-carparks`

**Query Parameters**:
- `district` - Filter by district (e.g., "TAI PO")
- `minVacancy` - Minimum vacant spaces
- `limit` - Max results to return

**Features**:
- Queries `latest_metered_carpark_occupancy` view
- Orders by vacancy rate (descending)
- **Critical**: Appends `Z` to timestamps to ensure UTC parsing
- Cache: 60s public, 120s stale-while-revalidate

**Timestamp Fix**:
```typescript
// Without 'Z', JavaScript parses as local time (wrong!)
// With 'Z', JavaScript parses as UTC (correct!)
const dataWithTimezone = data.map(carpark => ({
  ...carpark,
  last_updated: carpark.last_updated ? `${carpark.last_updated}Z` : null
}));
```

**Response Example**:
```json
[
  {
    "carpark_id": "TAI_PO_TAI_PO_KAU_SHAN_TONG_ROAD_SHAN_TONG_ROAD_2",
    "name": "SHAN TONG ROAD 2",
    "name_tc": "山塘路 2",
    "district": "TAI PO",
    "district_tc": "大埔",
    "latitude": 22.4406204,
    "longitude": 114.1702589,
    "total_spaces": 23,
    "tracked_spaces": 23,
    "spaces_with_data": 23,
    "vacant_spaces": 23,
    "occupied_spaces": 0,
    "vacancy_rate": 100,
    "last_updated": "2025-11-17T08:00:35.963068Z"
  }
]
```

## Frontend Implementation

### 1. TypeScript Types
**File**: `types/metered-carpark.ts`

```typescript
export type VehicleType = 'A' | 'C' | 'G';  // Any, Coach, Goods
export type MeterStatus = 'N' | 'NU';       // Normal, Not Updated
export type OccupancyStatus = 'O' | 'V';    // Occupied, Vacant

export interface MeteredCarpark {
  carpark_id: string;
  name: string;
  name_tc: string;
  district: string;
  district_tc: string;
  latitude: number;
  longitude: number;
  total_spaces: number;
  tracked_spaces: number;
  spaces_with_data: number;
  vacant_spaces: number;
  occupied_spaces: number;
  vacancy_rate: number;
  last_updated: string | null;
}
```

### 2. Map Markers
**File**: `components/simple-map.tsx`

**Visual Design**:
- **Shape**: Rounded square (8px border-radius) to distinguish from circular multi-storey carparks
- **Size**: 44x44px outer, 32x32px inner
- **Style**: Glassmorphic with backdrop blur
- **Color**: Vacancy-based gradient (same as other carparks)
- **Content**: Vacant space count

**Implementation**:
```tsx
{showMeteredCarparks && meteredCarparks.map((carpark) => (
  <AdvancedMarker
    key={carpark.carpark_id}
    position={{ lat: carpark.latitude, lng: carpark.longitude }}
    onClick={() => handleMeteredCarparkMarkerClick(carpark)}
    zIndex={carpark.vacant_spaces}
  >
    <div style={{ width: '44px', height: '44px', position: 'relative' }}>
      {/* Glassmorphic outer ring */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: '8px',  // ROUNDED SQUARE
        background: `${getMarkerColor(carpark.vacant_spaces)}20`,
        backdropFilter: 'blur(8px)',
        border: `2px solid ${getMarkerColor(carpark.vacant_spaces)}`
      }} />

      {/* Inner content */}
      <div style={{
        position: 'relative',
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        background: getMarkerColor(carpark.vacant_spaces),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>
          {carpark.vacant_spaces}
        </span>
      </div>
    </div>
  </AdvancedMarker>
))}
```

**Marker Differentiation**:
| Type | Shape | Radius | Size | Content |
|------|-------|--------|------|---------|
| Multi-storey Carpark | Circle | 50% | 40px | "P" icon |
| Metered Carpark | Rounded Square | 8px | 44px | Vacant count |
| Non-metered Space | Small Square | 4px | 24px | Vehicle type |

### 3. Details Component
**File**: `components/metered-carpark-details.tsx`

**Sections**:

1. **Header**
   - English name + "METERED" badge
   - Chinese name (if available)
   - District badge

2. **Vacancy Grid** (2 columns)
   - Available spaces (color-coded)
   - Occupied spaces with % full

3. **Total Spaces Info**
   - Total parking spaces
   - Real-time tracking coverage with %

4. **Vacancy Rate Bar**
   - Visual progress bar
   - Percentage display

5. **Last Updated**
   - Timestamp in Hong Kong timezone
   - Format: "Nov 17, 04:00 PM"

**Key Implementation Details**:
```tsx
// Calculate occupancy percentage
const occupancyRate = carpark.tracked_spaces > 0
  ? Math.round((carpark.occupied_spaces / carpark.tracked_spaces) * 100)
  : 0;

// Timezone-aware timestamp display
{new Date(carpark.last_updated).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Hong_Kong'  // CRITICAL for correct display
})}
```

### 4. Bottom Sheet Integration
**File**: `components/simple-map.tsx`

**View States**:
- `'home'` - Search + Trending carparks
- `'nearby'` - Search results
- `'station'` - Multi-storey carpark details
- `'metered-carpark'` - Metered carpark details ← NEW

**Navigation Flow**:
```
Click Metered Marker
  → setSelectedMeteredCarpark(carpark)
  → setBottomSheetView('metered-carpark')
  → setIsBottomSheetOpen(true)
  → Renders MeteredCarparkDetails component
```

**Back Button Logic**:
```tsx
const handleBottomSheetBack = () => {
  if (bottomSheetView === 'station') {
    setBottomSheetView(nearbyCarparks.length > 0 ? 'nearby' : 'home');
    setSelectedCarpark(null);
  } else if (bottomSheetView === 'metered-carpark') {
    setBottomSheetView('home');
    setSelectedMeteredCarpark(null);  // Clear selection
  } else if (bottomSheetView === 'nearby') {
    setBottomSheetView('home');
    setSearchLocation(null);
    setNearbyCarparks([]);
  }
};
```

## Deployment Configuration

### Vercel Cron Jobs
**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/carpark-vacancy",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/parking-space-occupancy",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/metered-carpark-occupancy",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Authentication**:
Cron endpoints require:
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Environment Variables Required
```env
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=your-secret-key
```

## Known Issues & Solutions

### Issue 1: "414 Request-URI Too Large"
**Problem**: Updating `has_real_time_tracking` for 20,000+ space IDs in one query exceeded Cloudflare's URI limit.

**Solution**: Batch UPDATE operations into groups of 500 space IDs.

```typescript
const updateBatchSize = 500;
for (let i = 0; i < uniqueSpaceIds.length; i += updateBatchSize) {
  const batch = uniqueSpaceIds.slice(i, i + updateBatchSize);
  await supabase
    .from('metered_space_info')
    .update({ has_real_time_tracking: true })
    .in('parking_space_id', batch);
}
```

### Issue 2: Incorrect Timezone Display
**Problem**: Timestamps from database (e.g., `2025-11-17T08:00:35.963068`) were parsed as local time instead of UTC, showing "08:00 AM" when actual Hong Kong time was "04:00 PM".

**Solution**: Append `Z` to indicate UTC in API response.

```typescript
const dataWithTimezone = data.map(carpark => ({
  ...carpark,
  last_updated: carpark.last_updated ? `${carpark.last_updated}Z` : null
}));
```

### Issue 3: CSV Date Parsing
**Problem**: Government API returns dates in format `"11/17/2025 02:06:04 PM"`.

**Solution**: Custom parser for 12-hour → 24-hour conversion.

```typescript
function parseDateFromCSV(dateStr: string): string {
  const [datePart, timePart, period] = dateStr.split(' ');
  const [month, day, year] = datePart.split('/');
  let [hours, minutes, seconds] = timePart.split(':');

  let hour = parseInt(hours);
  if (period === 'PM' && hour !== 12) hour += 12;
  else if (period === 'AM' && hour === 12) hour = 0;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minutes}:${seconds}+08:00`;
}
```

## Performance Considerations

### Database Optimization
- **Indexes** on `parking_space_id` and `ingested_at` for fast lookups
- **Generated columns** (`is_valid`, `is_vacant`) for query optimization
- **Views** with CTEs to avoid repeated subqueries
- **DISTINCT ON** for efficient latest-record selection

### Frontend Optimization
- **Cache headers**: 60s public cache, 120s stale-while-revalidate
- **Collision behavior**: `OPTIONAL_AND_HIDES_LOWER_PRIORITY` for map markers
- **Z-index sorting**: Higher vacancy = higher z-index (more visible)

### Data Volume
- **Snapshots per hour**: ~122,364 records (6 ingestions × 20,394 records)
- **Snapshots per day**: ~2.9 million records
- **Recommended cleanup**: Prune snapshots older than 7 days

## Future Enhancements

### Potential Features
1. **Historical trend charts** (similar to multi-storey carparks)
2. **District-level statistics** aggregation
3. **Peak time analysis** (busy hours/days)
4. **Price information** display on details component
5. **Nearby metered spaces** list view
6. **Favorites/bookmarking** for frequent locations
7. **Push notifications** for availability changes
8. **Route navigation** to selected carpark

### Data Quality
1. **Monitoring dashboard** for ingestion metrics
2. **Alert system** for failed cron jobs
3. **Data staleness indicators** (>2 hours old)
4. **Sensor coverage visualization** (which spaces have tracking)

## Migration Files

### Location
`supabase/migrations/add_metered_carparks.sql`

### Contents
- Table creation (3 tables)
- Index creation (2 indexes)
- View creation (4 views)
- Comments and documentation

### Rollback Strategy
```sql
DROP VIEW IF EXISTS metered_ingestion_metrics CASCADE;
DROP VIEW IF EXISTS metered_carpark_statistics CASCADE;
DROP VIEW IF EXISTS latest_metered_carpark_occupancy CASCADE;
DROP VIEW IF EXISTS latest_metered_space_occupancy CASCADE;
DROP TABLE IF EXISTS metered_space_occupancy_snapshots CASCADE;
DROP TABLE IF EXISTS metered_space_info CASCADE;
DROP TABLE IF EXISTS metered_carpark_info CASCADE;
```

## Testing

### Manual API Testing
```bash
# Get all carparks
curl http://localhost:3000/api/metered-carparks

# Filter by district
curl http://localhost:3000/api/metered-carparks?district=TAI%20PO

# Get top 5 by vacancy
curl http://localhost:3000/api/metered-carparks?limit=5

# Test cron job (requires auth)
curl -X GET "http://localhost:3000/api/cron/metered-carpark-occupancy" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Database Verification
```sql
-- Check total carparks
SELECT COUNT(*) FROM metered_carpark_info;  -- Expected: 649

-- Check spaces with tracking
SELECT COUNT(*) FROM metered_space_info WHERE has_real_time_tracking = true;  -- Expected: ~17,000

-- Check recent snapshots
SELECT COUNT(*) FROM metered_space_occupancy_snapshots
WHERE ingested_at >= NOW() - INTERVAL '1 hour';  -- Expected: ~122,000

-- Check current vacancy rate
SELECT
  SUM(vacant_spaces) as total_vacant,
  SUM(occupied_spaces) as total_occupied,
  ROUND(AVG(vacancy_rate), 1) as avg_vacancy_rate
FROM latest_metered_carpark_occupancy;
```

## Related Documentation

- [Non-metered Parking Implementation](./non-metered-parking-implementation.md)
- [Bottom Sheet Navigation Architecture](./bottom-sheet-navigation-architecture.md)
- Government API Documentation: https://data.gov.hk/en-data/dataset/hk-td-tis_2-real-time-parking-information

## Changelog

### 2025-11-17
- ✅ Initial implementation
- ✅ Database schema and migration
- ✅ Import script for static data (649 carparks, 17,229 spaces)
- ✅ Cron job for occupancy ingestion (every 5 minutes)
- ✅ REST API with filtering and caching
- ✅ Map markers with rounded square design
- ✅ Details component with bottom sheet integration
- ✅ Fixed 414 error with batch updates
- ✅ Fixed timezone parsing with UTC indicator
- ✅ Fixed Hong Kong timezone display

## Contributors

Generated with Claude Code assistance
