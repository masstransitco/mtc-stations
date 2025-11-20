# 3D Buildings PMTiles Implementation

## Overview

The `BuildingOverlayPMTiles` component renders 3D building extrusions on Google Maps using WebGLOverlayView and Three.js. It loads building data from a PMTiles archive hosted on Cloudflare Workers, providing efficient tile-based streaming of building geometry.

## Architecture

### Core Components

```
BuildingOverlayPMTiles (React Component)
├── Google Maps WebGLOverlayView (Rendering Integration)
├── Three.js (3D Scene Management)
├── TileManager (Tile Loading & Caching)
├── MaterialPalette (Reusable Materials)
├── Web Worker (Off-thread Tile Processing)
└── PMTiles Archive (Building Data Storage)
```

### Key Files

- **`components/building-overlay-pmtiles.tsx`**: Main component and rendering logic
- **`lib/tile-manager.ts`**: Tile lifecycle, LRU cache, and load queue management
- **`lib/material-palette.ts`**: Shared Three.js materials for memory efficiency
- **`lib/geo-utils.ts`**: Geographic coordinate transformations
- **`workers/pmtiles-worker.ts`**: Off-thread PMTiles decoding and geometry processing

## Coordinate System

### Anchor-Based Positioning

All geometry is positioned relative to a **fixed anchor point** (set once at initialization to the map center):

```typescript
// Set anchor once in onAdd
anchorRef.current = {
  lat: center.lat(),
  lng: center.lng(),
  altitude: 0
};
```

**Why anchor-based?**
- Google Maps' WebGLOverlayView requires a consistent reference point
- All building vertices are converted to anchor-relative coordinates
- Camera projection matrix uses the same anchor
- Keeps geometry and camera in the same coordinate frame

### Coordinate Transformation

Buildings are transformed from lat/lng to 3D space using WebMercator projection:

```typescript
// Convert building coordinates to anchor-relative 3D positions
const position = latLngAltToVector3(
  { lat, lng, altitude: 0 },
  anchorRef.current  // Same anchor as camera
);
```

**Critical Rule**: The camera matrix and geometry **must use the same anchor**. Using different anchors causes drift, shearing, and misalignment.

## Rendering Pipeline

### 1. Initialization (`useEffect` - lines 59-100)

```typescript
// Initialize PMTiles archive
const pmtiles = new PMTiles(pmtilesUrl);

// Spawn Web Worker for tile processing
const worker = new Worker(new URL('@/workers/pmtiles-worker.ts', import.meta.url));

// Create material palette for reusable materials
const materialPalette = new MaterialPalette(opacity);
```

### 2. WebGL Overlay Setup (`useEffect` - lines 102-311)

```typescript
const overlay = new google.maps.WebGLOverlayView();

overlay.onAdd = () => {
  // Create Three.js scene with lighting
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.add(new THREE.DirectionalLight(0xffffff, 0.4));
};

overlay.onContextRestored = ({ gl }) => {
  // Create Three.js renderer using Google Maps' WebGL context
  const renderer = new THREE.WebGLRenderer({
    canvas: gl.canvas,
    context: gl,
    ...gl.getContextAttributes(),
  });

  // Initialize TileManager
  const tileManager = new TileManager({
    maxConcurrentLoads: 4,
    maxCachedTiles: 50,
    pmtiles,
    worker,
    onTileReady: handleTileReady,
  });
};
```

### 3. Frame Rendering (`overlay.onDraw` - lines 187-248)

Every frame:

1. **Update camera matrix** using the fixed anchor:
```typescript
const anchor = anchorRef.current;
const matrix = transformer.fromLatLngAltitude({
  lat: anchor.lat,
  lng: anchor.lng,
  altitude: anchor.altitude,
});
camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
```

2. **Render scene**:
```typescript
renderer.render(scene, camera);
renderer.resetState(); // Critical: prevent conflicts with Google Maps
```

### 4. Viewport Change (`useEffect` - lines 358-391)

When map becomes idle after panning/zooming:

**Important**: The idle event handler is **debounced by 150ms** to prevent excessive tile cancellations during continuous panning or smooth zoom animations. This prevents queue thrashing where tiles are constantly added and immediately canceled.

```typescript
const handleIdle = () => {
  // Debounce to prevent excessive tile cancellations
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    loadBuildingsForViewport();
  }, 150);
};
```

When the debounced handler fires:

1. **Calculate required tiles** for current viewport (zero buffer)
2. **Prune out-of-viewport tiles** immediately
3. **Request new tiles** with distance-based priority

```typescript
// Get tiles in actual viewport bounds (zero buffer)
const bounds = getViewportBounds();
const tiles = getTilesInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng(), tileZoom);

// Build set of required tiles
const requiredTileKeys = new Set<string>();
tiles.forEach(tile => requiredTileKeys.add(`${tile.z}/${tile.x}/${tile.y}`));

// Prune cached tiles outside viewport
const prunedTiles = tileManager.pruneToBounds(requiredTileKeys);
prunedTiles.forEach(tileGroup => {
  scene.remove(tileGroup);
  // Dispose geometries (materials are shared)
  tileGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
});

// Request new tiles with distance-based priority
tileManager.requestTiles(tiles.map(tile => ({
  z: tile.z,
  x: tile.x,
  y: tile.y,
  priority: (tile.x - centerTile.x) ** 2 + (tile.y - centerTile.y) ** 2
})));
```

## Tile Management

### TileManager Responsibilities

1. **Load Queue**: Priority queue for pending tile loads
2. **Concurrency Control**: Limit to 4 concurrent loads
3. **LRU Cache**: Keep up to 50 tiles in memory
4. **Viewport Pruning**: Remove out-of-viewport tiles
5. **Stale Tile Cancellation**: Skip tiles no longer needed

### Tile Loading Flow

```
User pans map
  ↓
'idle' event fires
  ↓
loadBuildingsForViewport()
  ↓
Calculate visible tiles (viewport only, no buffer)
  ↓
Prune cached tiles NOT in visible set
  ↓
Request visible tiles with distance priority
  ↓
TileManager fetches from PMTiles
  ↓
Worker decodes tile & processes geometry
  ↓
handleTileReady() creates Three.js meshes
  ↓
Add to scene & cache (evict LRU if > 50)
  ↓
requestRedraw() triggers render
```

### Tile Eviction Strategy

**Viewport-Aware Pruning** (Primary):
- Every viewport change → remove tiles outside bounds
- Zero-buffer approach: only keeps tiles in actual viewport
- Immediate removal from scene and cache
- Geometry disposed to free memory
- Ensures only visible tiles are rendered

**LRU Eviction** (Fallback):
- Only triggers if cache exceeds 50 tiles (rare with aggressive pruning)
- Evicts least recently accessed tile
- Returns evicted group to overlay for cleanup
- Scene removal and geometry disposal handled by overlay

```typescript
// handleTileReady - lines 316-358
const evictedTiles = tileManager.addToCache(tileKey, tileGroup);
evictedTiles.forEach(evictedGroup => {
  scene.remove(evictedGroup);
  evictedGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
});
```

## Building Color Scheme

### Color Data Source

Building colors are embedded in the PMTiles archive during the data processing stage. The color assignment is based on Hong Kong government building categorization data.

**For detailed information about building categories, color coding logic, and data schema**, see:
- **[Building Data Schema & Color Coding](./buildings-info-schema.md)**

### Color Application

Colors are read directly from the PMTiles data and applied via the MaterialPalette:

```typescript
// Worker extracts color from MVT feature
const color = properties.color || '#cccccc';  // Fallback to gray

// MaterialPalette creates reusable material
const material = materialPalette.getMaterial(color);

// Applied to building mesh
const mesh = new THREE.Mesh(geometry, material);
```

### Material Reuse Benefit

With only 4 distinct colors in the dataset, material sharing is extremely efficient:
- **4 materials** shared across **341,961 buildings**
- ~99.9% memory reduction vs unique materials per building
- Faster rendering (minimal material switching)
- Only 4 shader programs compiled for all buildings

## Geometry Creation

### Building Mesh Pipeline

1. **Worker Processing** (`workers/pmtiles-worker.ts`):
   - Decode PMTiles vector tile (Mapbox Vector Tile format)
   - Extract building polygons and heights
   - Calculate building centroids
   - Return processed building data

2. **Mesh Creation** (`createBuildingsFromWorkerData` - lines 570-638):

```typescript
for (const building of buildings) {
  // Convert lat/lng coordinates to anchor-relative 3D
  const absolutePoints: THREE.Vector3[] = [];
  coordinates.forEach(([lng, lat]) => {
    const point = latLngAltToVector3(
      { lat, lng, altitude: 0 },
      anchorRef.current  // Fixed anchor
    );
    absolutePoints.push(point);
  });

  // Calculate building centroid
  const centerX = sum(absolutePoints.map(p => p.x)) / absolutePoints.length;
  const centerY = sum(absolutePoints.map(p => p.y)) / absolutePoints.length;

  // Create 2D shape in local coordinates (relative to centroid)
  const shape = new THREE.Shape();
  absolutePoints.forEach((pt, index) => {
    const localX = pt.x - centerX;
    const localY = pt.y - centerY;
    if (index === 0) shape.moveTo(localX, localY);
    else shape.lineTo(localX, localY);
  });

  // Extrude to 3D
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false
  });

  // Get reusable material from palette
  const material = materialPalette.getMaterial(color);

  // Create mesh and position at centroid
  const mesh = new THREE.Mesh(geometry, material);
  const buildingGroup = new THREE.Group();
  buildingGroup.add(mesh);
  buildingGroup.position.set(centerX, centerY, 0);

  tileGroup.add(buildingGroup);
}
```

### Material Reuse

**MaterialPalette** maintains a cache of reusable materials to reduce memory:

```typescript
class MaterialPalette {
  private materials = new Map<string, THREE.Material>();

  getMaterial(color: string): THREE.Material {
    if (!this.materials.has(color)) {
      this.materials.set(color, new THREE.MeshLambertMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: this.opacity,
      }));
    }
    return this.materials.get(color)!;
  }
}
```

**Benefits**:
- Thousands of buildings share only **4 materials** (see [buildings-info-schema.md](./buildings-info-schema.md) for color details)
- Reduces memory by ~99.9% compared to unique materials per building
- Extremely fast rendering (minimal material switching)
- Only 4 shader programs compiled for all buildings

## Performance Optimizations

### 1. Web Worker Offloading
- PMTiles decoding runs off main thread
- Geometry processing parallelized
- Main thread only creates Three.js meshes

### 2. Viewport-Aware Pruning
- Only loads tiles in current viewport (zero buffer)
- Aggressive pruning removes out-of-viewport tiles immediately on pan
- At z18: 4-12 tiles instead of 40-60 (with old buffer approach)
- Evicted tiles removed from scene and geometry disposed

### 3. Concurrency & Prioritization
- Load 4 tiles concurrently
- Distance-based priority (closest tiles first)
- Stale tile cancellation

### 4. LRU Cache
- Keep 50 tiles in memory
- Smooth panning without reload
- Automatic eviction when full

### 5. Material Sharing
- Only **4 materials** for all buildings (see [buildings-info-schema.md](./buildings-info-schema.md))
- Thousands of buildings share these materials
- 99.9%+ memory reduction vs unique materials
- Minimal GPU state changes (faster rendering)

### 6. Idle-Based Loading
- Only load when map is idle (not during pan)
- Prevents loading intermediate viewports
- Reduces unnecessary tile fetches

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_PMTILES_CDN_URL=https://pmtiles-cors-proxy.mark-737.workers.dev
```

### Component Props

```typescript
interface BuildingOverlayProps {
  visible?: boolean;  // Show/hide buildings (default: true)
  opacity?: number;   // Building opacity 0-1 (default: 0.8)
}
```

### TileManager Settings

```typescript
{
  maxConcurrentLoads: 4,  // Concurrent tile loads
  maxCachedTiles: 50,     // Maximum tiles in memory
}
```

### Zoom Levels

```typescript
MIN_BUILDING_ZOOM = 16  // Don't show buildings below z16
PMTILES_ZOOM_RANGE = [15, 18]  // PMTiles available at z15-z18
```

**Note**: Although PMTiles data is available from z15, buildings are only rendered starting at z16 to reduce tile loading at lower zoom levels and improve performance at city-wide views.

## Common Issues & Solutions

### Issue: Excessive tile cancellations during extended use

**Symptoms**:
- Console shows many "🚫 Canceled tiles" messages during panning/zooming
- Tiles are added to queue then immediately canceled
- Buildings fail to render during continuous interaction

**Cause**: Google Maps `'idle'` event fires very frequently during:
- Continuous panning (multiple times per drag)
- Smooth zoom animations (fires at each intermediate zoom level)
- Small viewport adjustments
- Tilt/rotation changes

Without debouncing, each idle event triggers `loadBuildingsForViewport()` → `cancelTilesNotIn()`, creating queue thrashing where tiles never get a chance to load.

**Solution**: Debounce the idle event handler:
```typescript
// ✅ Correct - debounced (current implementation)
let debounceTimer: NodeJS.Timeout | null = null;

const handleIdle = () => {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    loadBuildingsForViewport();
    debounceTimer = null;
  }, 150);  // Wait 150ms after last idle event
};

// ❌ Wrong - immediate response causes thrashing
const handleIdle = () => {
  loadBuildingsForViewport();  // Fires too frequently!
};
```

**Why 150ms?**
- Long enough to filter out rapid successive idle events
- Short enough to feel responsive to user
- Allows smooth animations to complete before loading
- Reduces tile queue churn by ~90%

### Issue: Buildings disappear when panning

**Cause**: Anchor mismatch between geometry and camera matrix

**Solution**: Ensure both use the same anchor:
```typescript
// ✅ Correct
const anchor = anchorRef.current;
const matrix = transformer.fromLatLngAltitude(anchor);

// ❌ Wrong - causes drift
const center = map.getCenter();
const matrix = transformer.fromLatLngAltitude(center);
```

### Issue: Too many tiles loading at high zoom

**Cause**: Buffer loading extra tiles outside viewport

**Solution**: Use actual viewport bounds with zero buffer:
```typescript
// ✅ Correct - zero buffer (current implementation)
const getViewportBounds = (): google.maps.LatLngBounds | null => {
  if (!map) return null;
  return map.getBounds() || null;
};

// ❌ Wrong - loads too many tiles
const latBuffer = (ne.lat() - sw.lat()) * 0.2;  // Don't do this!
```

**Why zero buffer works:**
- Viewport-aware pruning removes offscreen tiles immediately
- Large cache (50 tiles) handles rapid panning
- At z18: 4-12 tiles instead of 40-60

### Issue: Tiles from old viewport stay visible

**Cause**: Eviction not removing tiles from scene

**Solution**: Viewport-aware pruning:
```typescript
const prunedTiles = tileManager.pruneToBounds(requiredTileKeys);
prunedTiles.forEach(tileGroup => {
  scene.remove(tileGroup);  // Critical!
  // Dispose geometries
});
```

### Issue: Buildings drift or shear during pan

**Cause**: Double-transformation (scene offset + camera matrix)

**Solution**: Remove manual scene translation:
```typescript
// ❌ Wrong - double transform
scene.position.set(offset.x, offset.y, offset.z);

// ✅ Correct - single transform via camera matrix
camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
```

## Data Flow Diagram

```
PMTiles Archive (Cloudflare R2)
         ↓
   PMTiles Client
         ↓
   Tile Binary Data
         ↓
   Web Worker (decode MVT)
         ↓
   Processed Building Data {coordinates, height, color}
         ↓
   handleTileReady()
         ↓
   createBuildingsFromWorkerData()
         ↓
   Three.js Meshes (ExtrudeGeometry + MeshStandardMaterial)
         ↓
   Add to Scene
         ↓
   WebGLOverlayView.onDraw()
         ↓
   Google Maps Canvas
```

## Future Improvements

### Potential Optimizations

1. **Geometry Instancing**: For identical building shapes
2. **LOD (Level of Detail)**: Simpler geometry at low zoom
3. **Tile Preloading**: Predict pan direction and preload
4. **Compressed Textures**: Add rooftop textures efficiently
5. **GPU Culling**: Compute shader-based frustum culling
6. **Batch Rendering**: Merge buildings per tile into single mesh

### Potential Features

1. **Building Selection**: Click to highlight/info
2. **Height Animation**: Animate extrusion on load
3. **Time-of-Day Lighting**: Dynamic shadows based on sun position
4. **Building Labels**: Show names/addresses at high zoom
5. **Roof Shapes**: Pitched roofs, domes, etc.

## References

- [Google Maps WebGLOverlayView](https://developers.google.com/maps/documentation/javascript/webgl)
- [Three.js Documentation](https://threejs.org/docs/)
- [PMTiles Specification](https://github.com/protomaps/PMTiles)
- [Mapbox Vector Tiles](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/)
- [WebMercator Projection](https://en.wikipedia.org/wiki/Web_Mercator_projection)
