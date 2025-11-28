# Building Exterior Filtering for Connected Carparks

## Overview

Add a "SHOW/HIDE EXTERIOR" button to the connected-carpark-details component that renders only the 3D building associated with the selected connected carpark, similar to how the indoor overlay filters by venue ID.

## Current State

### Buildings PMTiles Data
- **Source**: HK Government Building Footprint dataset
- **Properties per building**:
  - `OBJECTID` - Unique feature ID
  - `BUILDINGSTRUCTUREID` - Building structure identifier (primary key for filtering)
  - `CATEGORY` - Building category (1=Residential, 2=Commercial, 3=Industrial)
  - `height_m` - Building height in meters
  - `color` - Pre-computed color based on category
- **Total buildings**: ~341,873 polygons
- **Zoom range**: z15-z18

### Current Worker Implementation
The `pmtiles-worker.ts` currently discards building IDs:
```typescript
// Current BuildingData interface - no IDs
export interface BuildingData {
  coordinates: Array<[number, number]>;
  height: number;
  color: string;
  centerLat: number;
  centerLng: number;
}
```

## Spatial Join Results

Script: `scripts/find-connected-carpark-buildings.py`
Output files:
- `scripts/building_structure_id_updates.sql` - SQL UPDATE statements
- `scripts/building_structure_id_mapping.csv` - Full mapping CSV

**Result**: **131/132 carparks matched** to buildings (99.2%)

### Unmatched Carpark
| park_id | Name | Reason |
|---------|------|--------|
| connected_125 | Wu Shan Road Car Park | Standalone open car park, no building footprint |

### Sample Matched Carparks
| Connected Carpark | park_id | BUILDINGSTRUCTUREID |
|-------------------|---------|---------------------|
| V City | connected_116 | 357270 |
| Times Square | connected_108 | 168201 |
| Pacific Place | connected_78 | 204971 |
| Cityplaza | connected_21 | 213320 |
| YOHO Mall | connected_128 | 387365 |
| New Town Plaza Phase 1 | connected_71 | 99695 |
| apm | connected_5 | 213596 |
| Millennium City 1 | connected_62 | 160880 |
| The Lohas | connected_102 | 412334 |
| Popcorn 1 | connected_85 | 348626 |

## Implementation Plan

### 1. Database Schema Update

Add `building_structure_id` column to `connected_carparks` table:

```sql
ALTER TABLE connected_carparks
ADD COLUMN IF NOT EXISTS building_structure_id TEXT;

-- Update with spatial join results (131 carparks)
-- Full SQL in: scripts/building_structure_id_updates.sql
UPDATE connected_carparks SET building_structure_id = '357270' WHERE park_id = 'connected_116'; -- V City
UPDATE connected_carparks SET building_structure_id = '168201' WHERE park_id = 'connected_108'; -- Times Square
-- ... (131 updates total)

CREATE INDEX IF NOT EXISTS idx_connected_carparks_building_structure_id
ON connected_carparks(building_structure_id);
```

### 2. Type Updates

**`types/connected-carpark.ts`**:
```typescript
export interface ConnectedCarpark {
  // ... existing fields
  building_structure_id: string | null;  // NEW
}
```

### 3. API Update

**`app/api/connected-carparks/route.ts`**:
- Add `building_structure_id` to SELECT query
- Include in response transformation

### 4. Worker Update

**`workers/pmtiles-worker.ts`**:

Update `BuildingData` interface:
```typescript
export interface BuildingData {
  coordinates: Array<[number, number]>;
  height: number;
  color: string;
  centerLat: number;
  centerLng: number;
  buildingStructureId?: string;  // NEW
}
```

Update `processMVTFeature()` to include building ID:
```typescript
return {
  coordinates,
  height,
  color,
  centerLat,
  centerLng,
  buildingStructureId: String(properties.BUILDINGSTRUCTUREID || ''),
};
```

### 5. BuildingOverlayPMTiles Update

**`components/building-overlay-pmtiles.tsx`**:

Add props for filtering:
```typescript
interface BuildingOverlayProps {
  visible?: boolean;
  opacity?: number;
  activeBuildingId?: string | null;  // NEW - filter to single building
}
```

Update `handleTileReady` to filter buildings:
```typescript
const handleTileReady = (tileKey: string, response: WorkerResponse) => {
  // ... existing code

  // Filter by active building ID if specified
  let buildings = response.buildings || [];
  if (activeBuildingIdRef.current) {
    buildings = buildings.filter(b =>
      b.buildingStructureId === activeBuildingIdRef.current
    );
  }

  // ... rest of existing code
};
```

### 6. SimpleMap Integration

**`components/simple-map.tsx`**:

Add state for exterior layer:
```typescript
const [showExteriorLayer, setShowExteriorLayer] = useState(false);
```

Add handler:
```typescript
const handleToggleExterior = useCallback((show: boolean, lat: number, lng: number) => {
  setShowExteriorLayer(show);
  if (show && map) {
    map.panTo({ lat, lng });
    map.setZoom(18);
  }
}, [map]);
```

Pass to BuildingOverlayPMTiles:
```typescript
<BuildingOverlayPMTiles
  visible={show3DBuildings || showExteriorLayer}
  opacity={0.6}
  activeBuildingId={
    selectedCarparkType === 'connected' && showExteriorLayer
      ? (selectedCarpark as ConnectedCarpark)?.building_structure_id ?? null
      : null
  }
/>
```

### 7. UI Update

**`components/connected-carpark-details.tsx`**:

Add props:
```typescript
interface ConnectedCarparkDetailsProps {
  carpark: ConnectedCarpark;
  showIndoorLayer?: boolean;
  onToggleIndoor?: (show: boolean, lat: number, lng: number) => void;
  showExteriorLayer?: boolean;  // NEW
  onToggleExterior?: (show: boolean, lat: number, lng: number) => void;  // NEW
}
```

Add button (to the left of SHOW INDOOR):
```typescript
{/* Show Exterior Toggle Button - only for carparks with building data */}
{onToggleExterior && carpark.building_structure_id && (
  <button onClick={() => onToggleExterior(!showExteriorLayer, carpark.latitude, carpark.longitude)}>
    {showExteriorLayer ? 'Hide Exterior' : 'Show Exterior'}
  </button>
)}

{/* Show Indoor Toggle Button - existing */}
{onToggleIndoor && carpark.has_indoor_map && (
  <button onClick={() => onToggleIndoor(!showIndoorLayer, carpark.latitude, carpark.longitude)}>
    {showIndoorLayer ? 'Hide Indoor' : 'Show Indoor'}
  </button>
)}
```

## Button Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Carpark Name                                               │
│                     [SHOW EXTERIOR] [SHOW INDOOR] [MTC STATION] │
└─────────────────────────────────────────────────────────────┘
```

- **SHOW EXTERIOR**: Only visible if `building_structure_id` exists (131 carparks - 99%)
- **SHOW INDOOR**: Only visible if `has_indoor_map` is true (~35 carparks with indoor venues)
- Both buttons can be active simultaneously

## Auto-Hide Behavior

Similar to indoor layer, auto-hide exterior when zoom < 16:
```typescript
useEffect(() => {
  if (showExteriorLayer && currentZoom < MIN_BUILDING_ZOOM) {
    setShowExteriorLayer(false);
  }
}, [currentZoom, showExteriorLayer]);
```

## Files to Modify

1. `supabase/migrations/20251128_add_building_structure_id_to_connected_carparks.sql` - NEW
2. `types/connected-carpark.ts` - Add field
3. `app/api/connected-carparks/route.ts` - Add to query
4. `workers/pmtiles-worker.ts` - Include building ID in output
5. `components/building-overlay-pmtiles.tsx` - Add filtering
6. `components/simple-map.tsx` - Add state and handlers
7. `components/connected-carpark-details.tsx` - Add button

## Edge Cases

1. **No building found** (Wu Shan Road Car Park): Button won't render - only 1 carpark unmatched
2. **Both layers active**: User can see exterior building + indoor layout simultaneously
3. **Zoom out below 16**: Both layers auto-hide, buttons revert to "SHOW" state
4. **Deselect carpark**: Both layers hide (activeBuildingId becomes null)
5. **131/132 carparks have building data**: SHOW EXTERIOR button available for 99%+ of carparks

## Testing Checklist

- [ ] V City shows exterior building when toggled
- [ ] Button only appears for carparks with building_structure_id
- [ ] Exterior auto-hides when zoom < 16
- [ ] Both exterior and indoor can be shown simultaneously
- [ ] Selecting different carpark updates the building filter
- [ ] Deselecting carpark hides exterior layer
