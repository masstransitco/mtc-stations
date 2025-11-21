# Carpark Database Schema & Analysis Script

This document summarizes the Supabase schema that backs the carpark + metered parking features and explains how to run the parking data analysis script added to this repo.

## Environment Variables

All database access relies on the Supabase connection variables already used throughout the project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

They should be defined in `.env.local` (for local work) or set in the shell before running the analysis script (see below). The script uses the service-role key because it needs access to private tables, views, and RPC functions.

## Core Tables

### `carpark_info`

Stores static metadata about each HK Gov carpark.

| Column          | Type               | Notes                                           |
|-----------------|--------------------|-------------------------------------------------|
| `park_id`       | `varchar(50)`      | Primary key from HK Gov API                     |
| `name`          | `text`             | English name                                    |
| `display_address` | `text`          | Street address                                  |
| `latitude`/`longitude` | `numeric(10,7)` | Used for viewport/filtering                 |
| `district`      | `text`             | District name                                   |
| `nature`        | `varchar(20)`      | `government` or `commercial`                    |
| `carpark_type`  | `varchar(50)`      | `multi-storey`, `off-street`, `metered`, etc.   |
| `opening_status`| `varchar(20)`      | `OPEN` / `CLOSED`                               |
| `contact_no`, `website` | `text`    | Optional contact data                           |
| `created_at`/`updated_at` | `timestamptz` | Maintained via `update_updated_at_column()` trigger |

Indexes: `idx_carpark_info_location` (lat/long) and `idx_carpark_info_district`.

### `parking_vacancy_snapshots`

Time-series feed from the HK Gov vacancy API (non-metered carparks).

| Column         | Type           | Notes                                                                 |
|----------------|----------------|-----------------------------------------------------------------------|
| `id`           | `bigserial`    | Primary key                                                           |
| `park_id`      | `varchar(50)`  | FK to `carpark_info`                                                  |
| `vehicle_type` | `varchar(20)`  | e.g. `privateCar`, `LGV`, `CV`, etc.                                  |
| `vacancy_type` | `char(1)`      | `A` actual, `B` flag, `C` closed                                      |
| `vacancy`      | `integer`      | Count or flag (`-1` = offline)                                        |
| `vacancy_dis`/`vacancy_ev`/`vacancy_unl` | `integer` | Optional counts for disabled / EV / unloading |
| `category`     | `varchar(20)`  | Usually `HOURLY`                                                      |
| `lastupdate`   | `timestamp`    | Operator timestamp                                                    |
| `ingested_at`  | `timestamptz`  | When we ingested it                                                   |
| `is_valid`     | `boolean` (generated) | `vacancy >= 0`                                                     |
| `created_at`   | `timestamptz`  | Insert timestamp                                                      |

Important indexes (`parking_vacancy.sql`, `add_data_quality_improvements.sql`):

- `idx_parking_vacancy_park_id`, `idx_parking_vacancy_vehicle_type`
- `idx_parking_vacancy_ingested_at`, `idx_parking_vacancy_lastupdate`
- `idx_parking_vacancy_park_vehicle`
- `idx_parking_vacancy_is_valid`
- Partial `idx_parking_vacancy_valid_latest` for fast “latest valid” lookups

### Metered Parking Tables

#### `metered_space_info`

Metadata for each metered pole/space.

| Column                | Type          | Notes                                           |
|-----------------------|---------------|-------------------------------------------------|
| `parking_space_id`    | `varchar(50)` | Primary key (from Gov API)                      |
| `carpark_id`          | `varchar(50)` | Links to `metered_carpark_info`                 |
| `pole_id`             | `integer`     | Physical pole                                   |
| `latitude`/`longitude`| `numeric`     | Location                                        |
| `vehicle_type`        | `char(1)`     | `A`, `C`, `G`, etc.                             |
| `longest_parking_period`, `operating_period`, `time_unit`, `payment_unit` | Billing info |
| `has_real_time_tracking` | `boolean`  | Indicates if space emits live telemetry        |

Indexes: `idx_metered_space_carpark`, `idx_metered_space_tracking`.

#### `metered_space_occupancy_snapshots`

Raw time-series telemetry per metered space.

| Column                 | Type       | Notes                                                             |
|------------------------|------------|-------------------------------------------------------------------|
| `id`                   | `bigserial`| Primary key                                                       |
| `parking_space_id`     | `varchar`  | FK to `metered_space_info`                                        |
| `meter_status`         | `varchar`  | `N` (normal) / `NU` (not usable)                                  |
| `occupancy_status`     | `varchar`  | `O` (occupied) / `V` (vacant)                                     |
| `occupancy_date_changed` | `timestamp` | Last change timestamp                                         |
| `ingested_at`          | `timestamp`| When the snapshot was stored                                      |
| `is_valid`             | `boolean` (generated) | `meter_status = 'N'`                                     |
| `is_vacant`            | `boolean` (generated) | `occupancy_status = 'V'`                                 |

Indexes: `(parking_space_id, ingested_at DESC)`, `ingested_at DESC`, partial `idx_metered_occupancy_is_vacant`.

Old data is periodically deleted (see `optimize_metered_view_performance.sql`) to keep refresh jobs fast.

## Views & Functions

### HK Gov Views

- `latest_parking_vacancy`: most recent snapshot per `park_id` + `vehicle_type` (includes invalid/offline data). Adds `is_stale` flag when `lastupdate` > 2 hours old.
- `latest_valid_parking_vacancy`: same but restricted to `is_valid = true`. Primary source for the app, analytics, and API endpoints.
- `ingestion_quality_metrics`: groups snapshot quality by ingestion minute—used by `/api/admin/metrics` and the analysis script.
- `current_availability_by_vehicle_type`: aggregated availability summary.

### Metered Views

Initially implemented as SQL views, now materialized for performance:

- `latest_metered_space_occupancy`: latest valid reading per space.
- `latest_metered_carpark_occupancy` (materialized view): aggregates space-level data to carpark-level metrics (tracked spaces, vacant/occupied counts, vacancy rate, etc.). Maintained by the `refresh_latest_metered_carpark_occupancy()` function (30 s statement timeout) and refresh cron.

### Stored Procedures / RPC

- `refresh_latest_parking_vacancy` / `refresh_latest_metered_carpark_occupancy`: used after cron ingestions.
- `check_metered_snapshots`: referenced in `scripts/check-metered-ingestion.ts` for data quality checks.

## Analysis Script (`npm run analyze:parking`)

`scripts/analyze-parking-data.ts` queries both data sets and prints summary tables to stdout.

### Prerequisites

1. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local` (the script loads both `.env.local` and `.env` via `dotenv`).
2. Install dependencies (if not already): `npm install`.

### Running

```bash
npm run analyze:parking
```

The script will:

1. Load env vars with `dotenv`.
2. Instantiate a Supabase client using the service role (session persistence disabled).
3. Pull four sets of metrics:
   - **Metered carparks (materialized view)** – counts, district ranking, most empty / most full.
   - **Metered snapshot ingestion** – last hour/day snapshot counts (using `countMethod: 'planned'` to avoid full scans), vacant vs occupied vs invalid tallies, and number of tracking-enabled spaces.
   - **HK Gov carparks** (`latest_valid_parking_vacancy` + `carpark_info`) – per-district availability, most available and most constrained sites.
   - **Ingestion quality** (`ingestion_quality_metrics`) – offline percentage trends and recent cron runs.
4. Render sections using `console.table` for quick scanning.

Sample output highlights:

```
Metered Carparks (Latest View)
------------------------------
Carparks: 648 | Total spaces: 17,219
Tracked spaces: 17,218 | Spaces with live data: 17,023
Vacant now: 5,264 | Occupied: 11,759
Avg vacancy rate: 25.7%

Metered Snapshot Ingestion
--------------------------
Snapshots last hour: 62,384 | Last 24h: 5,608,220
Vacant flags last 24h: 1,296,247 vs occupied: 4,311,974
Invalid records last 24h: 74,215
```

Use this script whenever you need a snapshot of data health, identify top/bottom carparks, or verify ingestion throughput without opening Supabase dashboards.
