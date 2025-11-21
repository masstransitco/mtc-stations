# Bottom Sheet Navigation Architecture

**Status**: ✅ **PRODUCTION READY** (November 2025)

---

## Overview

This document details the implementation of the bottom sheet navigation system for the MTC Stations carpark map application. The system provides a multi-view navigation experience with trending carparks, search functionality, and detailed station status views.

---

## Architecture Overview

### Component Hierarchy

```
SimpleMap (simple-map.tsx)
├── Map (Google Maps)
│   └── MapContent
│       ├── Carpark Markers (AdvancedMarker)
│       ├── Selected Carpark Marker (Breathing Animation)
│       ├── User Location Marker
│       └── Search Location Marker
└── BottomSheet
    ├── Home View
    │   ├── AddressSearch
    │   └── TrendingCarparks
    ├── Nearby View
    │   ├── AddressSearch
    │   └── NearbyCarparksList
    └── Station View
        └── StationStatus
```

---

## Components

### 1. BottomSheet Component

**File**: `components/bottom-sheet.tsx`

**Purpose**: Container component that provides a draggable bottom sheet with multiple height states and navigation support.

#### Features

- **Three Height States**:
  - `0`: Expanded (70vh) - Full content view
  - `1`: Collapsed (40vh) - Medium view
  - `2`: Minimized (100px) - Compact header only

- **Interaction Methods**:
  - Drag handle to adjust height
  - Click content area to expand
  - Back button for navigation

- **Navigation Support**:
  - Dynamic title based on current view
  - Optional back button
  - Callback for back navigation

#### Props Interface

```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  onExpand?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}
```

#### Key Implementation Details

- **Click-to-Expand**: Clicking anywhere in the content area expands the sheet to full height
- **Back Button**: Positioned on the left side of the header, uses ChevronLeft icon
- **Smooth Animations**: 0.3s cubic-bezier transitions for height changes
- **Touch Support**: Full touch gesture support for mobile devices

---

### 2. StationStatus Component

**File**: `components/station-status.tsx`

**Purpose**: Displays detailed information about a selected carpark, replacing the previous InfoWindow popup.

#### Features

- **Carpark Information**:
  - Name and opening status
  - Full address
  - District badge

- **Vacancy Data**:
  - Regular parking spaces (color-coded by availability)
  - EV charging spaces
  - Accessible/disabled parking spaces

- **Visual Elements**:
  - Vacancy trend chart (6 hours)
  - Last update timestamp
  - Responsive design with dark mode support

#### Props Interface

```typescript
interface StationStatusProps {
  carpark: CarparkData;
  getMarkerColor: (vacancy: number) => string;
}
```

#### Data Flow

```
Map Marker Click / List Selection
    ↓
selectedCarpark state updated
    ↓
bottomSheetView = 'station'
    ↓
StationStatus component renders with carpark data
    ↓
Map pans to carpark location (zoom level 17)
```

---

### 3. TrendingCarparks Component

**File**: `components/trending-carparks.tsx`

**Purpose**: Displays a list of the top 10 most active carparks based on real-time activity data.

#### Design Philosophy

- **Minimal & Compact**: Clean design with efficient use of space
- **Ranked Display**: Numbered 1-10 with subtle gray numbers
- **Essential Information**: Name, district, vacancy, and EV spaces only

#### Features

- **Activity Scoring**: Fetches from `/api/carparks/trending` endpoint
- **Real-time Data**: Shows current vacancy and EV charging availability
- **Visual Indicators**:
  - Color-coded vacancy numbers
  - Lightning emoji (⚡) for EV spaces
  - Subtle hover effects

#### Layout Structure

```
┌─────────────────────────────────────────┐
│ # │ Carpark Name          │ Vacancy     │
│   │ District              │ ⚡ EV       │
├─────────────────────────────────────────┤
│ 1 │ Times Square          │ 45          │
│   │ Causeway Bay          │ ⚡ 12       │
├─────────────────────────────────────────┤
│ 2 │ Pacific Place         │ 32          │
│   │ Admiralty             │ ⚡ 8        │
└─────────────────────────────────────────┘
```

#### Props Interface

```typescript
interface TrendingCarparksProps {
  onCarparkClick: (carpark: CarparkData) => void;
  getMarkerColor: (vacancy: number) => string;
}
```

---

### 4. AddressSearch Component

**File**: `components/address-search.tsx`

**Purpose**: Google Places autocomplete search for finding locations and nearby carparks.

#### Features

- Google Places Autocomplete API
- Hong Kong location filtering
- Custom styled dropdown (dark mode support)
- Clear button functionality
- iOS scroll restoration

---

### 5. NearbyCarparksList Component

**File**: `components/nearby-carparks-list.tsx`

**Purpose**: Displays carparks near a searched location, sorted by distance.

#### Features

- Distance-based sorting
- Loading states
- Click to view station details
- Compact list design

---

## Navigation System

### View States

The bottom sheet navigation uses three distinct view states:

```typescript
type BottomSheetView = 'home' | 'nearby' | 'station';
```

#### 1. Home View (`'home'`)

**Purpose**: Default landing view with search and trending carparks

**Components**:
- AddressSearch
- TrendingCarparks

**User Actions**:
- Search for location → Navigate to Nearby View
- Click trending carpark → Navigate to Station View
- Click map marker → Navigate to Station View

#### 2. Nearby View (`'nearby'`)

**Purpose**: Shows carparks near searched location

**Components**:
- AddressSearch
- NearbyCarparksList

**User Actions**:
- Click carpark → Navigate to Station View
- Clear search → Navigate to Home View
- Back button → Navigate to Home View

#### 3. Station View (`'station'`)

**Purpose**: Shows detailed information about selected carpark

**Components**:
- StationStatus

**User Actions**:
- Back button → Navigate to previous view (Nearby or Home)

### Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          Home View                          │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │ Address Search  │  │      Trending Carparks           │ │
│  └─────────────────┘  │  1. Times Square                  │ │
│                       │  2. Pacific Place                 │ │
│                       │  3. Telford Plaza                 │ │
│                       └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          │ Search                             │ Click Trending
          ↓                                    ↓
┌──────────────────────┐            ┌──────────────────────┐
│   Nearby View        │            │   Station View       │
│ ┌──────────────────┐ │            │ ┌──────────────────┐ │
│ │ Address Search   │ │            │ │ Carpark Name     │ │
│ └──────────────────┘ │            │ │ Address          │ │
│ ┌──────────────────┐ │            │ │ District         │ │
│ │ Nearby Carparks  │ │            │ ├──────────────────┤ │
│ │ • Carpark A      │ │────Click──→│ │ Vacancy: 45      │ │
│ │ • Carpark B      │ │            │ │ EV: 12           │ │
│ │ • Carpark C      │ │            │ │ Accessible: 3    │ │
│ └──────────────────┘ │            │ └──────────────────┘ │
└──────────────────────┘            └──────────────────────┘
          │                                    │
          │ Back                               │ Back
          ↓                                    ↓
        Home                              Nearby or Home
```

---

## Map Interactions

### Carpark Markers

**Default State**:
- 40px circular marker
- Color-coded by vacancy level
- Glassmorphic outer ring
- Parking icon in center

**Selected State (Breathing Animation)**:
- 50px enlarged marker
- Pulsing/breathing animation (2s cycle)
- Three-layer animation:
  - Outer ring: scales 1.0 → 1.3
  - Middle ring: scales 1.0 → 1.15
  - Inner circle: scales 1.0 → 1.15
- Higher z-index (99999)
- Enhanced glow effects

### Marker Click Behavior

```typescript
onClick={() => {
  setSelectedCarpark(carpark);
  onCarparkMarkerClick(carpark);
}}
```

**Actions Triggered**:
1. Update selected carpark state
2. Set bottom sheet view to 'station'
3. Open bottom sheet
4. Pan map to carpark location
5. Zoom map to level 17
6. Show breathing animation on marker

---

## API Endpoints

### Trending Carparks API

**Endpoint**: `/api/carparks/trending`

**Method**: `GET`

**Purpose**: Returns top 10 most active carparks based on vacancy changes in the past 6 hours.

#### Activity Scoring Algorithm

```typescript
activityScore = (changes × 10) + (variance / 2) + (dataPoints × 0.5)
```

**Factors**:
- **Changes**: Number of vacancy changes (weighted heavily)
- **Variance**: Total variance in vacancy numbers
- **Data Points**: Number of data samples (indicates update frequency)

#### Response Format

```json
[
  {
    "park_id": "string",
    "name": "string",
    "display_address": "string",
    "latitude": number,
    "longitude": number,
    "district": "string",
    "opening_status": "OPEN" | "CLOSED",
    "vehicle_type": "privateCar",
    "vacancy": number,
    "vacancy_dis": number | null,
    "vacancy_ev": number | null,
    "lastupdate": "ISO timestamp",
    "is_stale": boolean,
    "activity_score": number
  }
]
```

#### Implementation Details

**File**: `app/api/carparks/trending/route.ts`

**Data Source**:
- `parking_vacancy_snapshots` table (historical data)
- `latest_vacancy_with_location` view (current data)

**Filters**:
- Only OPEN carparks
- Only carparks with vacancy > 0
- Only private car parking
- Only carparks with 2+ data points in past 6 hours

---

## State Management

### Core State Variables

```typescript
// Simple Map Component
const [bottomSheetView, setBottomSheetView] = useState<BottomSheetView>('home');
const [selectedCarpark, setSelectedCarpark] = useState<CarparkData | null>(null);
const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
const [nearbyCarparks, setNearbyCarparks] = useState<CarparkWithDistance[]>([]);
const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
```

### State Transitions

#### Selecting a Carpark

```typescript
const handleTrendingCarparkClick = (carpark: CarparkData) => {
  setSelectedCarpark(carpark);          // Set selected carpark
  setBottomSheetView('station');        // Navigate to station view
  setIsBottomSheetOpen(true);           // Open bottom sheet
  // Map auto-pans to carpark (via useEffect)
};
```

#### Searching for Location

```typescript
const handlePlaceSelected = async (place: PlaceResult) => {
  setSearchLocation({ lat, lng, address });  // Set search location
  setBottomSheetView('nearby');              // Navigate to nearby view
  setIsBottomSheetOpen(true);                // Open bottom sheet
  // Fetch nearby carparks
  const data = await fetch(`/api/carparks/nearby?lat=${lat}&lng=${lng}`);
  setNearbyCarparks(data);
};
```

#### Back Navigation

```typescript
const handleBottomSheetBack = () => {
  if (bottomSheetView === 'station') {
    // Go back to previous list view
    setBottomSheetView(nearbyCarparks.length > 0 ? 'nearby' : 'home');
    setSelectedCarpark(null);
  } else if (bottomSheetView === 'nearby') {
    // Go back to home
    setBottomSheetView('home');
    setSearchLocation(null);
    setNearbyCarparks([]);
  }
};
```

---

## Animations

### Bottom Sheet Animations

**Height Transitions**:
```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
```

**Drag Behavior**:
- Real-time tracking during drag
- Snap to nearest state on release
- 50px threshold for state change

### Breathing Marker Animation

**Keyframes**:

```css
@keyframes breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.9;
  }
}

@keyframes breatheRing {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.3;
  }
}
```

**Duration**: 2 seconds per cycle
**Timing**: ease-in-out
**Infinite Loop**: Continuous animation

---

## Map Integration

### Auto-Pan and Zoom

**Trigger**: When `selectedCarpark` state changes

```typescript
useEffect(() => {
  if (selectedCarpark && map) {
    map.panTo({
      lat: selectedCarpark.latitude,
      lng: selectedCarpark.longitude
    });
    map.setZoom(17);
  }
}, [selectedCarpark, map]);
```

**Zoom Levels**:
- **User Location**: 15
- **Search Location**: 15
- **Selected Carpark**: 17

**Why Level 17?**
- Optimal detail level for carpark visibility
- Triggers 3D building rendering (min zoom: 16)
- Provides street-level context

---

## User Experience Flow

### Scenario 1: Searching for Nearby Carparks

1. User opens app → Bottom sheet shows Home View (minimized)
2. User clicks search input → Bottom sheet expands
3. User types address → Autocomplete suggestions appear
4. User selects location → Map pans, bottom sheet shows Nearby View
5. User clicks carpark → Map zooms to carpark, Station View shown
6. User clicks back → Returns to Nearby View
7. User clicks back → Returns to Home View

### Scenario 2: Browsing Trending Carparks

1. User opens app → Bottom sheet shows Home View with trending list
2. User scrolls trending carparks → Sees top 10 most active
3. User clicks trending carpark → Map pans/zooms, Station View shown
4. User reviews details → Sees vacancy, chart, EV spaces
5. User clicks back → Returns to Home View

### Scenario 3: Clicking Map Markers

1. User browses map → Sees colored carpark markers
2. User clicks marker → Map zooms, marker breathes, Station View shown
3. User reviews details → Sees full carpark information
4. User clicks back → Returns to Home View, map stays at same position

---

## Design Decisions

### Why Remove InfoWindow?

**Problems with InfoWindow**:
- ❌ Clutters the map
- ❌ Blocks underlying markers
- ❌ Limited space for content
- ❌ Poor mobile experience
- ❌ Requires dismissing to interact with map

**Benefits of Bottom Sheet + Breathing Marker**:
- ✅ Clean, unobstructed map view
- ✅ More space for detailed information
- ✅ Better mobile UX (familiar pattern)
- ✅ Elegant visual feedback (breathing animation)
- ✅ Persistent view while browsing

### Why Compact Trending Design?

**Design Goals**:
- Show maximum carparks in minimum space
- Quick scanning of options
- Clear hierarchy (rank → name → vacancy)
- Minimal visual noise

**Removed Elements**:
- Status badges (assumed all open)
- Location pin emoji (redundant with district text)
- "Available" label (obvious from context)
- Purple rank badges (too prominent)

---

## Performance Considerations

### Lazy Loading

- Bottom sheet views render conditionally
- Components unmount when not in view
- API calls only triggered when needed

### Debouncing

- Search input: 300ms debounce
- Map viewport changes: 300ms debounce

### Memoization Opportunities

Future optimization opportunities:
- Memoize carpark marker components
- Cache trending carparks data (5 min TTL)
- Virtualize long lists (if >100 items)

---

## Accessibility

### Keyboard Navigation

- Bottom sheet drag handle is focusable
- Back button accessible via keyboard
- Search input supports standard keyboard interaction

### Touch Targets

- Minimum 44px touch targets
- Adequate spacing between interactive elements
- Large, clear hit areas on carpark list items

### Screen Reader Support

- Semantic HTML structure
- ARIA labels on interactive elements
- Descriptive text for status changes

---

## Future Enhancements

### Planned Features

1. **Favorites System**
   - Save frequently used carparks
   - Quick access from Home View
   - Sync across devices

2. **Filters**
   - Filter by EV charging availability
   - Filter by accessible parking
   - Filter by price range

3. **Route Navigation**
   - Directions to selected carpark
   - ETA calculation
   - Multiple route options

4. **Notifications**
   - Alert when carpark reaches target vacancy
   - Remind when parking time expiring
   - Update on status changes

5. **Analytics Dashboard**
   - Personal usage statistics
   - Popular times visualization
   - Cost tracking

---

## Testing Checklist

### Functional Testing

- [ ] Bottom sheet height states work correctly
- [ ] Click-to-expand functionality works
- [ ] Back button navigation flows correctly
- [ ] Trending carparks load and display
- [ ] Search returns relevant results
- [ ] Map pans and zooms on selection
- [ ] Breathing animation plays smoothly
- [ ] Dark mode theme switches correctly

### Edge Cases

- [ ] No trending carparks available
- [ ] No nearby carparks found
- [ ] Network errors handled gracefully
- [ ] Long carpark names truncate properly
- [ ] Multiple rapid selections don't break state

### Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Safari (iOS)
- [ ] Safari (macOS)
- [ ] Firefox (latest)
- [ ] Edge (latest)

### Device Testing

- [ ] iPhone (various sizes)
- [ ] iPad
- [ ] Android phones
- [ ] Android tablets
- [ ] Desktop (various resolutions)

---

## Troubleshooting

### Bottom Sheet Not Expanding

**Issue**: Clicking content doesn't expand sheet

**Solution**: Check that `onClick={expandSheet}` is set on content div

### Breathing Animation Not Showing

**Issue**: Selected marker shows but doesn't animate

**Solution**: Verify CSS keyframes are included in `<style>` tag

### Trending Carparks Empty

**Issue**: No carparks shown in trending list

**Solution**:
1. Check API endpoint `/api/carparks/trending` returns data
2. Verify database has recent vacancy snapshots
3. Ensure filter criteria not too strict

### Map Not Panning to Selection

**Issue**: Map doesn't pan when carpark selected

**Solution**:
1. Check `useEffect` for `selectedCarpark` is firing
2. Verify `map` object is defined
3. Check console for errors

---

## Related Documentation

- [3D Buildings Implementation](./3d_buildings_implementation.md)
- [Data Pipeline](./data-pipeline.md)
- [Parking Map Overview](./parking-map.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | November 2025 | Initial implementation |

---

**Last Updated**: November 2025
**Author**: Claude Code
**Status**: Production Ready
