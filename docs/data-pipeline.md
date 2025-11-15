# Data Pipeline Documentation

## Overview

This document describes the complete data pipeline for Hong Kong parking vacancy data, from the government's public API through to our database schema and APIs.

---

## Table of Contents

1. [Data Source](#data-source)
2. [Architecture Overview](#architecture-overview)
3. [Ingestion System](#ingestion-system)
4. [Database Schema](#database-schema)
5. [Cron Jobs](#cron-jobs)
6. [API Endpoints](#api-endpoints)
7. [Data Quality](#data-quality)
8. [Query Examples](#query-examples)

---

## Data Source

### Hong Kong Government API

**Base URL:** `https://api.data.gov.hk/v1/carpark-info-vacancy`

**Documentation:** [Parking Vacancy Data Specification v1.2](../parking-vacancy-api/parking-vacancy-api-specs.md)

**API Types:**

1. **Vacancy Data** (`data=vacancy`)
   - Real-time parking availability
   - Updated by car park operators
   - Includes 6 vehicle types
   - ~509 car parks

2. **Carpark Info** (`data=info`)
   - Static metadata (names, addresses, coordinates)
   - Opening hours, fees, facilities
   - 509 car parks across Hong Kong

**Authentication:** None required (public API)

**Response Format:** JSON (UTF-8)

**Rate Limits:** None specified

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hong Kong Government API                      │
│                                                                  │
│  https://api.data.gov.hk/v1/carpark-info-vacancy               │
│                                                                  │
│  • data=vacancy  → Real-time vacancy data                      │
│  • data=info     → Carpark metadata + coordinates              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS GET
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Vercel Cron Jobs                           │
│                   (stations.air.zone)                            │
│                                                                  │
│  Every 5 minutes:                                               │
│  • /api/cron/carpark-vacancy  → Fetch vacancy data             │
│  • /api/cron/carpark-info     → Fetch carpark info (on-demand) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Transform & Process
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase PostgreSQL                         │
│                                                                  │
│  Tables:                                                         │
│  • parking_vacancy_snapshots  → Time-series vacancy data       │
│  • carpark_info               → Carpark metadata + coordinates  │
│                                                                  │
│  Views:                                                          │
│  • latest_valid_parking_vacancy    → Latest valid data only    │
│  • latest_vacancy_with_location    → Joined with coordinates   │
│  • ingestion_quality_metrics       → Data quality tracking     │
│  • current_availability_by_vehicle → Summary statistics        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Query
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Consumer Applications                        │
│                                                                  │
│  • Map visualizations                                           │
│  • Parking availability apps                                    │
│  • Analytics dashboards                                         │
│  • Historical trend analysis                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ingestion System

### 1. Vacancy Data Ingestion

**Endpoint:** `GET /api/cron/carpark-vacancy`

**Schedule:** Every 5 minutes (Vercel cron)

**Process Flow:**

```typescript
1. Verify cron secret (x-cron-secret header)
2. Fetch vacancy data from HK Gov API
   GET https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&lang=en_US
3. Transform API response:
   - Extract each vehicle type (privateCar, LGV, HGV, CV, coach, motorCycle)
   - Calculate data quality metrics
   - Add ingestion timestamp
4. Insert into parking_vacancy_snapshots table (batch processing)
5. Return quality metrics
```

**Data Transformation:**

```typescript
API Response → Database Record
{
  "park_Id": "100",
  "privateCar": [{
    "vacancy_type": "A",
    "vacancy": 146,
    "vacancyDIS": 2,
    "vacancyEV": 5,
    "lastupdate": "2025-11-15 13:00:00"
  }]
}
→
{
  park_id: "100",
  vehicle_type: "privateCar",
  vacancy_type: "A",
  vacancy: 146,
  vacancy_dis: 2,
  vacancy_ev: 5,
  vacancy_unl: null,
  category: null,
  lastupdate: "2025-11-15 13:00:00",
  ingested_at: "2025-11-15T06:00:00.000Z",
  is_valid: true  // computed: vacancy >= 0
}
```

**Performance:**
- Processes ~636 records in ~1.6-5 seconds
- Batch size: 500 records per insert
- Zero failures in production

### 2. Carpark Info Ingestion

**Endpoint:** `GET /api/cron/carpark-info`

**Schedule:** On-demand (or daily via cron if configured)

**Process Flow:**

```typescript
1. Verify cron secret
2. Fetch carpark info from HK Gov API
   GET https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&lang=en_US
3. Transform to database schema
4. Upsert into carpark_info table (updates existing records)
5. Return statistics
```

**Data Transformation:**

```typescript
API Response → Database Record
{
  "park_Id": "100",
  "name": "Prosperity Place Car Park",
  "displayAddress": "123 Main Street, Kowloon",
  "latitude": 22.3106079,
  "longitude": 114.2257385,
  "district": "Kwun Tong District",
  "opening_status": "OPEN"
}
→
{
  park_id: "100",
  name: "Prosperity Place Car Park",
  display_address: "123 Main Street, Kowloon",
  latitude: 22.3106079,
  longitude: 114.2257385,
  district: "Kwun Tong District",
  nature: null,
  carpark_type: null,
  opening_status: "OPEN",
  contact_no: null,
  website: null
}
```

**Coverage:**
- 509 car parks
- 100% with coordinates
- 21 unique districts

---

## Database Schema

### Tables

#### 1. `parking_vacancy_snapshots`

Time-series table storing all vacancy snapshots.

```sql
CREATE TABLE parking_vacancy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  park_id VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL,
  vacancy_type CHAR(1) NOT NULL,
  vacancy INTEGER NOT NULL,
  vacancy_dis INTEGER,
  vacancy_ev INTEGER,
  vacancy_unl INTEGER,
  category VARCHAR(20),
  lastupdate TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_valid BOOLEAN GENERATED ALWAYS AS (vacancy >= 0) STORED
);
```

**Key Columns:**
- `park_id` - Car park identifier (from API)
- `vehicle_type` - privateCar, LGV, HGV, CV, coach, motorCycle
- `vacancy_type` - A (actual count), B (flag), C (closed)
- `vacancy` - Available spaces (-1 = offline/unknown, ≥0 = valid)
- `is_valid` - Computed: true when vacancy ≥ 0
- `lastupdate` - Timestamp from car park operator
- `ingested_at` - When we ingested this record

**Indexes:**
```sql
idx_parking_vacancy_park_id
idx_parking_vacancy_vehicle_type
idx_parking_vacancy_ingested_at
idx_parking_vacancy_park_vehicle
idx_parking_vacancy_is_valid
idx_parking_vacancy_valid_latest
```

#### 2. `carpark_info`

Reference table with carpark metadata and coordinates.

```sql
CREATE TABLE carpark_info (
  park_id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  display_address TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  district TEXT,
  nature VARCHAR(20),
  carpark_type VARCHAR(50),
  opening_status VARCHAR(20),
  contact_no TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
```sql
idx_carpark_info_location (latitude, longitude)
idx_carpark_info_district
```

### Views

#### 1. `latest_valid_parking_vacancy`

Latest vacancy snapshot with only valid data (filters out vacancy = -1).

```sql
CREATE VIEW latest_valid_parking_vacancy AS
SELECT DISTINCT ON (park_id, vehicle_type)
  id, park_id, vehicle_type, vacancy_type,
  vacancy, vacancy_dis, vacancy_ev, vacancy_unl,
  category, lastupdate, ingested_at,
  (lastupdate < NOW() - INTERVAL '2 hours') as is_stale,
  created_at
FROM parking_vacancy_snapshots
WHERE is_valid = true
ORDER BY park_id, vehicle_type, ingested_at DESC;
```

**Use Case:** Get current availability without offline data

#### 2. `latest_vacancy_with_location`

Joins latest valid vacancy with carpark coordinates and metadata for map display.

**Updated:** 2025-11-15 - Added `display_address` field for InfoWindow display

```sql
CREATE VIEW latest_vacancy_with_location AS
SELECT
  v.park_id, c.name, c.display_address, c.latitude, c.longitude,
  c.district, c.opening_status, c.contact_no,
  v.vehicle_type, v.vacancy_type, v.vacancy,
  v.vacancy_dis, v.vacancy_ev, v.vacancy_unl,
  v.category, v.lastupdate, v.ingested_at,
  (v.lastupdate < NOW() - INTERVAL '2 hours') as is_stale
FROM latest_valid_parking_vacancy v
JOIN carpark_info c ON v.park_id = c.park_id;
```

**Use Case:** Map visualization, proximity search

#### 3. `ingestion_quality_metrics`

Data quality tracking by ingestion batch.

```sql
CREATE VIEW ingestion_quality_metrics AS
SELECT
  DATE_TRUNC('minute', ingested_at) as ingestion_time,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_valid = true) as valid_records,
  COUNT(*) FILTER (WHERE is_valid = false) as offline_records,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_valid = false) / COUNT(*), 2) as offline_percent,
  COUNT(*) FILTER (WHERE lastupdate < NOW() - INTERVAL '2 hours') as stale_records,
  COUNT(DISTINCT park_id) as unique_carparks,
  COUNT(DISTINCT park_id) FILTER (WHERE is_valid = true) as carparks_with_valid_data
FROM parking_vacancy_snapshots
GROUP BY DATE_TRUNC('minute', ingested_at)
ORDER BY ingestion_time DESC;
```

**Use Case:** Monitoring, data quality analysis

#### 4. `current_availability_by_vehicle_type`

Summary statistics by vehicle type.

```sql
CREATE VIEW current_availability_by_vehicle_type AS
SELECT
  vehicle_type,
  COUNT(*) as total_carparks,
  COUNT(*) FILTER (WHERE vacancy_type = 'A' AND vacancy > 0) as available_type_a,
  COUNT(*) FILTER (WHERE vacancy_type = 'B' AND vacancy = 1) as available_type_b,
  COUNT(*) FILTER (WHERE vacancy_type = 'C') as closed_type_c,
  COUNT(*) FILTER (WHERE vacancy = -1) as offline,
  SUM(CASE WHEN vacancy_type = 'A' AND vacancy > 0 THEN vacancy ELSE 0 END) as total_available_spaces
FROM latest_parking_vacancy
GROUP BY vehicle_type;
```

**Use Case:** Dashboard statistics

---

## Cron Jobs

### Configuration

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/carpark-vacancy",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule:** Every 5 minutes

**Cron Expression:** `*/5 * * * *`
- Runs at: :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55

### Authentication

Vercel automatically includes the `x-cron-secret` header when calling cron endpoints.

**Environment Variable:** `CRON_SECRET`

**Verification in API:**
```typescript
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  return cronSecret === expectedSecret;
}
```

### Manual Triggering

For testing or on-demand ingestion:

```bash
# Vacancy ingestion
curl -H "x-cron-secret: YOUR_SECRET" \
  https://stations.air.zone/api/cron/carpark-vacancy

# Carpark info ingestion
curl -H "x-cron-secret: YOUR_SECRET" \
  https://stations.air.zone/api/cron/carpark-info
```

---

## API Endpoints

### 1. Vacancy Ingestion

**Endpoint:** `GET /api/cron/carpark-vacancy`

**Authentication:** `x-cron-secret` header required

**Response:**
```json
{
  "success": true,
  "carparks": 509,
  "records": 636,
  "inserted": 636,
  "failed": 0,
  "data_quality": {
    "valid_records": 400,
    "offline_records": 236,
    "offline_percent": 37.11,
    "unique_carparks": 506,
    "carparks_with_valid_data": 332,
    "by_vacancy_type": {
      "A": { "total": 476, "offline": 225, "valid": 251 },
      "B": { "total": 157, "offline": 11, "valid": 146 },
      "C": { "total": 3, "offline": 0, "valid": 3 }
    }
  },
  "duration_ms": 1659,
  "timestamp": "2025-11-15T06:00:18.644Z"
}
```

**File:** `app/api/cron/carpark-vacancy/route.ts`

### 2. Carpark Info Ingestion

**Endpoint:** `GET /api/cron/carpark-info`

**Authentication:** `x-cron-secret` header required

**Response:**
```json
{
  "success": true,
  "carparks": 509,
  "records": 509,
  "upserted": 509,
  "failed": 0,
  "duration_ms": 2215,
  "timestamp": "2025-11-15T06:11:19.855Z"
}
```

**File:** `app/api/cron/carpark-info/route.ts`

---

## Data Quality

### Overview

Based on API Review findings and production monitoring:

**Key Metrics:**
- **37.11%** of records have `vacancy = -1` (offline/unknown)
- **62.89%** of records contain valid data
- **506/509** unique car parks report data
- **332/506** car parks have at least some valid data

### Vacancy Type Distribution

| Type | Total | Offline (-1) | Valid | Offline % |
|------|-------|--------------|-------|-----------|
| **A** | 476 | 225 | 251 | 47.3% |
| **B** | 157 | 11 | 146 | 7.0% |
| **C** | 3 | 0 | 3 | 0% |

**Findings:**
- Type A (actual count) has highest offline rate
- Type B (availability flag) is most reliable
- Type C (closed) always reports 0

### Staleness Detection

Records are considered stale when `lastupdate > 2 hours old`.

**Current Status:**
- ~6 stale records per ingestion batch
- ~394/400 valid records are fresh

### Data Quality Views

Use `ingestion_quality_metrics` to monitor:
```sql
SELECT * FROM ingestion_quality_metrics
ORDER BY ingestion_time DESC
LIMIT 10;
```

---

## Query Examples

### 1. Find Available Parking Near Location

```sql
SELECT
  name,
  latitude,
  longitude,
  district,
  vacancy,
  vehicle_type
FROM latest_vacancy_with_location
WHERE vehicle_type = 'privateCar'
  AND vacancy > 10
  AND is_stale = false
ORDER BY (latitude - 22.3312)^2 + (longitude - 114.1982)^2
LIMIT 10;
```

### 2. Availability by District

```sql
SELECT
  district,
  COUNT(*) as total_carparks,
  SUM(vacancy) as total_available_spaces,
  AVG(vacancy) as avg_vacancy
FROM latest_vacancy_with_location
WHERE vehicle_type = 'privateCar'
  AND is_stale = false
GROUP BY district
ORDER BY total_available_spaces DESC;
```

### 3. High Capacity Car Parks

```sql
SELECT
  name,
  latitude,
  longitude,
  vacancy,
  vacancy_ev,
  vacancy_dis
FROM latest_vacancy_with_location
WHERE vehicle_type = 'privateCar'
  AND vacancy > 100
ORDER BY vacancy DESC;
```

### 4. Historical Trends (Last 24 Hours)

```sql
SELECT
  DATE_TRUNC('hour', ingested_at) as hour,
  park_id,
  AVG(vacancy) as avg_vacancy,
  MIN(vacancy) as min_vacancy,
  MAX(vacancy) as max_vacancy
FROM parking_vacancy_snapshots
WHERE park_id = '100'
  AND vehicle_type = 'privateCar'
  AND ingested_at > NOW() - INTERVAL '24 hours'
  AND is_valid = true
GROUP BY DATE_TRUNC('hour', ingested_at), park_id
ORDER BY hour DESC;
```

### 5. Data Quality Report

```sql
SELECT
  ingestion_time,
  total_records,
  valid_records,
  offline_records,
  offline_percent,
  stale_records
FROM ingestion_quality_metrics
WHERE ingestion_time > NOW() - INTERVAL '1 day'
ORDER BY ingestion_time DESC;
```

### 6. Car Parks with EV Charging

```sql
SELECT
  name,
  latitude,
  longitude,
  vacancy_ev,
  vacancy
FROM latest_vacancy_with_location
WHERE vehicle_type = 'privateCar'
  AND vacancy_ev > 0
ORDER BY vacancy_ev DESC;
```

---

## Performance Metrics

### Ingestion Performance

**Vacancy Data:**
- Frequency: Every 5 minutes
- API Response Time: ~1-2 seconds
- Processing Time: ~1.6-5 seconds total
- Records per batch: ~636
- Success Rate: 100%

**Carpark Info:**
- On-demand execution
- Processing Time: ~2-8 seconds
- Records processed: 509
- Success Rate: 100%

### Database Performance

**Indexes ensure fast queries:**
- Latest vacancy lookup: < 50ms
- Geospatial queries: < 100ms
- Historical trends: < 200ms

**Storage:**
- ~636 records per 5-minute ingestion
- ~183,000 records per day
- ~5.5M records per month

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Ingestion Success Rate**
   ```sql
   SELECT
     DATE(ingestion_time) as date,
     COUNT(*) as total_ingestions,
     AVG(offline_percent) as avg_offline_percent
   FROM ingestion_quality_metrics
   GROUP BY DATE(ingestion_time);
   ```

2. **Data Freshness**
   ```sql
   SELECT COUNT(*) FILTER (WHERE is_stale = true) as stale_count
   FROM latest_valid_parking_vacancy;
   ```

3. **Coverage**
   ```sql
   SELECT
     COUNT(DISTINCT park_id) as total_carparks,
     COUNT(DISTINCT park_id) FILTER (WHERE is_valid = true) as active_carparks
   FROM latest_parking_vacancy;
   ```

### Recommended Maintenance

1. **Daily:** Check ingestion quality metrics
2. **Weekly:** Review data freshness and coverage
3. **Monthly:** Archive old data (optional)
4. **Quarterly:** Re-ingest carpark info for metadata updates

---

## Troubleshooting

### Issue: High Offline Percentage

**Cause:** Car park operators not reporting data
**Expected:** ~37% offline is normal
**Action:** Use `is_valid` filter in queries

### Issue: Stale Data

**Cause:** Car park operator hasn't updated `lastupdate`
**Detection:** `is_stale = true` in views
**Action:** Filter by `is_stale = false` for fresh data only

### Issue: Missing Coordinates

**Cause:** Carpark info not ingested
**Action:** Run `/api/cron/carpark-info` endpoint

### Issue: Cron Job Not Running

**Check:**
1. Vercel deployment logs
2. `CRON_SECRET` environment variable
3. `vercel.json` configuration

---

## References

- [API Specification](../parking-vacancy-api/parking-vacancy-api-specs.md)
- [HK Government API](https://api.data.gov.hk/v1/carpark-info-vacancy)
- [Database Migrations](../supabase/migrations/)
- [TypeScript Types](../types/parking-vacancy.ts)
