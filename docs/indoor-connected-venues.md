# Indoor Connected Venues PMTiles (Subset for Connected Carparks)

## Scope
- 35 unique indoor venues that spatially overlap with ~130 connected carparks (38 overlaps collapsed to 35 venue_ids).
- Layers included: `footprint`, `level`, `unit`, `venue`.
- CRS: input EPSG:2326 (HK grid), output EPSG:4326.
- Zoom range: z15–18.
- Output: `indoor-connected.pmtiles` (≈5.4 MB).
- Hosted at: `https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/indoor-connected.pmtiles`
- Env var: `NEXT_PUBLIC_INDOOR_CONNECTED_PMTILES_URL=https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/indoor-connected.pmtiles`

## Data selection
- Overlap detection: transformed connected carparks (WGS84) → EPSG:2326 and intersected with indoor venue polygons.
- Results: 38 overlaps, 35 unique `Venue_ID`s.
- Lists:
  - `analysis/connected-carparks-venue-overlap.csv` (overlap rows)
  - `analysis/connected-carparks-venue-list.csv` (unique venues with download URLs)
- Downloaded GeoJSON zips to `indoor-map-3d/connected-venues/<venue_id>/...`.

## Processing pipeline
Script: `scripts/process-indoor-connected.py`
- Scans `indoor-map-3d/connected-venues/**/{footprint,level,unit,venue}.geojson`.
- Handles UTF-8 BOM and reprojects EPSG:2326→4326 (skips if already lon/lat).
- Writes NDJSON to `/tmp/indoor-connected-{layer}.ndjson`.

Tiling
```bash
tippecanoe -o /tmp/indoor-connected.mbtiles -Z15 -z18 \
  --force --no-tile-size-limit --drop-densest-as-needed --extend-zooms-if-still-dropping \
  -L footprint:/tmp/indoor-connected-footprint.ndjson \
  -L level:/tmp/indoor-connected-level.ndjson \
  -L unit:/tmp/indoor-connected-unit.ndjson \
  -L venue:/tmp/indoor-connected-venue.ndjson

pmtiles convert /tmp/indoor-connected.mbtiles /tmp/indoor-connected.pmtiles
```

Upload
```bash
rclone copy /tmp/indoor-connected.pmtiles r2:mtc-buildings-tiles/
# Public URL: https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/indoor-connected.pmtiles
```

## Consumption plan
- Use a PMTiles overlay/worker (similar to buildings/pedestrian) to render:
  - `footprint` polygons per venue/floor
  - `level` metadata for floor filtering
  - `unit` polygons for fine-grain indoor layout (optionally hidden until high zoom or selected venue)
  - `venue` for labeling/indexing
- Filter by `venue_id` and `level_id` to show only the selected carpark-associated venue/floor.
- Suggested UI: a toggle for “Indoor (connected carparks)” and a floor picker sourced from the `level` layer for the active venue.

## Notes / caveats
- Tippecanoe warnings about “dimensions beyond two” are expected; Z values are ignored for tiling.
- This PMTiles only includes the 35 overlapping venues. A full 701-venue PMTiles would require bulk download/reprojection and larger tiling.
