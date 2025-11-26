# Development Progress Tracker

> This file tracks ongoing work for continuity across Claude/Codex sessions.
> Updated: 2025-11-26

## Current Sprint: Codebase Improvements

### Completed Tasks

#### 1. Supabase Client Unification ✅
- **Date**: 2025-11-26
- **Status**: Complete
- **Changes**:
  - Refactored `lib/supabase.ts` with role-aware factory pattern
  - `getServerSupabaseClient('service' | 'anon')` - cached singleton per role
  - `getBrowserSupabaseClient()` - for client components
  - Updated 25 API routes to use shared client
  - Removed all inline `createClient` calls
- **Files modified**: See git diff for full list
- **Verified**: TypeScript check passes

#### 2. Database Performance (Indexes) ✅
- **Date**: 2025-11-26
- **Status**: Complete
- **Changes**:
  - Added 4 new partial indexes for frequently queried patterns
  - `idx_parking_vacancy_trending_privatecar` - optimizes trending view refresh
  - `idx_parking_vacancy_history_valid` - optimizes history API queries
  - `idx_metered_occupancy_valid_recent` - optimizes metered history RPC
  - `idx_metered_occupancy_ingested_valid` - optimizes time-windowed metered queries
- **Migration**: `supabase/migrations/20251126_add_performance_indexes.sql`
- **Applied**: All indexes verified in production database

#### 3. API Route Reorganization ✅
- **Date**: 2025-11-26
- **Status**: Complete
- **Changes**:
  - Fixed naming inconsistency: `/api/carpark/[id]` → `/api/carparks/[park_id]/analytics`
  - Moved page: `/carpark/[id]` → `/carparks/[park_id]`
  - Created RPC function `get_carpark_analytics()` to replace raw pg client
  - All routes now use shared Supabase client pattern
  - Deleted deprecated `/api/carpark/` and `/carpark/` directories
- **Migration**: `supabase/migrations/20251126_carpark_analytics_rpc.sql`
- **Verified**: TypeScript check passes

### Pending Tasks (Priority Order)

#### 4. Data Quality/Validation - MEDIUM
- **Status**: Not started
- **Goal**: Add validation on ingest, schema constraints, structured logging

#### 5. Migration Consolidation - MEDIUM
- **Status**: Not started
- **Goal**: Collapse 20+ migration files into clean baseline
- **Location**: `supabase/migrations/`

#### 6. Live Refresh/SSE - MEDIUM
- **Status**: Not started
- **Goal**: Real-time updates via WebSocket/SSE or polling with ETag

#### 7. CI/Lint Guardrails - LOW
- **Status**: Not started
- **Goal**: Enforce lint/format/type checks, add integration tests

---

## Architecture Notes

### Database
- **Supabase PostgreSQL** with materialized views
- Cron jobs refresh views every 5 minutes
- Trending system: `activity_score = (changes * 10) + (variance / 2) + (data_points * 0.5)`

### Key Patterns
- Service role: cron jobs, admin routes, write operations
- Anon role: public read endpoints
- Materialized views: `latest_parking_vacancy`, `latest_metered_carpark_occupancy`, `trending_carparks_cache`

### Data Sources
- HK Gov parking vacancy API (5-min intervals)
- Metered space occupancy CSV
- 649 metered carparks, ~52M+ snapshot rows

---

## Session Handoff Notes

### For Claude
- Read this file at session start
- Check `git status` for uncommitted changes
- Continue from next pending task or ask user

### For Codex
- Can query: `codex exec "Read PROGRESS.md and summarize current status"`
- Use for planning: `codex exec "Based on PROGRESS.md, design approach for [next task]"`

---

## Codex Collaboration Log

| Date | Task | Codex Role | Outcome |
|------|------|------------|---------|
| 2025-11-26 | Supabase unification | Designed approach, reviewed implementation | Success - caught 5 files using deprecated alias |
| 2025-11-26 | Database indexes | Analyzed schema, recommended indexes | Success - added 4 partial indexes for query optimization |
| 2025-11-26 | API route reorganization | N/A | Success - unified /carpark and /carparks patterns |

