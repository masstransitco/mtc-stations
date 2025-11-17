# Non-Metered Parking Space Implementation

## Overview

This document describes the implementation of real-time occupancy tracking for Hong Kong's 145 non-metered parking spaces in the New Territories. The system follows the same architecture pattern as the existing car park vacancy tracking system.

## Data Source

- **API Endpoint**: `https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus`
- **Format**: CSV (FeatureID, ParkingSpaceId, OccupancyStatus, OccupancyDateChanged)
- **Update Frequency**: Real-time updates via government API
- **Static Geometry**: GeoJSON file with 145 parking space locations
- **Geographic Coverage**: New Territories only

## Geographic Distribution

### By District
- **North District**: 81 spaces (55.9%)
- **Yuen Long District**: 26 spaces (17.9%)
- **Sha Tin District**: 19 spaces (13.1%)
- **Tai Po District**: 18 spaces (12.4%)
- **Sai Kung District**: 1 space (0.7%)

### By Sub-District (Top 5)
- Luk Keng: 58 spaces
- Pat Heung: 26 spaces
- Wu Kau Tang: 23 spaces
- Shuen Wan: 18 spaces
- Tai Wai: 7 spaces

### By Vehicle Type
- **A (Any)**: 122 spaces (84.1%)
- **D (Disabled)**: 20 spaces (13.8%)
- **C (Coach)**: 3 spaces (2.1%)

## Architecture

### 1. Database Schema

#### Tables

**`parking_space_info`** - Static reference data
```sql
- feature_id (INTEGER PRIMARY KEY)
- parking_space_id (VARCHAR UNIQUE)
- latitude, longitude (NUMERIC)
- region, district, sub_district, street (multilingual: EN/TC/SC)
- vehicle_type (CHAR: A/C/D)
```

**`parking_space_occupancy_snapshots`** - Time-series occupancy data
```sql
- id (BIGSERIAL PRIMARY KEY)
- feature_id (INTEGER FK)
- parking_space_id (VARCHAR)
- occupancy_status (VARCHAR: V/O/NU)
- occupancy_date_changed (TIMESTAMP)
- ingested_at (TIMESTAMP)
- is_valid (BOOLEAN) - Generated: status IN ('V', 'O')
- is_vacant (BOOLEAN) - Generated: status = 'V'
```

#### Views

**`latest_space_occupancy`**
- Most recent valid occupancy record per parking space
- Excludes 'NU' (Not Updated) records
- Includes `is_stale` flag (>2 hours old)

**`latest_space_occupancy_with_location`**
- Joins occupancy with location data
- Main view consumed by API endpoints
- Provides full context: status + location + metadata

**`parking_space_statistics`**
- Summary statistics by district and vehicle type
- Calculates vacancy rates and totals

**`parking_space_ingestion_metrics`**
- Data quality monitoring per ingestion batch
- Tracks valid/invalid/vacant/occupied counts

### 2. Data Ingestion

#### Cron Job: `/api/cron/parking-space-occupancy`

**Schedule**: Every 5 minutes (Vercel Cron)

**Process**:
1. Fetch CSV from government API
2. Parse CSV data (handles DD/MM/YYYY HH:MM:SS format)
3. Transform date strings to ISO 8601 format
4. Batch insert (100 records per batch)
5. Return quality metrics

**Date Parsing**:
```typescript
// Input: "16/11/2025 17:48:2"
// Output: "2025-11-16T17:48:02+08:00"
```

**Quality Metrics**:
```json
{
  "total_records": 145,
  "vacant_count": 49,
  "occupied_count": 21,
  "not_updated_count": 75,
  "valid_records": 70,
  "invalid_records": 75,
  "vacancy_rate": 70
}
```

#### One-Time Import: `scripts/import-parking-spaces.ts`

**Purpose**: Import static location data from GeoJSON

**Usage**:
```bash
DOTENV_CONFIG_PATH=.env.local npx tsx scripts/import-parking-spaces.ts
```

**Data Imported**:
- 145 parking space locations
- Multilingual location names (EN/TC/SC)
- Vehicle type classifications
- Coordinates and geographic hierarchy

### 3. API Layer

#### Endpoint: `GET /api/parking-spaces`

**Query Parameters**:
- `status`: Filter by occupancy (`vacant` | `occupied` | `all`)
- `district`: Filter by district name
- `vehicleType`: Filter by vehicle type (`A` | `C` | `D`)

**Response Format**:
```json
[
  {
    "feature_id": 101694,
    "parking_space_id": "A108_CL_008",
    "latitude": 22.518139,
    "longitude": 114.229105,
    "district": "North District",
    "district_tc": "北區",
    "sub_district": "Luk Keng",
    "sub_district_tc": "鹿頸",
    "street": "Bride's Pool Road",
    "street_tc": "新娘潭路",
    "section_of_street": "Near Bride's Pool ex-Bus Terminus",
    "vehicle_type": "A",
    "occupancy_status": "V",
    "is_vacant": true,
    "occupancy_date_changed": "2025-11-17T14:00:56+08:00",
    "is_stale": false
  }
]
```

**Default Behavior**: Returns only vacant spaces (`status=vacant`)

### 4. Frontend Integration

#### Map Display

**Marker Styling**:
- **Shape**: Square (24x24px) to distinguish from circular car park markers
- **Color**:
  - Green (`#10b981`) = Vacant
  - Red (`#ef4444`) = Occupied
- **Badge**: Shows vehicle type (A/C/D)
- **Border**: 2px white border with shadow

**Component**: `components/simple-map.tsx`

**State Management**:
```typescript
const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
const [showParkingSpaces, setShowParkingSpaces] = useState(true);
const [selectedParkingSpace, setSelectedParkingSpace] = useState<ParkingSpace | null>(null);
```

**Data Fetching**:
```typescript
useEffect(() => {
  fetch("/api/parking-spaces?status=vacant")
    .then(res => res.json())
    .then(data => setParkingSpaces(data));
}, []);
```

## Key Differences from Car Park System

| Aspect | Car Parks | Parking Spaces |
|--------|-----------|----------------|
| **Granularity** | 509 car parks | 145 individual spaces |
| **Occupancy Format** | Numeric vacancy count (0-300+) | Binary state (V/O/NU) |
| **Data Points per Ingestion** | ~636 records | 145 records |
| **Geographic Coverage** | All Hong Kong | New Territories only |
| **Marker Style** | Circular, gradient colors | Square, green/red |
| **Marker Icon** | "P" symbol | Vehicle type badge |
| **Color Coding** | Gradient (blue→purple→red) | Binary (green/red) |

## TypeScript Types

**File**: `types/parking-space.ts`

```typescript
export type VehicleType = 'A' | 'C' | 'D';
export type OccupancyStatus = 'V' | 'O' | 'NU';

export interface ParkingSpace {
  feature_id: number;
  parking_space_id: string;
  latitude: number;
  longitude: number;
  district: string;
  district_tc: string;
  sub_district: string;
  street: string;
  section_of_street: string;
  vehicle_type: VehicleType;
  occupancy_status: OccupancyStatus;
  is_vacant: boolean;
  occupancy_date_changed: string | null;
  is_stale: boolean;
}
```

## Data Quality Considerations

### Occupancy Status Codes
- **V (Vacant)**: Space is available
- **O (Occupied)**: Space is occupied
- **NU (Not Updated)**: Status unknown/not updated

### Data Validation
- Only 'V' and 'O' records are considered valid (`is_valid = true`)
- 'NU' records are excluded from `latest_space_occupancy` view
- Stale data flagged when `occupancy_date_changed > 2 hours ago`

### Typical Distribution (Based on Real Data)
- Valid records: ~48% (70/145)
- Vacant: ~34% (49/145)
- Occupied: ~14% (21/145)
- Not Updated: ~52% (75/145)

**Note**: High "Not Updated" rate suggests some parking spaces may not have active sensors or reporting infrastructure.

## Deployment

### Environment Variables Required
```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<secret-for-cron-authentication>
```

### Vercel Cron Configuration

**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/parking-space-occupancy",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Database Migrations

**Required Migrations** (in order):
1. `add_parking_spaces.sql` - Create tables, views, indexes
2. Run one-time import script to populate static data

**Migration Commands**:
```bash
# Run migration
psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/add_parking_spaces.sql

# Import static data
DOTENV_CONFIG_PATH=.env.local npx tsx scripts/import-parking-spaces.ts
```

## Monitoring & Maintenance

### Health Checks
- Monitor `parking_space_ingestion_metrics` view for data quality trends
- Check Vercel cron logs for ingestion failures
- Verify `latest_space_occupancy` has recent data

### Common Issues

**Issue**: High "Not Updated" rate
- **Cause**: Government API returns 'NU' for spaces without active sensors
- **Impact**: Reduced effective data points
- **Resolution**: Expected behavior, filter on `is_valid = true`

**Issue**: Date parsing errors
- **Cause**: Unexpected date format from government API
- **Resolution**: `parseDateFromCSV()` function handles DD/MM/YYYY HH:MM:SS format
- **Log**: Check Vercel logs for date parsing warnings

**Issue**: No recent data for specific spaces
- **Cause**: Government API may not report all spaces consistently
- **Resolution**: Use `is_stale` flag to identify outdated data

## Performance Considerations

### Database Indexes
```sql
-- Optimize location-based queries
CREATE INDEX idx_parking_space_location ON parking_space_info(latitude, longitude);

-- Optimize district filtering
CREATE INDEX idx_parking_space_district ON parking_space_info(district);

-- Optimize latest record queries
CREATE INDEX idx_space_occupancy_feature_ingested
  ON parking_space_occupancy_snapshots(feature_id, ingested_at DESC);

-- Optimize vacancy filtering
CREATE INDEX idx_space_occupancy_is_vacant
  ON parking_space_occupancy_snapshots(is_vacant)
  WHERE is_vacant = true;
```

### Batch Processing
- Ingestion uses 100-record batches to balance performance and reliability
- Total ingestion time: ~2-3 seconds for 145 records

### API Response Times
- `/api/parking-spaces?status=vacant`: ~900ms (typical)
- Uses database views for optimized queries
- Materialized views could be considered for future optimization

## Future Enhancements

### Potential Improvements
1. **UI Toggle**: Add layer toggle to show/hide parking spaces on map
2. **Filters**: District-based filtering in the UI
3. **InfoWindow**: Custom info window for parking space details
4. **Notifications**: Alert users when nearby spaces become vacant
5. **Historical Trends**: Track occupancy patterns over time
6. **Availability Prediction**: ML-based prediction of space availability

### Scalability Considerations
- Current system handles 145 spaces well
- If government expands to other regions, may need:
  - Pagination for API responses
  - Clustering for map markers
  - Regional data partitioning

## References

- **Government API**: https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus
- **Static GeoJSON**: `non-metered-parking-api/non-metered-parking.json`
- **Migration**: `supabase/migrations/add_parking_spaces.sql`
- **Import Script**: `scripts/import-parking-spaces.ts`
- **Cron Endpoint**: `app/api/cron/parking-space-occupancy/route.ts`
- **API Endpoint**: `app/api/parking-spaces/route.ts`
- **Map Component**: `components/simple-map.tsx`
- **TypeScript Types**: `types/parking-space.ts`

---

**Last Updated**: 2025-11-17
**Implementation Date**: 2025-11-17
**Status**: ✅ Production Ready
