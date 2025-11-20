# Noah Car Rental API Integration

## Overview

This document describes the integration of the Noah Car Rental API into the MTC Stations application, specifically for displaying available dispatch vehicles at dispatch carpark locations.

## Architecture

### Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MTC Stations App                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Dispatch Carpark Details (Bottom Sheet)               │ │
│  │                                                          │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Available Dispatch Cars Component               │  │ │
│  │  │  - Fetches from /api/noah/vehicles               │  │ │
│  │  │  - Displays vehicle grid (2 columns)             │  │ │
│  │  │  - Shows images, specs, availability             │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ fetch
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Proxy (Server-Side)                 │
│                                                               │
│  /app/api/noah/vehicles/route.ts                            │
│  - Acts as CORS proxy                                        │
│  - Fetches from external Noah API                           │
│  - Returns data to client                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ fetch
┌─────────────────────────────────────────────────────────────┐
│              Noah Car Rental API (External)                  │
│                                                               │
│  https://noah.air.city/api/vehicles/status                  │
│  - Returns fleet status and availability                     │
│  - Includes vehicle photos (Supabase Storage)               │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
mtc-stations/
├── app/
│   └── api/
│       └── noah/
│           └── vehicles/
│               └── route.ts              # API proxy endpoint
├── components/
│   ├── available-dispatch-cars.tsx       # Main vehicle display component
│   └── dispatch-carpark-details.tsx      # Parent component (bottom sheet)
└── docs/
    └── noah-car-rental-api-integration.md # This file
```

---

## Component Details

### 1. Available Dispatch Cars Component

**File:** `/components/available-dispatch-cars.tsx`

**Purpose:** Fetches and displays available vehicles from Noah's fleet in a clean, minimal design.

**Key Features:**
- Fetches data from local API proxy (`/api/noah/vehicles`)
- Filters vehicles with `currentStatus === 'available'`
- Displays up to 6 vehicles in a 2-column grid
- Shows vehicle images with fallback to car icon
- Displays fuel type badges (e.g., "Electric" in green)
- Responsive hover effects on vehicle cards
- Loading and error states

**Data Flow:**
```typescript
useEffect(() => {
  fetchVehicles() → /api/noah/vehicles?timePeriod=30d
    → Filter available vehicles
    → Limit to 6 vehicles
    → Display in grid
}, []);
```

**Vehicle Card Display:**
- Vehicle image (80px height, responsive width)
- Fuel type badge (top-right corner)
- Make and Model name
- Year and plate number
- Specs: seats, transmission

**UI States:**
1. **Loading:** Shows "Loading available vehicles..."
2. **Success:** Displays vehicle grid with images and specs
3. **Error/Empty:** Shows fallback message "Contact Noah for vehicle availability"

---

### 2. API Proxy Endpoint

**File:** `/app/api/noah/vehicles/route.ts`

**Purpose:** Server-side proxy to avoid CORS issues when calling external Noah API.

**Why Proxy?**
- Noah API at `https://noah.air.city` doesn't allow CORS from `localhost:3000`
- Browser blocks direct fetch requests from client
- Next.js API routes run server-side and bypass CORS restrictions

**Implementation:**
```typescript
export async function GET(request: Request) {
  // Extract query parameters
  const { searchParams } = new URL(request.url);
  const timePeriod = searchParams.get('timePeriod') || '30d';

  // Fetch from external API (server-side)
  const response = await fetch(
    `https://noah.air.city/api/vehicles/status?timePeriod=${timePeriod}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store', // Fresh data on each request
    }
  );

  // Return data to client
  return NextResponse.json(data);
}
```

**Request Flow:**
```
Client (Browser)
  ↓ fetch('/api/noah/vehicles?timePeriod=30d')
Next.js API Route (Server)
  ↓ fetch('https://noah.air.city/api/vehicles/status')
Noah API (External)
  ↓ returns JSON
Next.js API Route
  ↓ returns JSON
Client receives data
```

---

### 3. Dispatch Carpark Details Component

**File:** `/components/dispatch-carpark-details.tsx`

**Updated Section:**
```tsx
{/* Available Dispatch Cars */}
<div style={{ marginBottom: '16px' }}>
  <AvailableDispatchCars />
</div>
```

**Previous Implementation:**
- Static "Noah Dispatch Available" message
- No vehicle information
- No real-time availability

**New Implementation:**
- Dynamic vehicle list from API
- Real-time availability status
- Vehicle images and specifications
- Fuel type indicators

---

## Noah API Integration

### Endpoint Used

**URL:** `https://noah.air.city/api/vehicles/status`

**Method:** `GET`

**Query Parameters:**
- `timePeriod` (optional): `7d`, `30d`, `90d`, `1y`, `all` (default: `30d`)

**Response Structure:**
```json
{
  "vehicles": [
    {
      "id": "uuid",
      "plate": "NY6662",
      "make": "HYUNDAI",
      "model": "KONA ELECTRIC",
      "year": 2020,
      "type": "SUV",
      "fuelType": "Electric",
      "transmission": "Automatic",
      "seats": 5,
      "maintenanceStatus": "operational",
      "currentStatus": "available",
      "photoPath": "path/to/photo.png",
      "imageUrl": "https://supabase-storage-url...",
      "activeBooking": null
    }
  ]
}
```

### Vehicle Status Values

| Status | Meaning | Displayed in Component |
|--------|---------|----------------------|
| `available` | Ready to rent | ✅ Yes |
| `reserved` | Future booking | ❌ No |
| `rented` | Currently rented out | ❌ No |
| `maintenance` | Under service/repair | ❌ No |

### Filtering Logic

```typescript
const availableVehicles = data.vehicles
  ?.filter((v: any) => v.currentStatus === 'available')
  .slice(0, 6)
  .map((v: any) => ({
    make: v.make,
    model: v.model,
    year: v.year,
    type: v.type || 'Vehicle',
    fuelType: v.fuelType || 'N/A',
    transmission: v.transmission || 'Automatic',
    seats: v.seats || 5,
    plate: v.plate,
    imageUrl: v.imageUrl
  }));
```

---

## Design Specifications

### Visual Design

**Theme Colors:**
- Primary Green: `#065f46`
- Secondary Green: `#047857`
- Light Green Background: `#d1fae540` (light mode)
- Dark Green Background: `#065f4620` (dark mode)

**Layout:**
- 2-column grid for vehicles
- 12px gap between cards
- Card padding: 12px
- Rounded corners: 10px
- Border: 1px solid (theme-dependent)

**Vehicle Card Dimensions:**
- Image container: 100% width × 80px height
- Card hover effect: translateY(-2px) + box shadow
- Fuel badge: 9px font, positioned absolute (top-right)

**Typography:**
- Vehicle name: 13px, weight 600
- Plate/Year: 11px
- Specs badges: 10px
- Header: 14px, weight 600

**Responsive Behavior:**
- Grid maintains 2 columns on all screen sizes
- Cards scale proportionally
- Images maintain aspect ratio with `object-fit: cover`

---

## Error Handling

### Network Errors

**Scenario:** API is unreachable or returns error

**Component Behavior:**
```tsx
if (error || vehicles.length === 0) {
  return (
    <div>
      <Car icon />
      <div>Noah Dispatch Available</div>
      <div>Contact Noah for vehicle availability</div>
    </div>
  );
}
```

### CORS Errors

**Problem:** Direct fetch from browser to `noah.air.city` blocked

**Solution:** Proxy through Next.js API route
```
❌ Browser → noah.air.city (CORS blocked)
✅ Browser → localhost:3000/api/noah/vehicles → noah.air.city
```

### Missing Data

**Fallback Values:**
- No image: Display `<Car />` icon
- No fuel type: Show "N/A"
- No transmission: Default to "Automatic"
- No seats: Default to 5

---

## Performance Considerations

### Caching Strategy

**API Route:**
```typescript
cache: 'no-store' // Always fetch fresh data
```

**Why no cache?**
- Vehicle availability changes frequently
- Bookings happen in real-time
- Users expect up-to-date information

**Future Optimization:**
- Implement short-term cache (e.g., 30 seconds)
- Use SWR (stale-while-revalidate) pattern
- Add WebSocket for real-time updates

### Image Loading

**Current Implementation:**
- Images loaded directly from Supabase signed URLs
- No optimization or lazy loading

**Recommended Improvements:**
```tsx
import Image from 'next/image';

<Image
  src={vehicle.imageUrl}
  alt={`${vehicle.make} ${vehicle.model}`}
  width={200}
  height={80}
  loading="lazy"
  placeholder="blur"
/>
```

---

## Testing

### Manual Testing Checklist

- [ ] Component loads without errors
- [ ] API proxy successfully fetches data
- [ ] Available vehicles display in grid
- [ ] Vehicle images render correctly
- [ ] Fuel type badges show correct colors
- [ ] Hover effects work on vehicle cards
- [ ] Loading state displays during fetch
- [ ] Error state displays on API failure
- [ ] Dark mode styles render correctly
- [ ] Component works in dispatch carpark bottom sheet

### API Testing

```bash
# Test local proxy endpoint
curl http://localhost:3000/api/noah/vehicles?timePeriod=30d

# Test external Noah API directly
curl https://noah.air.city/api/vehicles/status?timePeriod=30d
```

### Expected Results

**Successful Response:**
- HTTP 200
- JSON with `vehicles` array
- At least 1-2 vehicles with `currentStatus: "available"`

**Current Fleet Status (as of testing):**
- Total vehicles: 40+
- Available: 2 (NY6662 Hyundai Kona, YG4776 Mercedes GLA200)
- Reserved: 4
- Rented: 26
- Maintenance: Multiple

---

## Deployment

### Environment Variables

No environment variables required for this integration.

### Production Considerations

1. **API Endpoint:**
   - Production: `https://noah.air.city/api/vehicles/status`
   - Already configured in proxy route

2. **CORS Configuration:**
   - Proxy handles CORS
   - No additional configuration needed

3. **Error Monitoring:**
   - Add error logging to API route
   - Monitor failed requests to Noah API

4. **Rate Limiting:**
   - Consider caching responses
   - Implement request throttling if needed

---

## Future Enhancements

### Phase 1: Enhanced Features
- [ ] Add vehicle filtering (fuel type, seats, etc.)
- [ ] Implement "View All" button to see full fleet
- [ ] Add vehicle availability calendar
- [ ] Show pricing information

### Phase 2: Booking Integration
- [ ] Direct booking from map interface
- [ ] Integration with Noah's booking system
- [ ] Real-time availability updates via WebSocket
- [ ] Push notifications for vehicle availability

### Phase 3: Advanced Features
- [ ] Vehicle comparison tool
- [ ] User reviews and ratings
- [ ] Route planning with vehicle selection
- [ ] Integration with payment gateway

---

## Troubleshooting

### Issue: No vehicles displayed

**Possible Causes:**
1. All vehicles are currently unavailable
2. API is down
3. Network error

**Debug Steps:**
```bash
# Check API directly
curl https://noah.air.city/api/vehicles/status?timePeriod=30d

# Check browser console for errors
# Open DevTools → Console tab

# Check network requests
# Open DevTools → Network tab → Filter by "noah"
```

### Issue: CORS errors

**Solution:** Ensure using proxy endpoint
```typescript
// ✅ Correct
fetch('/api/noah/vehicles?timePeriod=30d')

// ❌ Wrong (will cause CORS)
fetch('https://noah.air.city/api/vehicles/status')
```

### Issue: Images not loading

**Possible Causes:**
1. Supabase signed URLs expired (1-hour expiry)
2. Network connectivity issues
3. Image URLs are null/undefined

**Solution:**
- Component already handles missing images with fallback icon
- Refresh page to get new signed URLs

---

## API Documentation Reference

Full Noah Car Rental API documentation available at:
`/noah-car-rental-api/noah-car-rental-api.md`

**Key Endpoints:**
- `GET /api/vehicles` - All vehicles with status
- `GET /api/vehicles/status` - Fleet status overview ✅ **Used**
- `POST /api/vehicles/availability` - Check date availability
- `POST /api/vehicles/popular` - Popular vehicles
- `POST /api/vehicles/search` - Search by plate

---

## Changelog

### v1.0.0 - Initial Integration (2025-11-20)

**Added:**
- `AvailableDispatchCars` component
- `/api/noah/vehicles` proxy endpoint
- Integration with dispatch carpark details
- Vehicle grid display with images and specs
- Dark mode support
- Loading and error states

**Modified:**
- `dispatch-carpark-details.tsx` - Replaced static message with dynamic vehicle list

**Technical Details:**
- Framework: Next.js 14.2.33
- API: Noah Car Rental API (noah.air.city)
- Storage: Supabase Storage for vehicle images

---

## Contributors

- Implementation: Claude Code
- API Provider: Noah Car Rental (noah.air.city)
- Integration: MTC Stations Project

---

## Support

For issues related to:
- **Component display:** Check browser console and network tab
- **Noah API:** Contact Noah Car Rental API team
- **Integration bugs:** File issue in MTC Stations repository

---

*Last Updated: November 20, 2025*
