# Carpark Detail Page Implementation

## Overview

The carpark detail page (`/carpark/[id]`) provides a dedicated, shareable view for individual carpark information. This page was designed to work seamlessly on mobile browsers with a fixed viewport height and QR code sharing functionality.

## Architecture

### URL Structure
- **Route**: `/carpark/[id]`
- **Dynamic Parameter**: `id` - The unique `park_id` of the carpark
- **Example**: `/carpark/ABC123`

### File Structure
```
app/
├── api/
│   └── carpark/
│       └── [id]/
│           └── route.ts          # API endpoint for fetching single carpark data
└── carpark/
    └── [id]/
        └── page.tsx               # Carpark detail page component

components/
└── carpark-modal.tsx              # Modal component with QR code integration
```

## API Implementation

### Endpoint: `/api/carpark/[id]`

**Method**: GET

**Query Parameters**:
- `days` (optional, default: 7) - Number of days of historical data to fetch

**Response Format**:
```json
{
  "success": true,
  "carpark": {
    "park_id": "string",
    "name": "string",
    "display_address": "string",
    "latitude": number,
    "longitude": number,
    "district": "string",
    "current_vacancy": number,
    "max_capacity": number,
    "size_category": "Small" | "Medium" | "Large" | "Very Large",
    "activity_score": number,
    "avg_variance": number,
    "avg_rate_change": number,
    "lastupdate": "ISO 8601 timestamp",
    "time_series": [
      {
        "hour": "ISO 8601 timestamp",
        "avg_vacancy": number,
        "min_vacancy": number,
        "max_vacancy": number,
        "vacancy_stddev": number,
        "rate_of_change": number
      }
    ]
  }
}
```

**Database Queries**:
1. **Capacity Calculation**: Determines max capacity by finding the maximum vacancy recorded
2. **Latest Data**: Fetches most recent vacancy snapshot with carpark metadata
3. **Time Series**: Aggregates hourly vacancy data for the specified time period

**Metrics Calculated**:
- **Activity Score**: Combined metric based on standard deviation and rate of change
- **Average Variance**: Standard deviation of vacancy across time periods
- **Average Rate of Change**: Average change in vacancy per hour

## Page Implementation

### Component: `/app/carpark/[id]/page.tsx`

**Key Features**:

1. **Fixed Viewport Layout**
   - Uses `position: fixed` to prevent any browser-level scrolling
   - Container is exactly `100vh` × `100vw`
   - Content scrolls internally within the modal

2. **Scroll Prevention**
   ```typescript
   useEffect(() => {
     document.body.style.overflow = 'hidden';
     document.documentElement.style.overflow = 'hidden';
     return () => {
       document.body.style.overflow = '';
       document.documentElement.style.overflow = '';
     };
   }, []);
   ```

3. **Responsive Layout**
   - Outer container: `position: fixed`, `overflow: hidden`
   - Inner container: `maxWidth: 1200px`, centered with flexbox
   - Modal content: `flex: 1` with internal scrolling

### UI Components

#### Header Section
- Carpark name and address
- Size category badge (Small/Medium/Large/Very Large)
- District badge

#### Stats Grid
Four key metrics displayed:
1. Current Vacancy
2. Utilization Rate (color-coded: green <70%, yellow 70-90%, red >90%)
3. Activity Score
4. Average Rate of Change

#### Vacancy Trend Chart
- Last 12 hours of vacancy data
- Area chart with gradient fill
- Hong Kong timezone (`Asia/Hong_Kong`)
- Min/Avg/Max statistics (rounded to whole numbers)

#### Interactive Map
- Google Maps integration
- Centered on carpark location
- Zoom level: 17
- Custom parking marker
- Height: 400px

#### Details Section
Two-column layout:
- Left: Carpark metadata (ID, coordinates, last update, data points)
- Right: QR code for sharing (in modal only)

## QR Code Integration

### Implementation in Modal

The carpark modal (`components/carpark-modal.tsx`) includes a QR code in the Details section that links to the dedicated page.

**Library**: `qrcode.react`

**Configuration**:
```typescript
<QRCodeSVG
  value={`${window.location.origin}/carpark/${carpark.park_id}`}
  size={100}
  level="M"
  bgColor={isDarkMode ? '#111827' : '#f9fafb'}
  fgColor={isDarkMode ? '#f3f4f6' : '#111827'}
/>
```

**Features**:
- Adapts colors based on dark/light theme
- Generates URL to `/carpark/[id]` page
- Size: 100×100px
- Error correction level: Medium

## Mobile Optimization

### Viewport Constraints

**Problem**: Content overflow on mobile browsers causing unwanted scrolling

**Solution**:
1. Fixed positioning on outer container
2. Explicit viewport dimensions (`100vh`, `100vw`)
3. `overflow: hidden` on both page and `documentElement`
4. Internal scrolling only within content area

### Modal Sizing

**Desktop**:
- Max width: 900px
- Height: `calc(100vh - 40px)` (20px padding top/bottom)

**Mobile**:
- Full width minus 40px padding
- Full height minus 40px padding
- Scrollable content area

## Dark Mode Support

All components support dark mode via the `useTheme` hook:

**Color Scheme**:
```typescript
const colors = {
  background: isDarkMode ? '#1f2937' : '#ffffff',
  text: isDarkMode ? '#f3f4f6' : '#111827',
  border: isDarkMode ? '#374151' : '#e5e7eb',
  muted: isDarkMode ? '#6b7280' : '#9ca3af',
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};
```

## Data Flow

```
User visits /carpark/ABC123
         ↓
Page component loads
         ↓
useEffect fetches from /api/carpark/ABC123
         ↓
API connects to PostgreSQL database
         ↓
Query executes:
  - Get latest carpark data
  - Calculate max capacity
  - Fetch time series (hourly aggregates)
  - Calculate metrics (activity score, variance, rate of change)
         ↓
API returns JSON response
         ↓
Page renders with data
```

## Error Handling

### Loading State
- Displays centered loading message
- Full viewport coverage
- Consistent with error state styling

### Error State
- Shows error message
- "Go Back" button (though removed from main view)
- Full viewport coverage

### 404 Not Found
API returns 404 if carpark doesn't exist or has no capacity data

## Performance Considerations

### Caching
API responses include cache headers:
```typescript
headers: {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
}
```
- Fresh for 5 minutes
- Stale content served while revalidating for 10 minutes

### Database Connection
- Connection pooling via Supabase pooler
- SSL enabled
- Connections properly closed in finally blocks

### Time Series Data
- Limited to 168 data points (7 days max)
- Hourly aggregation reduces data volume
- Client-side slicing to last 12 hours for chart display

## Timezone Handling

All timestamps use Hong Kong timezone (`Asia/Hong_Kong`):

```typescript
toLocaleTimeString('en-US', {
  hour: 'numeric',
  hour12: true,
  timeZone: 'Asia/Hong_Kong',
})
```

**Formatted Examples**:
- Chart x-axis: "3 PM", "4 PM", etc.
- Tooltip: "03:30 PM"
- Last updated: "Jan 15, 03:30 PM"

## Usage Examples

### Direct Navigation
```
https://yourdomain.com/carpark/CP001
```

### QR Code Scanning
Users can scan the QR code from the admin panel modal to navigate to the dedicated page

### Sharing
The URL is shareable and bookmarkable for quick access to specific carpark details

## Future Enhancements

Potential improvements:
1. **Real-time Updates**: WebSocket connection for live vacancy updates
2. **Historical Analysis**: Date range selector for custom time periods
3. **Comparison Mode**: Compare multiple carparks side-by-side
4. **Directions**: Integration with navigation apps
5. **Alerts**: Set up notifications for vacancy thresholds
6. **Favorites**: Save frequently viewed carparks
7. **Analytics**: User engagement tracking and heatmaps

## Related Documentation

- [Metered Parking Implementation](./metered-parking-implementation.md)
- [Bottom Sheet Navigation Architecture](./bottom-sheet-navigation-architecture.md)

## Dependencies

- **Next.js**: App router, dynamic routes
- **React**: Hooks (useState, useEffect, useRef)
- **Recharts**: Data visualization (AreaChart)
- **@vis.gl/react-google-maps**: Map integration
- **qrcode.react**: QR code generation
- **pg**: PostgreSQL client

## Environment Variables Required

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
POSTGRES_PASSWORD=your_postgres_password
```
