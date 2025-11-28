# Stale/Disconnected Carpark Data – 2025-11-25 (HKT)

Context: The in-app “open/closed” badge and vacancy values for indoor carparks appear unreliable. This note records what we found in the HK Gov datasets and in Supabase so we can decide whether to hide/replace the badge and how to treat stale feeds.

## Data sources reviewed
- Local HK Gov datasets in `parking-vacancy-api/`: `basic_info_all.json` (metadata) and `vacancy_all.json` (single snapshot).
- Supabase tables (service role, vehicle_type = `privateCar`):
  - `latest_vacancy_with_location` (current view)
  - `parking_vacancy_snapshots` (historical time series)
  - `carpark_info` (metadata)

## Key findings
- Opening status is effectively static: 382 “OPEN”, 5 “open”, 100 null, 0 “CLOSED” in `basic_info_all.json`. Badge can only ever show “OPEN”/“Unknown”; it never reflects closures.
- Snapshot freshness is bad: in `vacancy_all.json`, 663/665 timestamps are future-dated `2025-11-15` and 2 are from `2021-09-28`. Example: Tai Po Government Offices (tdc37p1) marked “OPEN” with lastupdate `2021-09-28` and 0 vacancy.
- Mismatch between status and activity: many “OPEN” sites have 0 or 1 reported spaces. In the local snapshot, 27 “OPEN” sites report 0 spaces; 134 report exactly 1.
- Supabase counts (indoor/privateCar):
  - Current carparks tracked: 346 (`latest_vacancy_with_location`).
  - Total historical rows: ~1.4M in `parking_vacancy_snapshots` (vehicle_type=privateCar).

## Carparks with constant vacancy across all history
Min == max over entire `parking_vacancy_snapshots` history (nulls excluded):
- tdc14p1030 — Siu Sai Wan Phase 3 Car Park — 1
- tdc14p4312 — Kwong Fuk Car Park — 1
- tdc14p7629 — Fung Tak Car Park A — 1
- tdc2p4 — AIRPORT CAR PARK 4 — 1
- tdc58p1 — Wong Nai Chung Gap Children Playground — 57
- tdc74p13 — Kwong Fuk Park — 29
- tdc74p7 — Yau Oi Sports Centre — 0
- tdc81p2 — Kwai Chung Sports Ground — 0
- tdc8p11 — MTR Ocean Park Station Car Park — 36

## Implications
- The “OPEN/CLOSED” badge is not trustworthy (never “CLOSED”, stale timestamps, zero/one-space records still “OPEN”). Recommendation: remove or replace the badge until we have reliable status.
- Constant-valued sites are likely stale/disconnected. They should be flagged or hidden unless independently verified.

## Follow-ups to consider
- Add a freshness check (e.g., lastupdate within N minutes/hours) before showing status.
- Suppress or label carparks with invariant vacancy or obviously stale timestamps.
- If status is needed, derive a health flag from vacancy movement + timestamp recency instead of `opening_status`.
