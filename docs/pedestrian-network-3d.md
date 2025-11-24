# Pedestrian Network & Indoor Maps: Integration Plan

This outlines how to ingest the 3D Pedestrian Network and Indoor Map datasets into the existing 3D PMTiles + WebGLOverlayView stack.

## Data notes
- Pedestrian network (`pedestrian-network-3d/3DPN_P2_202509.gdb_PedestrianRoute_converted.*`): EPSG:2326 polylineZ, 467,916 records. Key attrs: `FeatureTyp`, `WeatherPro`, `Wheelchair`, `Gradient`, `Direction`, `AccessTime`, `FloorID`, `BuildingID`, `SiteID`, `TerminalID`, `DistancePost`, `Shape_Leng`.
- Lookup tables:
  - `PedRouteRelBldgPoly` (BuildingID/name), `PedRouteRelFloorPoly` (FloorID/BuildingID names), `PedRouteRelTerminalPoly` (TerminalID/type/name), `PedRouteRelSitePoly` (SiteID/type/name), `PedRouteRelDistancePost` (labels), `AccessTime` + `AccessTimeDetails` (time windows keyed by AccessTime).
- Indoor venues (`indoor-map-3d/3DIndoorMap.json`): EPSG:2326 polygons (701 venues). Props include `Venue_*_name`, `Building_*_name`, `Type`, and signed download links for per-venue SHP/GeoJSON zips.
- Current 3D pipeline: PMTiles + worker decoding + anchor-based WebMercator coordinates (`docs/3d_buildings_pmtiles_implementation.md`).

## Pipeline: Pedestrian network → PMTiles
Goal: produce a PMTiles archive with a `pedestrian` layer (and optional `terminals`, `distance_posts`) ready for the existing TileManager/worker pattern.

1) Reproject to WGS84 with length preservation  
```bash
# Requires GDAL/ogr2ogr
ogr2ogr -t_srs EPSG:4326 -nlt LINESTRINGZ \
  /tmp/pedestrian_route_wgs84.geojson \
  pedestrian-network-3d/3DPN_P2_202509.gdb_PedestrianRoute_converted.shp
```

2) Pre-join lookup attributes (optional but recommended so the client has flat attrs):  
Join `AccessTime`+`AccessTimeDetails` into a readable window, and join `FloorID/BuildingID/SiteID/TerminalID` names. Example with `jq` + `ogrinfo` is cumbersome; a small Node/Python join script is suggested (kept client-flat attrs: `feature_type`, `wheelchair`, `weather`, `gradient`, `access_window`, `floor_name`, `building_name`, `site_name`, `terminal_name`, `distance_post`).

3) Tile to PMTiles (MVT)  
```bash
# Requires tippecanoe and pmtiles CLI
tippecanoe -o /tmp/pedestrian.mbtiles \
  -z18 -Z15 --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --no-tile-size-limit --force --layer=pedestrian \
  --coalesce --coalesce-densest-as-needed \
  /tmp/pedestrian_route_wgs84.geojson

pmtiles convert /tmp/pedestrian.mbtiles /tmp/pedestrian.pmtiles
```

4) Upload to R2 (same pattern as buildings)  
```bash
rclone copy /tmp/pedestrian.pmtiles r2:mtc-buildings-tiles/pedestrian.pmtiles \
  --progress --transfers=4
```

5) Configure CDN env var (dev can use local file path):  
```
NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL=https://<r2-public-url>/pedestrian.pmtiles
```

## Overlay implementation sketch
- Clone the existing `BuildingOverlayPMTiles` pattern with a new worker that decodes the `pedestrian` layer and returns `LineString` coordinates (lat/lng) plus styling hints.
- Rendering: use anchor-relative WebMercator (`latLngAltToVector3`) and draw as `THREE.LineSegments` or thin tubes slightly above ground (e.g., z=1–2m) to avoid z-fighting with basemap/buildings.
- Styling ideas:
  - Color by `FeatureTyp` (e.g., grade-separated, subway concourse, footbridge).
  - Dash/opacity for restricted `AccessTime`; tooltip shows resolved window.
  - Icons/labels for `distance_post` and `terminal_name` at midpoints.
  - Width bump for `Wheelchair`-friendly routes; muted for inaccessible.
- Reuse `TileManager` semantics: load only viewport tiles at z≥16; cache 30–50 tiles; priority near center. Debounce map idle events as in the buildings PMTiles overlay.

### Worker responsibilities
- Decode MVT tile, read `pedestrian` layer (and optionally `terminals`, `distance_posts`).
- Convert tile coordinates → lat/lng (same tileToBounds logic as buildings worker).
- Return an array of line segments:
  ```ts
  interface PedLineData {
    coordinates: Array<[number, number]>; // ordered path
    color: string;
    widthMeters?: number;
    featureType?: string;
    accessWindow?: string;
    distancePost?: string;
  }
  ```

### Main-thread overlay responsibilities
- Convert coords to anchor-relative vectors.
- Build `THREE.LineGeometry`/`LineMaterial` (or `Line2` if available) per tile; group per tile for easy eviction.
- Slight altitude offset (e.g., `z = 1`) to avoid z-fighting with terrain/basemap.
- Optional floor filter: keep `floor` attr; only render when the selected floor matches (pairs with indoor maps).

## Indoor venues
- Use `indoor-map-3d/3DIndoorMap.json` as an index; download per-venue zips on demand or batch, reproject to EPSG:4326, and tile into a small PMTiles set with layers per floor (`floor_polygons`, `floor_lines`) keyed by `Venue_ID` + `Floor`.
- Client: load venue-specific PMTiles when a venue is selected; render floorplans as filled polygons at altitude offsets (e.g., `floor * 4m`). Hide/show by floor toggle.
- Linkage: use shared `BuildingID`/`FloorID` between indoor and pedestrian network to align connectors.

## Next steps
1) Decide on tooling (GDAL + tippecanoe + pmtiles CLI) availability on the build machine; if available, run the commands above to produce `/tmp/pedestrian.pmtiles`.  
2) Add a small worker + overlay component following the sketch to render polylines from `NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL`.  
3) Add a map UI toggle (similar to 3D buildings toggle) and optional filters: wheelchair only, weather-protected only, restricted hours off/on.  
4) For indoor, pick 1–2 venues as a pilot, tile them, and add a floor selector that controls both indoor polygons and pedestrian segments with matching `FloorID`.

## Progress log
- ✅ Generated full network PMTiles from shapefile (EPSG:2326→4326, z15–18, coalesced): `pedestrian.pmtiles` size ~69 MB.
- ✅ Uploaded to R2 bucket `mtc-buildings-tiles`: `https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/pedestrian.pmtiles`.
- ✅ Environment variable configured: `NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL=https://pmtiles-cors-proxy.mark-737.workers.dev/pedestrian.pmtiles` (via Cloudflare Worker for edge caching)
- ✅ **Client overlay implemented**: `PedestrianNetworkOverlayPMTiles` component with full feature parity to buildings
- ✅ **Worker extended**: Decodes `pedestrian` layer from PMTiles MVT tiles
- ✅ **UI toggle**: Pedestrian network button (position: 260px from top) with on/off state
- ✅ **Performance optimizations**: All building overlay patterns applied (zoom checks, frame counting, stats logging, etc.)
- ✅ **Bug fixes**: Material type correction (LineBasicMaterial) and altitude alignment (0m)
- ⏳ Pending: Indoor venues integration, floor selector, accessibility filters

---

## Implementation Details

### Architecture Overview

The pedestrian network overlay follows the same architecture as `BuildingOverlayPMTiles`:
- **Component**: `components/pedestrian-network-overlay-pmtiles.tsx` (432 lines)
- **Worker**: `workers/pmtiles-worker.ts` (extended to handle `DECODE_PEDESTRIAN_TILE`)
- **Material System**: `lib/material-palette.ts` (extended to support line materials)
- **Utilities**: Reuses `TileManager`, `geo-utils`, existing patterns

### Key Files

| File | Purpose | Key Changes |
|------|---------|-------------|
| `components/pedestrian-network-overlay-pmtiles.tsx` | Main overlay component | New file - renders 3D polylines |
| `workers/pmtiles-worker.ts` | Tile decoding | Added `DECODE_PEDESTRIAN_TILE` type, `PedestrianLineData`, `processPedestrianFeature()` |
| `lib/material-palette.ts` | Material management | Added `getLineMaterial()`, `lineMaterials` Map, `LineBasicMaterial` support |
| `lib/tile-manager.ts` | Tile lifecycle | Added `requestType` parameter, updated callback to pass full `WorkerResponse` |
| `components/simple-map.tsx` | UI integration | Added toggle button, `showPedestrianNetwork` state, passed to overlay |
| `components/icons/pedestrian-network-icon.tsx` | UI icon | New walking person icon |
| `.env.local` | Configuration | Added `NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL` |

### Component Implementation

**Pattern Used**: Exact clone of `BuildingOverlayPMTiles` adapted for lines instead of meshes.

**Initialization Flow**:
1. `useMap()` hook retrieves map instance (reliable, not DOM query)
2. PMTiles archive initialized from `NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL`
3. Web Worker spawned for off-thread tile processing
4. MaterialPalette created with initial opacity (0.9)
5. WebGLOverlayView created and attached to map
6. TileManager initialized with `requestType: 'DECODE_PEDESTRIAN_TILE'`
7. Initial tiles loaded on `onContextRestored`

**Rendering Pipeline**:
```
Map idle event (150ms debounce)
  ↓
loadPedestrianForViewport()
  ↓
Calculate required tiles (z15-18, viewport only)
  ↓
Prune out-of-viewport tiles
  ↓
Request tiles with distance-based priority
  ↓
TileManager fetches from PMTiles
  ↓
Worker decodes 'pedestrian' layer (MVT)
  ↓
processPedestrianFeature() extracts LineStrings
  ↓
handleTileReady() receives PedestrianLineData[]
  ↓
createLinesFromWorkerData() builds THREE.Line meshes
  ↓
Add to scene, cache (LRU eviction if >50 tiles)
  ↓
requestRedraw() triggers onDraw()
```

### Worker Extension

**Interface Additions** (`workers/pmtiles-worker.ts`):

```typescript
// Request type extended
type: 'DECODE_TILE' | 'DECODE_PEDESTRIAN_TILE'

// New data structure
interface PedestrianLineData {
  coordinates: Array<[number, number]>;  // lat/lng pairs
  color: string;                         // Determined by feature type
  widthMeters: number;                   // Based on wheelchair accessibility
  featureType: string;                   // From FeatureTyp property
  wheelchair: boolean;                   // Wheelchair accessible
  weatherProtected: boolean;             // Weather protected
  gradient?: number;
  accessWindow?: string;
  floorName?: string;
  buildingName?: string;
  distancePost?: string;
}

// Response extended
interface WorkerResponse {
  type: 'TILE_DECODED' | 'PEDESTRIAN_TILE_DECODED';
  tileKey: string;
  buildings?: BuildingData[];
  pedestrianLines?: PedestrianLineData[];
  error?: string;
}
```

**Color Coding Logic**:
- **Blue** (#4a90e2): Default/surface routes
- **Orange** (#f59e0b): Footbridges/elevated routes
- **Purple** (#8b5cf6): Subway/underground routes
- **Green** (#10b981): Indoor routes

**Width Assignment**:
- **2.5m**: Wheelchair accessible (`Wheelchair === 'Y'`)
- **1.5m**: Standard routes

### Material System Enhancement

**Critical Fix**: Lines require different materials than meshes.

**Problem Identified**:
- `MeshLambertMaterial` is **lit** (responds to directional lighting)
- When used with `THREE.Line`, lighting response is unpredictable
- Resulted in intermittent black rendering (depending on light angle)

**Solution Implemented** (`lib/material-palette.ts`):

```typescript
class MaterialPalette {
  private materials: Map<string, THREE.MeshLambertMaterial>;      // For buildings
  private lineMaterials: Map<string, THREE.LineBasicMaterial>;    // For lines

  // Get mesh material (lit, for buildings)
  getMaterial(color: string): THREE.MeshLambertMaterial

  // Get line material (unlit, for pedestrian network)
  getLineMaterial(color: string): THREE.LineBasicMaterial

  // Update opacity for both material types
  setOpacity(opacity: number): void

  // Dispose both material types
  dispose(): void
}
```

**Why LineBasicMaterial**:
- ✅ Unlit - always shows intended color regardless of lighting
- ✅ Lightweight - faster than lit materials
- ✅ Consistent - no shadow/lighting artifacts
- ✅ Appropriate for 2D lines in 3D space

### Coordinate System & Altitude Alignment

**Critical Fix**: Geometry and camera must use the same altitude reference.

**Problem Identified**:
- Initial implementation: Lines at **1.5m altitude**, camera at **0m altitude**
- When map tilts, perspective projection breaks (reference frame mismatch)
- Lines appeared offset/desynchronized from map

**Solution Implemented**:
- **Lines**: `altitude: 0` (ground level, matching camera)
- **Camera**: `altitude: 0` (anchor reference)
- **Buildings**: `altitude: 0` (same pattern)
- **Result**: All geometry synchronized with camera reference frame

**Code**:
```typescript
// createLinesFromWorkerData() - Line 338
const position = latLngAltToVector3(
  { lat, lng, altitude: 0 },  // Ground level (was 1.5m)
  anchor
);
```

**Anchor Pattern**:
- Set **once** in `onAdd` callback to map center
- Never updated (stays fixed throughout session)
- All geometry positioned relative to this anchor
- Camera matrix computed using same anchor
- Pattern ensures synchronization even during pan/tilt/zoom

### Performance Optimizations

**All building overlay optimizations replicated**:

#### 1. Zoom-Based Rendering Gate
```typescript
// onDraw() - Lines 177-192
const currentZoom = map.getZoom() ?? 11;
const shouldRenderPedestrian = visibleRef.current && currentZoom >= MIN_PEDESTRIAN_ZOOM;

if (!shouldRenderPedestrian) {
  // Skip rendering entirely, save GPU cycles
  if (frameCountRef.current % 60 === 0) {
    console.log(`👁️ Pedestrian hidden (zoom ${currentZoom} < 16)`);
  }
  frameCountRef.current++;
  return;
}
```

**Impact**: No rendering at zoom < 16, major GPU savings

#### 2. Recursive Geometry Disposal
```typescript
// disposeTileGroup() - Lines 255-265
const disposeTileGroup = (tileGroup: THREE.Group, scene: THREE.Scene) => {
  scene.remove(tileGroup);

  // Traverse entire tree to find nested geometries
  tileGroup.traverse((obj) => {
    if ((obj instanceof THREE.Mesh || obj instanceof THREE.Line) && obj.geometry) {
      obj.geometry.dispose();
      // Materials shared via MaterialPalette - don't dispose
    }
  });
};
```

**Impact**: Prevents memory leaks from nested geometries

#### 3. Tile Zoom Clamping
```typescript
// loadPedestrianForViewport() - Line 386
const tileZoom = Math.min(Math.max(Math.floor(zoom), 15), 18);
//                             ^^^^^^^^^^^^^^^^^ ensures minimum z15
```

**Impact**: Only requests valid tiles (z15-z18), prevents errors

#### 4. Error Handling & Validation
```typescript
// createLinesFromWorkerData() - Lines 316-367
for (const line of lines) {
  try {
    // Validate coordinates exist
    if (!coordinates || coordinates.length < 2) continue;

    // Validate coordinates are valid numbers
    const validCoords = coordinates.every(
      ([lng, lat]) => !isNaN(lng) && !isNaN(lat)
    );
    if (!validCoords) continue;

    // Create geometry...
  } catch (error) {
    console.error('Failed to create line:', error);
    // Continue processing other lines
  }
}
```

**Impact**: Robust handling of bad data, no crashes

#### 5. Frame-Based Stats Logging
```typescript
// onDraw() - Lines 206-221
frameCountRef.current++;
if (frameCountRef.current - lastStatsLogRef.current >= 120) {
  const stats = tileManager.getStats();
  console.log('📊 Pedestrian Network Stats:', {
    cachedTiles: stats.cacheSize,
    loading: stats.currentlyLoading,
    queueSize: stats.queueSize,
    totalLoaded: stats.tilesLoaded,
    totalEvicted: stats.tilesEvicted
  });
  lastStatsLogRef.current = frameCountRef.current;
}
```

**Impact**: Periodic diagnostics without console spam

#### 6. Throttled Viewport Logging
```typescript
// loadPedestrianForViewport() - Lines 361-365
const now = Date.now();
if (now - lastViewportLogRef.current >= 500) {
  console.log(`Loading viewport at zoom ${zoom}`);
  lastViewportLogRef.current = now;
}
```

**Impact**: Clean console output during continuous panning

#### 7. Accurate Priority Calculation
```typescript
// loadPedestrianForViewport() - Lines 401-405
const mapCenter = map.getCenter();
if (!mapCenter) return;

const centerTile = latLngToTile(mapCenter.lat(), mapCenter.lng(), tileZoom);
// Distance-based priority: (x - cx)² + (y - cy)²
```

**Impact**: Loads closest tiles first, better perceived performance

#### 8. Viewport-Aware Pruning
```typescript
// loadPedestrianForViewport() - Lines 395-398
const requiredTileKeys = new Set<string>();
tiles.forEach((tile) => requiredTileKeys.add(`${tile.z}/${tile.x}/${tile.y}`));

const prunedTiles = tileManager.pruneToBounds(requiredTileKeys);
```

**Impact**: Immediately removes out-of-viewport tiles, reduces memory

### Performance Comparison: Buildings vs Pedestrian

| Optimization | Buildings | Pedestrian | Status |
|--------------|-----------|------------|--------|
| Zoom check in onDraw | ✓ | ✓ | Full parity |
| Frame counting | ✓ | ✓ | Full parity |
| Stats logging (120 frames) | ✓ | ✓ | Full parity |
| Recursive geometry disposal | ✓ | ✓ | Full parity |
| Tile zoom clamping (15-18) | ✓ | ✓ | Full parity |
| Error handling in mesh creation | ✓ | ✓ | Full parity |
| Geometry validation | ✓ | ✓ | Full parity |
| Throttled logging (500ms) | ✓ | ✓ | Full parity |
| map.getCenter() for priority | ✓ | ✓ | Full parity |
| Material sharing | ✓ | ✓ | Full parity |
| LRU cache (50 tiles) | ✓ | ✓ | Full parity |
| Concurrent loads (4) | ✓ | ✓ | Full parity |
| 150ms idle debounce | ✓ | ✓ | Full parity |

**Result**: Pedestrian network has **100% feature parity** with building overlay optimizations.

### Configuration

**Environment Variables**:
```bash
# .env.local
# Served via Cloudflare Worker for edge caching (same as buildings)
NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL=https://pmtiles-cors-proxy.mark-737.workers.dev/pedestrian.pmtiles
```

**Component Props**:
```typescript
interface PedestrianNetworkOverlayProps {
  visible?: boolean;  // Toggle visibility (default: true)
  opacity?: number;   // Line opacity 0-1 (default: 0.9)
}
```

**TileManager Config**:
```typescript
{
  maxConcurrentLoads: 4,          // Load 4 tiles in parallel
  maxCachedTiles: 50,             // Keep 50 tiles in memory
  requestType: 'DECODE_PEDESTRIAN_TILE'  // Use pedestrian decoder
}
```

**Zoom Levels**:
- **Minimum render zoom**: 16 (lines not shown below z16)
- **Tile zoom range**: 15-18 (data available in PMTiles)
- **Optimal viewing**: z17-18 (most detail)

### UI Integration

**Toggle Button** (`components/simple-map.tsx`):
- **Position**: Top-right, 260px from top, 20px from right
- **State**: `showPedestrianNetwork` (boolean, default: true)
- **Icon**: Walking person (`PedestrianNetworkIcon`)
- **Behavior**: Blue when active, gray when inactive
- **Location**: Below 3D buildings button, above My Location button

**State Flow**:
```
simple-map.tsx (state)
  ↓
MapContent (props)
  ↓
PedestrianNetworkOverlayPMTiles (visible prop)
  ↓
onDraw visibility check (skip rendering if false)
```

### Known Limitations & Future Work

**Current Limitations**:
1. No accessibility filtering UI (wheelchair-only toggle)
2. No weather-protection filtering
3. No time-based access window display
4. Floor attribute captured but not used (awaiting indoor venue integration)
5. LineBasicMaterial linewidth > 1 not supported by WebGL (always renders as 1px)

**Future Enhancements**:
1. **Indoor Integration**: Match `FloorID` to show only current floor's routes
2. **Accessibility Filter**: Toggle to show only wheelchair-accessible routes
3. **Weather Filter**: Toggle to show only weather-protected routes
4. **Time Restrictions**: Display access windows on hover/click
5. **Distance Posts**: Render labels for distance markers
6. **Terminal Icons**: Show terminal/station icons at endpoints
7. **Hover Info**: Tooltip with route details (type, accessibility, gradient)
8. **Route Highlighting**: Click to highlight connected route segments
9. **3D Extrusion**: Optional tube geometry for more visible lines (performance tradeoff)
10. **Gradient Visualization**: Color intensity based on route gradient

### Bug Fixes Applied

#### Issue 1: Intermittent Black Line Rendering
**Root Cause**: `MeshLambertMaterial` used with `THREE.Line` - incompatible material/geometry pairing

**Symptoms**:
- Lines sometimes rendered in intended colors (blue, orange, purple, green)
- Lines sometimes rendered as black
- Behavior was unpredictable/inconsistent

**Fix**:
- Extended MaterialPalette to support `LineBasicMaterial`
- Changed pedestrian overlay to use `getLineMaterial()` instead of `getMaterial()`
- LineBasicMaterial is unlit - always shows correct color

**Files Modified**:
- `lib/material-palette.ts`: Added `lineMaterials` Map, `getLineMaterial()`, updated `setOpacity()`/`dispose()`
- `components/pedestrian-network-overlay-pmtiles.tsx`: Line 353 changed to `getLineMaterial(color)`

#### Issue 2: Viewport Desynchronization After Map Tilt
**Root Cause**: Altitude mismatch - geometry at 1.5m, camera at 0m

**Symptoms**:
- After map tilt, pedestrian lines appeared offset from map
- Lines and viewport became desynchronized
- Effect increased with greater tilt angles

**Fix**:
- Changed line altitude from 1.5m to 0m (matching camera reference)
- Ensures geometry and camera use same altitude reference frame
- Matches building overlay pattern (buildings also at 0m)

**Files Modified**:
- `components/pedestrian-network-overlay-pmtiles.tsx`: Line 338 changed altitude to 0

**Technical Explanation**:
- WebGL perspective projection requires consistent reference frame
- When camera is at 0m but geometry is at 1.5m, projection math breaks during tilt
- All anchor-relative coordinates must use same altitude as anchor itself
- Buildings work correctly because they're also at 0m

### Testing & Validation

**Rendering Tests**:
- ✅ Lines render in correct colors (blue, orange, purple, green)
- ✅ Lines stay synchronized with map during pan/tilt/zoom
- ✅ Lines appear/disappear correctly at zoom threshold (16)
- ✅ Toggle button shows/hides network immediately
- ✅ Opacity changes apply correctly

**Performance Tests**:
- ✅ No rendering below zoom 16 (GPU savings confirmed)
- ✅ Viewport pruning removes out-of-viewport tiles immediately
- ✅ LRU cache evicts tiles correctly when exceeding 50
- ✅ Console logging throttled (no spam during continuous pan)
- ✅ Frame rate stable during concurrent tile loading

**Error Handling Tests**:
- ✅ Invalid coordinates skipped gracefully (no crashes)
- ✅ Missing properties handled with defaults
- ✅ Worker errors logged but don't stop other tiles
- ✅ Geometry creation errors caught and logged

### Debugging Tips

**Console Output**:
- `PedestrianNetwork: Initializing with PMTiles URL:` - Component starting
- `PedestrianNetwork: Worker spawned` - Worker ready
- `PedestrianNetwork: Overlay onAdd called` - WebGL overlay attached
- `PedestrianNetwork: WebGL context restored` - Rendering initialized
- `PedestrianNetwork: Initialization complete` - Ready to load tiles
- `PedestrianNetwork: Loading viewport at zoom X` - Tile loading started (500ms throttle)
- `PedestrianNetwork: ✅ Tile Z/X/Y ready with N lines` - Tile rendered
- `📊 Pedestrian Network Stats:` - Periodic stats (every 120 frames)
- `👁️ Pedestrian hidden (zoom X < 16)` - Below minimum zoom (every 60 frames)

**Common Issues**:
1. **No lines visible**: Check zoom level (must be ≥16)
2. **Black lines**: Material issue - verify `getLineMaterial()` is used
3. **Lines offset after tilt**: Altitude mismatch - verify altitude is 0
4. **Console spam**: Check throttling logic (500ms viewport, 60 frame visibility, 120 frame stats)
5. **Memory leak**: Verify `disposeTileGroup()` uses `traverse()`

### References

- **Building Overlay Pattern**: `docs/3d_buildings_pmtiles_implementation.md`
- **Building Component**: `components/building-overlay-pmtiles.tsx`
- **Worker Implementation**: `workers/pmtiles-worker.ts`
- **Material System**: `lib/material-palette.ts`
- **Tile Management**: `lib/tile-manager.ts`
- **Geo Utilities**: `lib/geo-utils.ts`
- **Three.js Docs**: https://threejs.org/docs/
- **PMTiles Spec**: https://github.com/protomaps/PMTiles
- **Google Maps WebGL**: https://developers.google.com/maps/documentation/javascript/webgl
