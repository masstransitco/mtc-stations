# Trending Carparks Implementation

This document details the implementation of the Trending Carparks and Trending Metered Carparks features, including the data schema, materialized views, RPC functions, cron jobs, and UI components.

## Overview

The trending system identifies and displays the **top 10 most active carparks** based on vacancy changes over the past 6 hours. It supports two types of carparks:

1. **Indoor/Regular Carparks** - Multi-story parking structures with real-time vacancy data
2. **Metered Carparks** - On-street parking with per-space occupancy sensors

The system is designed to:
- Compute activity scores efficiently using materialized views
- Fetch live vacancy data at query time for real-time accuracy
- Track position changes between refresh cycles
- Keep trending data synchronized with live vacancy views

---

## Data Schema

### Core Snapshot Tables

#### `parking_vacancy_snapshots`
Stores vacancy snapshots for indoor carparks, ingested every 5 minutes from the HK Government API.

| Column | Type | Description |
|--------|------|-------------|
| `park_id` | VARCHAR(50) | Carpark identifier |
| `vehicle_type` | VARCHAR(20) | Vehicle type (privateCar, LGV, HGV, etc.) |
| `vacancy` | INTEGER | Number of vacant spaces |
| `vacancy_ev` | INTEGER | EV charging spaces available |
| `vacancy_dis` | INTEGER | Accessible parking spaces |
| `is_valid` | BOOLEAN | Whether data is valid (vacancy >= 0) |
| `ingested_at` | TIMESTAMPTZ | When the snapshot was recorded |
| `lastupdate` | TIMESTAMPTZ | Source data timestamp |

#### `metered_space_occupancy_snapshots`
Stores per-space occupancy snapshots for metered parking, ingested every 5 minutes.

| Column | Type | Description |
|--------|------|-------------|
| `parking_space_id` | VARCHAR(50) | Individual parking space ID |
| `occupancy_status` | CHAR(1) | 'V' = Vacant, 'O' = Occupied |
| `is_vacant` | BOOLEAN | Computed from occupancy_status |
| `is_valid` | BOOLEAN | Whether meter is operational |
| `occupancy_date_changed` | TIMESTAMPTZ | When occupancy last changed |
| `ingested_at` | TIMESTAMPTZ | When the snapshot was recorded |

### Position Tracking Tables

#### `trending_carparks_previous`
Stores the previous refresh cycle's rankings for position change tracking.

| Column | Type | Description |
|--------|------|-------------|
| `park_id` | VARCHAR(50) | Primary key |
| `rank` | INTEGER | Position in previous ranking |
| `activity_score` | NUMERIC(10,2) | Activity score at previous refresh |
| `cached_at` | TIMESTAMPTZ | When rankings were saved |

#### `trending_metered_carparks_previous`
Same structure for metered carparks, using `carpark_id` (TEXT) as primary key.

---

## Materialized Views

### `trending_carparks_cache`

Caches the top 10 trending indoor carparks based on activity score.

**Activity Score Formula:**
```
activity_score = (changes × 10) + (variance / 2) + (data_points × 0.5)
```

Where:
- `changes` = Number of times vacancy changed in 6 hours
- `variance` = Standard deviation of vacancy values
- `data_points` = Total number of snapshots

**Query Logic:**
```sql
WITH snapshots_with_prev AS (
  SELECT
    park_id,
    vacancy,
    LAG(vacancy) OVER (PARTITION BY park_id ORDER BY ingested_at) as prev_vacancy
  FROM parking_vacancy_snapshots
  WHERE vehicle_type = 'privateCar'
    AND is_valid = true
    AND ingested_at > NOW() - INTERVAL '6 hours'
),
activity_metrics AS (
  SELECT
    park_id,
    COUNT(*) FILTER (WHERE vacancy IS DISTINCT FROM prev_vacancy) as changes,
    COALESCE(STDDEV(vacancy), 0) as variance,
    COUNT(*) as data_points
  FROM snapshots_with_prev
  GROUP BY park_id
  HAVING COUNT(*) >= 2
)
SELECT
  park_id,
  ROUND((changes * 10 + variance / 2 + data_points * 0.5)::NUMERIC, 2) as activity_score,
  NOW() as cached_at
FROM activity_metrics
ORDER BY activity_score DESC
LIMIT 10;
```

### `trending_metered_carparks_cache`

Caches the top 10 trending metered carparks based on state changes.

**Activity Score:** Count of distinct (space_id, state_change_time) tuples, representing actual V↔O transitions.

**Query Logic:**
```sql
WITH state_changes AS (
  SELECT
    msi.carpark_id,
    COUNT(DISTINCT (msos.parking_space_id, msos.occupancy_date_changed)) as activity_score
  FROM metered_space_occupancy_snapshots msos
  JOIN metered_space_info msi ON msos.parking_space_id = msi.parking_space_id
  WHERE msos.ingested_at > NOW() - INTERVAL '6 hours'
    AND msos.is_valid = true
    AND msos.occupancy_date_changed > NOW() - INTERVAL '6 hours'
  GROUP BY msi.carpark_id
  HAVING COUNT(DISTINCT (...)) > 10
)
SELECT carpark_id, activity_score::NUMERIC, NOW() as cached_at
FROM state_changes
ORDER BY activity_score DESC
LIMIT 10;
```

### Live Vacancy Views

#### `latest_vacancy_with_location`
Provides current vacancy data for indoor carparks with location info.

#### `latest_metered_carpark_occupancy`
Aggregates per-space occupancy into carpark-level vacancy counts.

**Important:** These views are refreshed by their respective cron jobs and use a 1-hour time filter for performance:
```sql
WHERE ingested_at >= NOW() - INTERVAL '1 hour'
```

---

## RPC Functions

### Refresh Functions

#### `refresh_trending_carparks_with_tracking()`
Called by the `carpark-vacancy` cron job.

1. Saves current rankings to `trending_carparks_previous`
2. Refreshes `trending_carparks_cache` concurrently

```sql
CREATE OR REPLACE FUNCTION refresh_trending_carparks_with_tracking()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Save current rankings as previous
  DELETE FROM trending_carparks_previous;
  INSERT INTO trending_carparks_previous (park_id, rank, activity_score, cached_at)
  SELECT
    park_id,
    ROW_NUMBER() OVER (ORDER BY activity_score DESC)::INTEGER,
    activity_score,
    NOW()
  FROM trending_carparks_cache;

  -- Refresh the cache
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_carparks_cache;
END;
$$;
```

#### `refresh_trending_metered_carparks_with_tracking()`
Called by the `metered-carpark-occupancy` cron job. Same pattern for metered carparks.

### Query Functions

#### `get_trending_carparks_with_changes()`
Returns trending carparks with rank change indicators.

```sql
RETURNS TABLE (
  park_id VARCHAR(50),
  activity_score NUMERIC,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_change INTEGER  -- positive = moved up, negative = moved down
)
```

**Rank Change Calculation:**
```sql
rank_change = previous_rank - current_rank
```
- Positive value = moved up in rankings
- Negative value = moved down in rankings
- NULL = new entry (wasn't in previous rankings)

#### `get_trending_metered_carparks_with_changes()`
Same structure for metered carparks.

---

## Cron Jobs

### Schedule (vercel.json)

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/carpark-vacancy` | Every 5 min | Ingest indoor carpark data |
| `/api/cron/metered-carpark-occupancy` | Every 5 min | Ingest metered parking data |

### carpark-vacancy Cron Flow

```
1. Fetch vacancy data from HK Gov API
2. Insert into parking_vacancy_snapshots
3. Refresh latest_parking_vacancy views
4. Call refresh_trending_carparks_with_tracking()
   └─ Saves previous rankings
   └─ Refreshes trending_carparks_cache
```

### metered-carpark-occupancy Cron Flow

```
1. Fetch occupancy CSV from HK Gov API
2. Insert into metered_space_occupancy_snapshots
3. Refresh latest_metered_carpark_occupancy view
4. Call refresh_trending_metered_carparks_with_tracking()
   └─ Saves previous rankings
   └─ Refreshes trending_metered_carparks_cache
```

**Critical Design Decision:** Each cron only refreshes its own trending cache to maintain synchronization between trending rankings and live vacancy data.

---

## API Endpoints

### `/api/carparks/trending`
Returns trending indoor carparks with live vacancy data.

**Flow:**
1. Call `get_trending_carparks_with_changes()` RPC for rankings
2. Query `latest_vacancy_with_location` for live vacancy
3. Merge rankings with live data, preserving rank order
4. Return with `rank_change` field

**Response:**
```json
[
  {
    "park_id": "ABC123",
    "name": "Central Car Park",
    "vacancy": 45,
    "vacancy_ev": 3,
    "activity_score": 156.50,
    "rank_change": 2,  // moved up 2 positions
    ...
  }
]
```

### `/api/metered-carparks/trending`
Same pattern for metered carparks, querying:
- `get_trending_metered_carparks_with_changes()` for rankings
- `latest_metered_carpark_occupancy` for live vacancy

---

## UI Components

### `TrendingCarparks` (`components/trending-carparks.tsx`)

Displays the top 10 trending indoor carparks.

**Features:**
- Rank number with position indicator icons
- Carpark name and district
- Live vacancy count (color-coded)
- EV charging spaces (if available)
- Click to view details

**Position Indicators:**
```tsx
// Up arrow (green) - moved up in rankings
{rank_change > 0 && <RankUpIcon color="#22c55e" />}

// Down arrow (red) - moved down in rankings
{rank_change < 0 && <RankDownIcon color="#ef4444" />}
```

### `TrendingMeteredCarparks` (`components/trending-metered-carparks.tsx`)

Same structure for metered carparks, showing:
- Vacant spaces / Total tracked spaces
- No EV indicator (metered spaces don't track EV)

### Detail Components

#### `IndoorCarparkDetails` (`components/indoor-carpark-details.tsx`)

Shown when a trending carpark is clicked.

**Data Flow:**
1. Receives initial carpark data from trending list (may be slightly stale)
2. Immediately fetches fresh data from `/api/carparks?park_id=X`
3. Renders `VacancyTrendChart` with 6-hour history

#### `MeteredCarparkDetails` (`components/metered-carpark-details.tsx`)

Same pattern:
1. Receives initial data from trending list
2. Fetches fresh data from `/api/metered-carparks?carpark_id=X`
3. Renders `MeteredVacancyTrendChart` with 6-hour history

### Trendline Charts

#### `VacancyTrendChart` (`components/vacancy-trend-chart.tsx`)

Fetches and displays vacancy history for indoor carparks.

**API:** `/api/carparks/[park_id]/history?vehicle_type=X&hours=6`

**Features:**
- Area chart with gradient fill
- Hong Kong timezone display
- Min/Avg/Max statistics

#### `MeteredVacancyTrendChart` (`components/metered-vacancy-trend-chart.tsx`)

Same for metered carparks.

**API:** `/api/metered-carparks/[carpark_id]/history?hours=6`

Uses RPC function `get_metered_carpark_history()` for efficient aggregation.

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │           HK Government APIs                │
                    └──────────────┬──────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         │
┌─────────────────┐    ┌─────────────────────┐              │
│ carpark-vacancy │    │ metered-carpark-    │              │
│ cron (5 min)    │    │ occupancy cron      │              │
└────────┬────────┘    └──────────┬──────────┘              │
         │                        │                          │
         ▼                        ▼                          │
┌─────────────────┐    ┌─────────────────────┐              │
│ parking_vacancy │    │ metered_space_      │              │
│ _snapshots      │    │ occupancy_snapshots │              │
└────────┬────────┘    └──────────┬──────────┘              │
         │                        │                          │
         ▼                        ▼                          │
┌─────────────────┐    ┌─────────────────────┐              │
│ latest_vacancy_ │    │ latest_metered_     │              │
│ with_location   │    │ carpark_occupancy   │              │
└────────┬────────┘    └──────────┬──────────┘              │
         │                        │                          │
         │  refresh_trending_     │  refresh_trending_       │
         │  carparks_with_        │  metered_carparks_       │
         │  tracking()            │  with_tracking()         │
         │                        │                          │
         ▼                        ▼                          │
┌─────────────────┐    ┌─────────────────────┐              │
│ trending_       │    │ trending_metered_   │              │
│ carparks_cache  │    │ carparks_cache      │              │
└────────┬────────┘    └──────────┬──────────┘              │
         │                        │                          │
         └──────────┬─────────────┘                          │
                    │                                        │
                    ▼                                        │
         ┌─────────────────────┐                            │
         │ API Endpoints       │                            │
         │ - /api/carparks/    │                            │
         │   trending          │                            │
         │ - /api/metered-     │                            │
         │   carparks/trending │                            │
         └──────────┬──────────┘                            │
                    │                                        │
                    ▼                                        │
         ┌─────────────────────┐                            │
         │ UI Components       │                            │
         │ - TrendingCarparks  │                            │
         │ - TrendingMetered   │                            │
         │   Carparks          │                            │
         └──────────┬──────────┘                            │
                    │                                        │
                    │ onClick                                │
                    ▼                                        │
         ┌─────────────────────┐                            │
         │ Detail Components   │◄───────────────────────────┘
         │ - IndoorCarpark     │   Fresh data fetch
         │   Details           │   on mount
         │ - MeteredCarpark    │
         │   Details           │
         └─────────────────────┘
```

---

## Key Design Decisions

### 1. Rankings-Only Caching

The trending caches only store `carpark_id` and `activity_score`, not vacancy data. Live vacancy is fetched at query time by joining with the live views. This ensures:
- Real-time vacancy accuracy
- Smaller cache size
- No stale vacancy display

### 2. Separated Refresh Functions

Each cron job refreshes only its own trending cache. This prevents synchronization issues where:
- Trending cache is refreshed with newer `NOW()` timestamp
- But live vacancy view still has older data

### 3. Position Tracking

Previous rankings are saved before each refresh, enabling:
- Up/down indicator icons in UI
- Trend visibility across refresh cycles

### 4. Concurrent Refresh

Using `REFRESH MATERIALIZED VIEW CONCURRENTLY` allows:
- No read blocking during refresh
- Requires unique index on the view

---

## Troubleshooting

### Vacancy Mismatch Between Components

**Symptom:** Trending list shows different vacancy than detail component.

**Cause:** The live vacancy view wasn't refreshed after new data was inserted.

**Solution:** Ensure each cron refreshes both:
1. Its own live vacancy view
2. Its own trending cache (not the other type's cache)

### Position Indicators Always Show 0

**Symptom:** All `rank_change` values are 0 or NULL.

**Cause:**
- NULL = New entries (not in previous rankings)
- 0 = Rankings haven't changed between refresh cycles

**Note:** This is expected behavior when:
- System was just deployed (no previous rankings yet)
- Activity is stable across refresh cycles

### Trendline Chart Not Showing Latest Data

**Symptom:** Chart ends several hours before current time.

**Cause:** History API time bucket calculation or timezone handling issue.

**Solution:** Ensure timestamps include timezone indicator ('Z' for UTC) in API response.

---

## File References

| File | Purpose |
|------|---------|
| `supabase/migrations/20251126_trending_carparks_rankings_only.sql` | Trending carparks materialized view |
| `supabase/migrations/20251126_trending_metered_carparks_rankings_only.sql` | Trending metered carparks materialized view |
| `supabase/migrations/20251126_trending_position_tracking.sql` | Position tracking tables and functions |
| `supabase/migrations/20251126_split_trending_refresh_functions.sql` | Separated refresh functions |
| `app/api/cron/carpark-vacancy/route.ts` | Indoor carpark ingestion cron |
| `app/api/cron/metered-carpark-occupancy/route.ts` | Metered carpark ingestion cron |
| `app/api/carparks/trending/route.ts` | Trending indoor carparks API |
| `app/api/metered-carparks/trending/route.ts` | Trending metered carparks API |
| `components/trending-carparks.tsx` | Trending indoor carparks UI |
| `components/trending-metered-carparks.tsx` | Trending metered carparks UI |
| `components/indoor-carpark-details.tsx` | Indoor carpark detail panel |
| `components/metered-carpark-details.tsx` | Metered carpark detail panel |
| `components/vacancy-trend-chart.tsx` | Indoor carpark trendline chart |
| `components/metered-vacancy-trend-chart.tsx` | Metered carpark trendline chart |
