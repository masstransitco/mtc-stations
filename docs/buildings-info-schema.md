# Building Data Schema & Color Coding

## Overview

This document details the Hong Kong building footprint data structure, color coding logic, and the relationship between administrative categories and actual land use classifications.

## Data Sources

### Primary Data Source: Hong Kong Lands Department

**Dataset**: Building Footprint Public Data (20251017)
**Source**: Hong Kong Lands Department
**Format**: Geodatabase (converted to GeoJSON)
**Total Buildings**: 341,961

### Data Files

#### 1. BUILDING_STRUCTURE (Main Dataset)
**File**: `Building_Footprint_Public_20251017.gdb_BUILDING_STRUCTURE_converted.json`
**Size**: 453.7 MB
**Records**: 341,961 buildings

**Key Fields**:
```typescript
{
  OBJECTID: number;
  BUILDINGSTRUCTUREID: number;
  BUILDINGCSUID: string;
  BUILDINGSTRUCTURETYPE: string;  // "T" (Tower), "P" (Podium), "U" (Underground)
  CATEGORY: string;                // "1", "2", "3", "4", "5", "9"
  STATUS: string;
  OFFICIALBUILDINGNAMEEN?: string;
  OFFICIALBUILDINGNAMETC?: string;
  NUMABOVEGROUNDSTOREYS?: number | null;
  NUMBASEMENTSTOREYS?: number | null;
  TOPHEIGHT?: number | null;      // Height in meters
  BASEHEIGHT?: number | null;
  GROSSFLOORAREA?: number | null;
  RECORDCREATIONDATE: string;
  RECORDUPDATEDDATE: string;
  SHAPE_Length: number;
  SHAPE_Area: number;
}
```

#### 2. BUILDING_INFO (Land Use Supplement)
**File**: `Building_Footprint_Public_20251017.gdb_BUILDING_INFO_converted.json`
**Size**: 3.7 MB
**Records**: ~10,000 buildings (~3% of total)

**Key Fields**:
```typescript
{
  OBJECTID: number;
  BUILDINGSTRUCTUREID: number;    // Links to BUILDING_STRUCTURE
  INFOTYPE: string;                // "HS" (HA Housing Scheme), "IU" (Intended Usage)
  INFODESCRIPTION: string;         // Actual building use description
  BEGIN_LIFESPAN: string | null;
  END_LIFESPAN: string | null;
}
```

#### 3. Code Tables

**CT_BUILDING_CATEGORY**: Defines CATEGORY codes
**CT_BUILDING_STRUCTURE_TYPE**: Defines BUILDINGSTRUCTURETYPE codes
**CT_BUILDING_INFO_TYPE**: Defines INFOTYPE codes

## Building Category System (CATEGORY Field)

### Official Category Definitions

Source: `CT_BUILDING_CATEGORY`

| Code | Description | Count | % | Notes |
|------|-------------|-------|---|-------|
| **1** | Legal Private Buildings, and HA/HS buildings under jurisdiction of the Buildings Ordinance | 57,422 | 16.8% | Private sector buildings, some HOS under PSPS |
| **2** | New Territories Small Houses | 16,170 | 4.7% | Village houses (NTEH) |
| **3** | HA Buildings (including towers and podiums) | 5,740 | 1.7% | Public housing estates (except PSPS) |
| **4** | Other Government Buildings | 101 | 0.03% | Government offices, schools, hospitals |
| **5** | Miscellaneous Structures | 119,537 | 35.0% | Temporary and open structures |
| **9** | Category is not assigned | 142,991 | 41.9% | Unclassified buildings |

**Total**: 341,961 buildings

### Important Notes on Categories

⚠️ **Categories represent ADMINISTRATIVE/OWNERSHIP classification, NOT land use**

- **Category 1**: Mix of residential, commercial, and mixed-use private buildings
- **Category 2**: Predominantly residential (village houses)
- **Category 3**: Residential (public housing)
- **Category 4**: Institutional/government
- **Categories 5/9**: Mixed uses, many unclassified

## Current Color Coding Implementation

### Color Mapping

Source: `scripts/process-buildings.ts`, `scripts/convert-buildings.ts`

```typescript
const CATEGORY_COLORS: Record<string, string> = {
  '1': '#3b82f6',  // Blue (Tailwind blue-500)
  '2': '#f97316',  // Orange (Tailwind orange-500)
  '3': '#6b7280',  // Dark Gray (Tailwind gray-500)
  'default': '#d1d5db'  // Light Gray (Tailwind gray-300)
};
```

### Color Distribution

| Color | Hex | Category | Buildings | % | What It Represents |
|-------|-----|----------|-----------|---|--------------------|
| 🔵 **Blue** | `#3b82f6` | 1 | 57,422 | 16.8% | **Legal Private Buildings** |
| 🟧 **Orange** | `#f97316` | 2 | 16,170 | 4.7% | **New Territories Village Houses** |
| ⬛ **Dark Gray** | `#6b7280` | 3 | 5,740 | 1.7% | **Public Housing (HA Buildings)** |
| ⬜ **Light Gray** | `#d1d5db` | 4, 5, 9 | 262,629 | 76.8% | **Government, Misc, Unassigned** |

### Color Coding Logic

```typescript
// scripts/process-buildings.ts:290
color: getCategoryColor(feature.properties.CATEGORY)

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}
```

## Actual Land Use Data (BUILDING_INFO)

### Coverage

- **Available for**: ~10,000 buildings (3% of total)
- **Source field**: `INFODESCRIPTION`
- **Link**: `BUILDINGSTRUCTUREID` matches between files

### Land Use Categories (from INFODESCRIPTION)

Approximate counts based on keyword analysis:

| Land Use Type | Keyword Matches | Examples |
|---------------|-----------------|----------|
| **Residential** | ~9,254 | "Residence", "Apartment", "Housing", "Public Rental Housing" |
| **Commercial** | ~1,217 | "Commercial", "Hotel", "Office", "Shop" |
| **Industrial** | ~127 | "Industrial", "Factory", "Workshop", "Warehouse" |
| **Institutional** | ~800 | "School", "Hospital", "Government", "Institution" |
| **Mixed Use** | ~600 | "Apartment/Commercial", "Residence/Shop" |

### Sample INFODESCRIPTION Values

```
"Public Rental Housing"
"Apartment/Commercial"
"Commercial"
"Industrial"
"Hotel"
"School"
"Hospital"
"Apartment with residents' recreational facilities"
"Single family house"
"Office"
"Warehouse"
"Institutional"
```

## Building Structure Types

Source: `CT_BUILDING_STRUCTURE_TYPE`

| Code | Description | Count | % |
|------|-------------|-------|---|
| **T** | Tower | 333,034 | 97.4% |
| **P** | Podium | 8,927 | 2.6% |
| **U** | Underground Structure | 0 | 0% |

## Data Processing Pipeline

### Current Implementation

```
1. Source Data
   └─> Building_Footprint_Public_20251017.gdb_BUILDING_STRUCTURE_converted.json

2. Processing Script
   └─> scripts/process-buildings.ts
       ├─> Read CATEGORY field
       ├─> Map CATEGORY to color (CATEGORY_COLORS)
       ├─> Calculate height (TOPHEIGHT or NUMABOVEGROUNDSTOREYS * 3.5m)
       └─> Convert coordinates (EPSG:2326 → EPSG:4326)

3. Output (PMTiles)
   └─> buildings.pmtiles
       └─> Each building has: coordinates, height_m, color

4. Rendering
   └─> components/building-overlay-pmtiles.tsx
       └─> workers/pmtiles-worker.ts extracts color from tile
       └─> lib/material-palette.ts creates materials per color
```

### Files Involved

| File | Purpose |
|------|---------|
| `scripts/process-buildings.ts` | Main processing script (converts & tiles buildings) |
| `scripts/convert-buildings.ts` | Alternative conversion script |
| `scripts/export-buildings-ndjson.ts` | Export to NDJSON format |
| `scripts/tile-buildings.ts` | Tile pre-converted buildings |
| `workers/pmtiles-worker.ts` | Decode tiles in browser |
| `lib/material-palette.ts` | Manage Three.js materials |
| `components/building-overlay-pmtiles.tsx` | Render 3D buildings |

## Data Limitations

### 1. Category ≠ Land Use

The `CATEGORY` field represents **administrative/regulatory classification**, not actual building use:

- Category 1 buildings can be residential, commercial, or mixed-use
- There is no way to distinguish a residential tower from a commercial office in Category 1
- Current color coding shows ownership/regulation type, not land use

### 2. Limited Land Use Data

- Only ~3% of buildings have `INFODESCRIPTION` data
- 97% of buildings lack explicit land-use information
- `BUILDING_INFO` table must be joined to `BUILDING_STRUCTURE` by `BUILDINGSTRUCTUREID`

### 3. Unclassified Buildings

- 41.9% of buildings have `CATEGORY = "9"` (not assigned)
- 35.0% are "Miscellaneous Structures" (temporary/open)
- 76.8% of all buildings render as light gray (default color)

## Potential Improvements

### Option 1: Join with BUILDING_INFO

**Pros**:
- Accurate land use for ~3% of buildings
- Could use INFODESCRIPTION to categorize by actual use

**Cons**:
- Only covers 10,000 out of 341,961 buildings
- Requires join operation during processing
- Still leaves 97% without land use data

**Implementation**:
```typescript
// Join BUILDING_INFO by BUILDINGSTRUCTUREID
// Parse INFODESCRIPTION for keywords:
// - "Commercial" → Commercial
// - "Industrial" → Industrial
// - "Residence"/"Apartment"/"Housing" → Residential
// - Default → Other
```

### Option 2: Inference from Building Characteristics

Use multiple fields to infer land use:

```typescript
function inferLandUse(building: BuildingProperties): string {
  // Use CATEGORY + height + area + name
  if (building.CATEGORY === '2') return 'RESIDENTIAL';  // Village houses
  if (building.CATEGORY === '3') return 'RESIDENTIAL';  // Public housing
  if (building.CATEGORY === '4') return 'INSTITUTIONAL'; // Government

  // Category 1: Infer from other fields
  if (building.CATEGORY === '1') {
    // Check building name for keywords
    if (building.OFFICIALBUILDINGNAMEEN?.match(/TOWER|CENTRE|PLAZA/i)) {
      return 'COMMERCIAL';
    }
    // Default to residential for Category 1
    return 'RESIDENTIAL';
  }

  return 'OTHER';
}
```

**Pros**:
- Covers all buildings
- Can use multiple signals (name, height, area)

**Cons**:
- Less accurate than actual data
- Requires heuristic rules

### Option 3: Keep Current System, Fix Labels

Update code comments and documentation to reflect reality:

```typescript
const CATEGORY_COLORS: Record<string, string> = {
  '1': '#3b82f6',  // Legal Private Buildings (NOT "Residential")
  '2': '#f97316',  // Village Houses (NOT "Commercial")
  '3': '#6b7280',  // Public Housing (NOT "Industrial")
  'default': '#d1d5db'  // Government/Misc/Unassigned
};
```

**Pros**:
- Accurate to data source
- No code changes needed

**Cons**:
- Colors don't represent land use
- Less intuitive for users

## Recommendations

1. **Short term**: Fix documentation and code comments to accurately reflect what categories mean
2. **Medium term**: Implement BUILDING_INFO join for the ~3% with land use data
3. **Long term**: Develop inference algorithm to classify remaining 97% by combining:
   - Building name keyword analysis
   - Height characteristics (tall towers → commercial/residential, low → commercial/industrial)
   - Geographic location (industrial zones, commercial districts)
   - Building area and floor count

## References

- [Hong Kong Buildings Ordinance](https://www.legislation.gov.hk/blis_ind.nsf/CurAllEngDoc/6D482F8335E6B52B482575EE003C3F38?OpenDocument)
- [Lands Department Building Footprint Data](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-building-footprint)
- Processing scripts: `scripts/process-buildings.ts`, `scripts/convert-buildings.ts`
- Rendering implementation: `docs/3d_buildings_pmtiles_implementation.md`
