# MTC Parking Vacancy API

A Next.js service that ingests Hong Kong Government car park vacancy data and stores it in Supabase for time-series analysis.

## Features

- Automated parking vacancy data ingestion from HK Gov API
- Time-series storage in Supabase PostgreSQL
- Vercel cron job for scheduled updates (every 5 minutes)
- TypeScript types based on official API specification v1.2
- Support for all vehicle types: Private Car, LGV, HGV, CV, Coach, Motorcycle

## Prerequisites

- Node.js 18+ or pnpm
- Supabase account and project
- Vercel account (for deployment and cron jobs)

## Setup Instructions

### 1. Environment Variables

Create `.env.local` (already exists) with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_secret_string
```

For Vercel deployment, add these same variables in:
**Vercel Project Settings → Environment Variables**

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Apply SQL Migration

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/parking_vacancy.sql`
4. Paste and click **Run**

This creates:
- `carpark_info` table (for basic car park information)
- `parking_vacancy_snapshots` table (for time-series vacancy data)
- Indexes for efficient querying

### 4. Local Testing

Start the development server:

```bash
npm run dev
```

Trigger a manual ingestion:

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/carpark-vacancy
```

Replace `YOUR_CRON_SECRET` with the value from your `.env.local` file.

### 5. Verify Data

Check your Supabase dashboard:
1. Go to **Table Editor**
2. Open `parking_vacancy_snapshots` table
3. Verify records were inserted

You should see vacancy records for multiple car parks and vehicle types.

## API Endpoints

### `GET /api/cron/carpark-vacancy`

Fetches parking vacancy data from HK Government API and stores in Supabase.

**Headers:**
- `x-cron-secret`: Required. Must match `CRON_SECRET` env var.

**Response:**
```json
{
  "success": true,
  "carparks": 150,
  "records": 450,
  "inserted": 450,
  "failed": 0,
  "duration_ms": 2341,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Database Schema

### `parking_vacancy_snapshots`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `park_id` | VARCHAR(50) | Car park ID from API |
| `vehicle_type` | VARCHAR(20) | privateCar, LGV, HGV, CV, coach, motorCycle |
| `vacancy_type` | CHAR(1) | A=Actual, B=Flag, C=Closed |
| `vacancy` | INTEGER | Available spaces |
| `vacancy_dis` | INTEGER | Disabled spaces available |
| `vacancy_ev` | INTEGER | EV spaces available |
| `vacancy_unl` | INTEGER | Unloading spaces available |
| `category` | VARCHAR(20) | HOURLY, DAILY, MONTHLY |
| `lastupdate` | TIMESTAMP | From API (owner's timestamp) |
| `ingested_at` | TIMESTAMPTZ | When we ingested it |
| `created_at` | TIMESTAMPTZ | Database insert time |

## Vercel Deployment

### Deploy to Vercel

```bash
vercel
```

### Configure Cron Job

The `vercel.json` file configures a cron job to run every 5 minutes:

```json
{
  "crons": [{
    "path": "/api/cron/carpark-vacancy",
    "schedule": "*/5 * * * *"
  }]
}
```

**Important:** Vercel automatically includes the `x-cron-secret` header when calling cron endpoints from scheduled jobs.

### Environment Variables on Vercel

Add these in Vercel Project Settings:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `CRON_SECRET`

## Querying the Data

Example queries:

### Latest vacancy for all car parks
```sql
SELECT DISTINCT ON (park_id, vehicle_type)
  park_id,
  vehicle_type,
  vacancy,
  vacancy_type,
  lastupdate
FROM parking_vacancy_snapshots
ORDER BY park_id, vehicle_type, ingested_at DESC;
```

### Vacancy trends for a specific car park
```sql
SELECT
  vehicle_type,
  vacancy,
  lastupdate,
  ingested_at
FROM parking_vacancy_snapshots
WHERE park_id = '10'
  AND vehicle_type = 'privateCar'
ORDER BY ingested_at DESC
LIMIT 100;
```

### Car parks with high availability
```sql
SELECT DISTINCT ON (park_id)
  park_id,
  vacancy,
  lastupdate
FROM parking_vacancy_snapshots
WHERE vehicle_type = 'privateCar'
  AND vacancy_type = 'A'
  AND vacancy > 50
ORDER BY park_id, ingested_at DESC;
```

## Data Source

- **API:** Hong Kong Government One Stop Parking Vacancy Data
- **Endpoint:** `https://api.data.gov.hk/v1/carpark-info-vacancy`
- **Specification:** Version 1.2 (14 Jan 2020)
- **Documentation:** See `parking-vacancy-api/parking-vacancy-api-specs.md`

## Project Structure

```
mtc-stations/
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── carpark-vacancy/
│   │           └── route.ts          # Cron endpoint
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── supabase.ts                   # Supabase client
├── types/
│   └── parking-vacancy.ts            # TypeScript types
├── supabase/
│   └── migrations/
│       └── parking_vacancy.sql       # Database schema
├── parking-vacancy-api/              # Reference data
│   ├── parking-vacancy-api-specs.md
│   ├── basic_info_all.json
│   └── vacancy_all.json
├── .env.local                        # Environment variables
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json                       # Vercel cron config
└── README.md
```

## Troubleshooting

### Cron job not working
- Check Vercel deployment logs
- Verify `CRON_SECRET` is set in Vercel environment variables
- Ensure the SQL migration has been applied

### No data in database
- Check Supabase logs for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Run manual ingestion with curl to test

### API errors
- Check if HK Gov API is accessible: `https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy`
- Review API logs in Vercel

## License

MIT
