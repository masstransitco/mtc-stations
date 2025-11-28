# Indoor PMTiles Implementation

## Overview

The `IndoorOverlayPMTiles` component renders indoor venue polygons (footprints, levels, units) on Google Maps using WebGLOverlayView and Three.js. It loads indoor map data from a PMTiles archive containing 35 venues that overlap with connected carparks in Hong Kong.

## Architecture

### Core Components

```
IndoorOverlayPMTiles (React Component)
├── Google Maps WebGLOverlayView (Rendering Integration)
├── Three.js (3D Scene Management)
├── TileManager (Tile Loading & Caching)
├── MaterialPalette (Reusable Materials)
├── Web Worker (Off-thread Tile Processing)
└── PMTiles Archive (Indoor Data Storage)
```

### Key Files

- **`components/indoor-overlay-pmtiles.tsx`**: Main component and rendering logic
- **`components/indoor-level-picker.tsx`**: UI for selecting floor levels
- **`lib/tile-manager.ts`**: Tile lifecycle, LRU cache, and load queue management
- **`lib/material-palette.ts`**: Shared Three.js materials for memory efficiency
- **`lib/geo-utils.ts`**: Geographic coordinate transformations
- **`workers/pmtiles-worker.ts`**: Off-thread PMTiles decoding (`DECODE_INDOOR_TILE` handler)

## Data Source

### PMTiles Archive

- **URL**: `https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/indoor-connected.pmtiles`
- **Size**: ~5.4 MB
- **Zoom Range**: z15–z18
- **Coverage**: 35 indoor venues overlapping with connected carparks

### Layers

The PMTiles archive contains four layers from Hong Kong indoor mapping data:

| Layer | Description | Use |
|-------|-------------|-----|
| `footprint` | Building outline polygons | Venue boundaries |
| `level` | Floor/level metadata | Level filtering, ordinal info |
| `unit` | Individual units/rooms | Fine-grained indoor layout |
| `venue` | Venue metadata | Labels, venue identification |

### Feature Properties

Each indoor polygon feature contains:

```typescript
interface IndoorPolygonData {
  coordinates: [number, number][];  // [lng, lat] pairs
  height: number;                   // Extrusion height (meters)
  altitude: number;                 // Z position based on level ordinal
  color: string;                    // Hex color for rendering
  venueId?: string;                 // Venue identifier for filtering
  ordinal?: number;                 // Floor level (0=G, 1=1F, -1=B1, etc.)
  category?: string;                // Feature category
  layer: string;                    // Source layer name
}
```

## Component Props

```typescript
interface IndoorOverlayProps {
  visible?: boolean;              // Show/hide overlay (default: false)
  opacity?: number;               // Transparency 0-1 (default: 0.8)
  activeVenueId?: string | null;  // Filter by specific venue
  activeLevelOrdinal?: number | null;  // Filter by floor level
}
```

### Level Filtering

The `activeLevelOrdinal` prop filters polygons by floor:

| Ordinal | Display | Description |
|---------|---------|-------------|
| -2 | B2 | Basement level 2 |
| -1 | B1 | Basement level 1 |
| 0 | G | Ground floor |
| 1 | 1F | First floor |
| 2 | 2F | Second floor |
| ... | ... | ... |

When `activeLevelOrdinal` is `null`, all levels are shown.

## Rendering Pipeline

### 1. Initialization

```typescript
// Initialize PMTiles archive
const pmtiles = new PMTiles(process.env.NEXT_PUBLIC_INDOOR_CONNECTED_PMTILES_URL);

// Spawn Web Worker for tile processing
const worker = new Worker(new URL('@/workers/pmtiles-worker.ts', import.meta.url));

// Create material palette for reusable materials
const materialPalette = new MaterialPalette(opacity);
```

### 2. WebGL Overlay Setup

The component follows the same pattern as `BuildingOverlayPMTiles`:

```typescript
useEffect(() => {
  if (!map || !google.maps.WebGLOverlayView) return;

  const overlay = new google.maps.WebGLOverlayView();

  overlay.onAdd = () => {
    // Set anchor point from map center
    anchorRef.current = { lat: center.lat(), lng: center.lng(), altitude: 0 };

    // Create Three.js scene with lighting
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.35));
  };

  overlay.onContextRestored = ({ gl }) => {
    // Create renderer using Google Maps' WebGL context
    const renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes(),
    });

    // Initialize TileManager with indoor-specific request type
    const tileManager = new TileManager({
      maxConcurrentLoads: 4,
      maxCachedTiles: 50,
      pmtiles,
      worker,
      onTileReady: handleTileReady,
      requestType: 'DECODE_INDOOR_TILE',  // Indoor-specific decoder
    });

    setIsInitialized(true);
  };

  overlay.setMap(map);
}, [map]);
```

### 3. Tile Processing (Worker)

The worker handles `DECODE_INDOOR_TILE` requests:

```typescript
// workers/pmtiles-worker.ts
case 'DECODE_INDOOR_TILE': {
  const tile = new VectorTile(new Pbf(data));
  const indoorPolygons: IndoorPolygonData[] = [];

  // Process each indoor layer
  for (const layerName of ['footprint', 'level', 'unit', 'venue']) {
    const layer = tile.layers[layerName];
    if (!layer) continue;

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const props = feature.properties;
      const ordinal = typeof props.ordinal === 'number' ? props.ordinal : 0;

      indoorPolygons.push({
        coordinates: extractCoordinates(feature, z, x, y),
        height: Number(props.height) || 3,
        altitude: ordinal * 4,  // 4 meters per floor
        color: getIndoorColor(layerName, props.category),
        venueId: String(props.venue_id || ''),
        ordinal,
        category: String(props.category || ''),
        layer: layerName,
      });
    }
  }

  return { type: 'INDOOR_TILE_DECODED', indoorPolygons };
}
```

### 4. Mesh Creation

Indoor polygons are extruded to 3D with floor-based altitude:

```typescript
const createIndoorMeshes = (polygons: IndoorPolygonData[], materialPalette: MaterialPalette) => {
  const tileGroup = new THREE.Group();

  for (const poly of polygons) {
    // Convert coordinates to anchor-relative 3D (altitude: 0)
    const absolutePoints = poly.coordinates.map(([lng, lat]) =>
      latLngAltToVector3({ lat, lng, altitude: 0 }, anchor)
    );

    // Calculate centroid
    const centerX = average(absolutePoints.map(p => p.x));
    const centerY = average(absolutePoints.map(p => p.y));

    // Create 2D shape in local coordinates
    const shape = new THREE.Shape();
    absolutePoints.forEach((pt, i) => {
      const localX = pt.x - centerX;
      const localY = pt.y - centerY;
      i === 0 ? shape.moveTo(localX, localY) : shape.lineTo(localX, localY);
    });

    // Extrude to 3D
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: poly.height,
      bevelEnabled: false
    });

    const material = materialPalette.getMaterial(poly.color);
    const mesh = new THREE.Mesh(geometry, material);

    // Position group at centroid with Z = altitude (floor-based)
    const polyGroup = new THREE.Group();
    polyGroup.add(mesh);
    polyGroup.position.set(centerX, centerY, poly.altitude);

    tileGroup.add(polyGroup);
  }

  return tileGroup;
};
```

### 5. Level Filtering

Filtering happens in `handleTileReady` before mesh creation:

```typescript
const handleTileReady = (tileKey: string, response: WorkerResponse) => {
  const filtered = response.indoorPolygons.filter(poly => {
    // Filter by venue if specified
    if (activeVenueId && poly.venueId !== activeVenueId) return false;

    // Filter by level if specified
    if (activeLevelOrdinal !== null && poly.ordinal !== activeLevelOrdinal) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    // Cache empty tile to prevent re-fetching
    tileManager.addToCache(tileKey, new THREE.Group());
    return;
  }

  const tileGroup = createIndoorMeshes(filtered, materialPalette);
  scene.add(tileGroup);
  tileManager.addToCache(tileKey, tileGroup);
};
```

## Level Picker UI

The `IndoorLevelPicker` component provides floor selection:

```typescript
<IndoorLevelPicker
  visible={showIndoorLayer && currentZoom >= 16}
  isDarkMode={isDarkMode}
  selectedLevel={indoorLevelOrdinal}
  onLevelChange={setIndoorLevelOrdinal}
  availableLevels={[-2, -1, 0, 1, 2, 3, 4, 5]}
/>
```

Features:
- Appears on right side of map when indoor layer is visible at z16+
- Collapsed by default showing current level (or "All")
- Expands to show all available levels
- "All" option to show all floors simultaneously
- Levels sorted top-to-bottom (highest first)

## Visibility Effects

The component has multiple effects that handle visibility changes:

```typescript
// 1. Update visibility ref for onDraw
useEffect(() => {
  visibleRef.current = visible;
  overlayRef.current?.requestRedraw();
}, [visible]);

// 2. Clear tiles when hidden, reload when shown
useEffect(() => {
  if (!sceneRef.current) return;

  if (!visible) {
    clearAllTiles();  // Free memory when hidden
  } else {
    if (isInitialized && tileManagerRef.current) {
      loadIndoorForViewport();
    }
    overlayRef.current?.requestRedraw();
  }
}, [visible]);

// 3. Reload when filter props change
useEffect(() => {
  if (!isInitialized || !visible) return;

  clearAllTiles();
  loadIndoorForViewport();
}, [activeVenueId, activeLevelOrdinal]);
```

## Color Scheme

Indoor features use category-based colors:

```typescript
const getIndoorColor = (layer: string, category?: string): string => {
  // Layer-based defaults
  switch (layer) {
    case 'footprint': return '#64748b';  // Slate
    case 'level':     return '#94a3b8';  // Light slate
    case 'unit':      return '#cbd5e1';  // Lighter slate
    case 'venue':     return '#475569';  // Dark slate
  }

  // Category-specific colors (if available)
  // ... additional category logic

  return '#94a3b8';  // Default
};
```

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_INDOOR_CONNECTED_PMTILES_URL=https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev/indoor-connected.pmtiles
```

### TileManager Settings

```typescript
{
  maxConcurrentLoads: 4,   // Concurrent tile loads
  maxCachedTiles: 50,      // Maximum tiles in memory
  requestType: 'DECODE_INDOOR_TILE',  // Worker message type
}
```

### Zoom Levels

```typescript
MIN_INDOOR_ZOOM = 16     // Don't show below z16
PMTILES_ZOOM_RANGE = [15, 18]  // Data available at z15-z18
```

## Data Processing Pipeline

For reference, the PMTiles archive was created with:

### 1. Data Selection

```python
# Identify venues overlapping connected carparks
# Results: 35 unique venue_ids from 38 overlaps
# See: analysis/connected-carparks-venue-overlap.csv
```

### 2. Processing Script

```bash
python scripts/process-indoor-connected.py
# Scans indoor-map-3d/connected-venues/**/*.geojson
# Reprojects EPSG:2326 → EPSG:4326
# Outputs NDJSON files to /tmp/
```

### 3. Tiling

```bash
tippecanoe -o /tmp/indoor-connected.mbtiles -Z15 -z18 \
  --force --no-tile-size-limit --drop-densest-as-needed \
  -L footprint:/tmp/indoor-connected-footprint.ndjson \
  -L level:/tmp/indoor-connected-level.ndjson \
  -L unit:/tmp/indoor-connected-unit.ndjson \
  -L venue:/tmp/indoor-connected-venue.ndjson

pmtiles convert /tmp/indoor-connected.mbtiles /tmp/indoor-connected.pmtiles
```

### 4. Upload

```bash
rclone copy /tmp/indoor-connected.pmtiles r2:mtc-buildings-tiles/
```

## Comparison with Building Overlay

| Aspect | BuildingOverlayPMTiles | IndoorOverlayPMTiles |
|--------|------------------------|----------------------|
| Data source | `buildings.pmtiles` | `indoor-connected.pmtiles` |
| Size | ~180 MB | ~5.4 MB |
| Coverage | All HK buildings | 35 connected venues |
| Layers | Single `buildings` layer | 4 layers (footprint, level, unit, venue) |
| Altitude | All at ground (Z=0) | Floor-based (ordinal × 4m) |
| Filtering | None | By venue and level |
| Default visible | Yes | No |

## Common Issues

### Issue: Indoor overlay not initializing

**Symptom**: `isInitialized: false` when visibility toggled

**Cause**: WebGL setup effect has too many guard conditions

**Solution**: Match building overlay pattern - only check `!map || !google.maps.WebGLOverlayView`

### Issue: Level filter not working

**Symptom**: All levels shown despite selecting specific level

**Cause**: Filter props captured in stale closure

**Solution**: Use refs for filter props in handleTileReady:

```typescript
const activeVenueIdRef = useRef(activeVenueId);
const activeLevelOrdinalRef = useRef(activeLevelOrdinal);

useEffect(() => {
  activeVenueIdRef.current = activeVenueId;
  activeLevelOrdinalRef.current = activeLevelOrdinal;
}, [activeVenueId, activeLevelOrdinal]);
```

### Issue: Double altitude positioning

**Symptom**: Upper floors appear twice as high as expected

**Cause**: Passing altitude to both `latLngAltToVector3` AND group position

**Solution**: Use `altitude: 0` in coordinate conversion, set altitude only on group:

```typescript
// ✅ Correct
const point = latLngAltToVector3({ lat, lng, altitude: 0 }, anchor);
polyGroup.position.set(centerX, centerY, poly.altitude);

// ❌ Wrong - double altitude
const point = latLngAltToVector3({ lat, lng, altitude: poly.altitude }, anchor);
polyGroup.position.set(centerX, centerY, poly.altitude);
```

## Future Improvements

1. **Dynamic level discovery**: Extract available levels from tile data
2. **Venue labels**: Show venue names at appropriate zoom
3. **Unit interactivity**: Click to highlight/select units
4. **Category styling**: Different colors for shops, corridors, facilities
5. **3D room extrusion**: Varying heights for different unit types
6. **Integration with carpark selection**: Auto-show relevant venue when carpark selected

## References

- [Hong Kong Indoor Map Portal](https://geodata.gov.hk/gs/view-dataset?uuid=...)
- [PMTiles Specification](https://github.com/protomaps/PMTiles)
- [3D Buildings PMTiles Implementation](./3d_buildings_pmtiles_implementation.md)
- [Indoor Connected Venues Data](./indoor-connected-venues.md)
