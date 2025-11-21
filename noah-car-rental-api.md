# Noah Car Rental API Documentation

## Overview
This document describes the public API endpoints for querying available vehicles in the Noah Car Rental system. The API provides vehicle availability information, specifications, and images.

## Production Environment
- **Domain:** https://noah.air.city
- **Hosting:** Vercel
- **Framework:** Next.js App Router (React Server Components)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (vehicle photos)

## Base URL
```
Production: https://noah.air.city/api
```

The API is built on Next.js App Router and uses server actions and PostgreSQL RPC functions for optimal performance.

## Authentication
Currently uses Supabase service client for server-side operations. Public endpoints should be created for customer-facing queries with appropriate rate limiting.

---

## Available Endpoints

### 1. Check Vehicle Availability

**Endpoint:** `POST /api/vehicles/availability`

**Description:** Returns all vehicles and their availability status for a specific date range.

**Request Body:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20"
}
```

**Response:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20",
  "periodDays": 6,
  "totalVehicles": 45,
  "availableCount": 32,
  "unavailableCount": 13,
  "availableVehicles": [
    {
      "id": "uuid",
      "plate": "YU1115",
      "make": "Honda",
      "model": "Jazz",
      "year": 2020,
      "type": "Compact",
      "fuelType": "Petrol",
      "transmission": "Automatic",
      "seats": 5,
      "status": "available",
      "availabilityStatus": "available",
      "imageUrl": "/cars/jazz-2015-purple.png",
      "specs": {
        "engineCc": 1500,
        "color": "Purple"
      }
    }
  ],
  "unavailableVehicles": [
    {
      "id": "uuid",
      "plate": "ZU7767",
      "make": "Honda",
      "model": "Jazz",
      "year": 2019,
      "type": "Compact",
      "fuelType": "Petrol",
      "transmission": "Automatic",
      "seats": 5,
      "status": "rented",
      "availabilityStatus": "unavailable",
      "imageUrl": "/cars/jazz-2017-black.png",
      "conflictingBooking": {
        "bookingId": "uuid",
        "bookingNumber": "BK-20241210-001",
        "pickupDate": "2024-12-10",
        "dropoffDate": "2024-12-22",
        "status": "on-going",
        "customerName": "John Doe"
      }
    }
  ]
}
```

**Database Function:** `check_vehicle_availability(p_pickup_date, p_dropoff_date)`
- Located in: `sql/get_vehicle_availability.sql`
- Validates date ranges
- Checks for booking conflicts
- Returns available and unavailable vehicles with details

---

### 2. Get Popular Vehicles with Availability

**Endpoint:** `POST /api/vehicles/popular`

**Description:** Returns vehicles that have had recent bookings (last 90 days) with their current availability status.

**Request Body:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20"
}
```

**Response:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20",
  "periodDays": 6,
  "totalCount": 28,
  "availableCount": 18,
  "unavailableCount": 10,
  "vehicles": [
    {
      "id": "uuid",
      "plate": "YV4136",
      "make": "MG",
      "model": "MG4",
      "year": 2022,
      "type": "Electric",
      "fuelType": "Electric",
      "transmission": "Automatic",
      "seats": 5,
      "color": "Black",
      "engineCc": null,
      "status": "available",
      "isAvailable": true,
      "conflictingBooking": null,
      "recentBookingCount": 12,
      "imageUrl": "/cars/mg4-2022-black.png"
    }
  ]
}
```

**Database Function:** `get_vehicles_with_recent_bookings_and_availability(p_pickup_date, p_dropoff_date)`
- Located in: `sql/get_vehicles_with_recent_bookings_and_availability.sql`
- Filters vehicles with bookings in last 90 days
- Sorts by availability and popularity (booking count)
- Excludes vehicles in maintenance

---

### 3. Search Vehicles by Plate

**Endpoint:** `POST /api/vehicles/search`

**Description:** Search for specific vehicles by plate number with availability check.

**Request Body:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20",
  "searchQuery": "YV"
}
```

**Response:**
```json
{
  "pickupDate": "2024-12-15",
  "dropoffDate": "2024-12-20",
  "vehicles": [
    {
      "id": "uuid",
      "plate": "YV4136",
      "make": "MG",
      "model": "MG4",
      "year": 2022,
      "isAvailable": true,
      "imageUrl": "/cars/mg4-2022-black.png"
    }
  ]
}
```

**Database Function:** `search_vehicles_by_plate(p_pickup_date, p_dropoff_date, p_search_query)`
- Located in: `sql/search_vehicles_by_plate.sql`
- Case-insensitive partial matching on plate numbers

---

### 4. Get Vehicle Status Overview

**Endpoint:** `GET /api/vehicles/status`

**Description:** Get current status of all vehicles in the fleet.

**Query Parameters:**
- `timePeriod` (optional): `7d`, `30d`, `90d`, `1y`, `all` (default: `30d`)

**Response:**
```json
{
  "timePeriod": "30d",
  "summary": {
    "total": 45,
    "available": 32,
    "reserved": 5,
    "rented": 6,
    "maintenance": 2
  },
  "vehicles": [
    {
      "id": "uuid",
      "plate": "YV4136",
      "make": "MG",
      "model": "MG4",
      "year": 2022,
      "type": "Electric",
      "fuelType": "Electric",
      "transmission": "Automatic",
      "seats": 5,
      "maintenanceStatus": "Operational",
      "currentStatus": "available",
      "imageUrl": "https://supabase-signed-url.../vehicle-photo.jpg",
      "activeBooking": null
    }
  ]
}
```

**Server Action:** `getVehicleStatusOverview(timePeriod)`
- Located in: `lib/actions/vehicles.ts:626`
- Uses RPC function: `get_vehicle_status_with_photos`
- Generates signed URLs for vehicle photos

---

### 5. Get All Vehicles with Current Status

**Endpoint:** `GET /api/vehicles`

**Description:** Get complete list of all vehicles with their current booking status and details.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 45,
      "available": 32,
      "reserved": 5,
      "rented": 6,
      "maintenance": 2
    },
    "vehicles": [
      {
        "id": "uuid",
        "plate": "YV4136",
        "make": "MG",
        "model": "MG4",
        "year": 2022,
        "status": "available",
        "type": "Electric",
        "fuelType": "Electric",
        "transmission": "Automatic",
        "seats": 5,
        "maintenanceStatus": "Operational",
        "currentStatus": "available",
        "imageUrl": "https://...",
        "activeBooking": null,
        "color": "Black",
        "chassis_number": "ABC123...",
        "category": "Electric",
        "engine_cc": null,
        "fuel_type": "Electric",
        "insurance_start_date": "2024-01-01",
        "insurance_end_date": "2024-12-31",
        "insurance_provider": "AIA"
      }
    ]
  }
}
```

**Server Action:** `getAllVehiclesWithStatus()`
- Located in: `lib/actions/vehicles.ts:480`
- Combines vehicle data with active bookings
- Generates signed URLs for vehicle photos from storage
- Calculates current status based on booking dates

---

## Vehicle Specifications

### Vehicle Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique vehicle identifier |
| `plate` | string | License plate number (unique) |
| `make` | string | Vehicle manufacturer (e.g., "Honda", "Toyota") |
| `model` | string | Vehicle model (e.g., "Jazz", "Alphard") |
| `year` | number | Manufacturing year |
| `name` | string | Display name (usually same as model) |
| `status` | string | Asset status: "available", "maintenance", "rented" |
| `seats` | number | Number of passenger seats |
| `engine_cc` | number | Engine displacement in CC |
| `transmission` | string | "Automatic" or "Manual" |
| `fuel_type` | string | "Petrol", "Electric", "Hybrid" |
| `category` | string | Vehicle category: "Compact", "MPV", "SUV", "Electric" |
| `color` | string | Vehicle color |
| `chassis_number` | string | VIN/Chassis number (unique) |

### Extended Fields (Admin)

| Field | Type | Description |
|-------|------|-------------|
| `purchase_date` | date | Date of vehicle purchase |
| `purchase_price` | number | Purchase price |
| `previous_owners` | number | Number of previous owners |
| `insurance_start_date` | date | Insurance coverage start |
| `insurance_end_date` | date | Insurance coverage end |
| `insurance_provider` | string | Insurance company |
| `insurance_policy_number` | string | Policy number |
| `road_license_start_date` | date | Road license validity start |
| `road_license_expiry_date` | date | Road license expiry |
| `road_license_period` | string | License period (e.g., "12 months") |
| `road_license_fee` | number | License fee amount |

---

## Vehicle Images

### Image Mapping System

Vehicle images are stored in `/public/cars/` and mapped using the `getVehicleImage()` utility function.

**Location:** `lib/utils/vehicle-images.ts`

### Default Images Available

| Make/Model | Image Path |
|------------|------------|
| Honda Jazz | `/cars/jazz.PNG` (various colors available) |
| Toyota Alphard | `/cars/alphard.PNG` |
| Toyota Noah | `/cars/noah.PNG` |
| Toyota Wish | `/cars/noah.PNG` (fallback) |
| Toyota Ractis | `/cars/jazz.PNG` (fallback) |
| Toyota Prius | `/cars/jazz.PNG` (fallback) |
| Mercedes-Benz GLA | `/cars/gla.PNG` |
| Mercedes-Benz GLC | `/cars/glc.PNG` |
| MG4 | `/cars/mg4.PNG` |
| Mini Countryman | `/cars/mini.PNG` |
| BMW Z4 | `/cars/gla.PNG` (fallback) |

### Specific Vehicle Photos

Some vehicles have year and color-specific images:
- `/cars/jazz-2017-black.png`
- `/cars/jazz-2015-purple.png`
- `/cars/mg4-2022-black.png`
- `/cars/noah-2012-white.png`
- `/cars/alphard-2017-black.png`
- And more...

### Uploaded Vehicle Photos

Custom vehicle photos are stored in Supabase Storage bucket `vehicle-documents`:
- Document type: `vehicle_photo`
- Accessed via signed URLs (1 hour expiry)
- Managed through `vehicle_documents` table

**Example Query:**
```sql
SELECT vehicle_id, file_path
FROM vehicle_documents
WHERE document_type = 'vehicle_photo'
```

---

## Status Definitions

### Availability Status
- `available`: Vehicle has no conflicting bookings
- `unavailable`: Vehicle has an active or overlapping booking
- `maintenance`: Vehicle is under service/repair

### Booking Status
- `available`: No active bookings
- `reserved`: Future booking confirmed
- `rented`: Currently on an active rental
- `maintenance`: In maintenance/service

### Asset Status (Compliance)
- `operational`: Vehicle is roadworthy
- `maintenance`: In maintenance or service

---

## Implementation Notes

### Current Implementation
1. Vehicle availability logic uses PostgreSQL RPC functions for efficiency
2. Admin panel uses `getAllVehiclesWithStatus()` server action
3. Booking system uses `checkVehicleAvailability()` for date-based queries
4. Image system prioritizes uploaded photos over default images

### Recommended Public API Endpoints

Create these Next.js API routes:

```typescript
// app/api/vehicles/availability/route.ts
export async function POST(request: Request) {
  const { pickupDate, dropoffDate } = await request.json()
  const result = await checkVehicleAvailability(pickupDate, dropoffDate)
  return Response.json(result)
}

// app/api/vehicles/popular/route.ts
export async function POST(request: Request) {
  const { pickupDate, dropoffDate } = await request.json()
  const result = await getVehiclesWithRecentBookingsAndAvailability(pickupDate, dropoffDate)
  return Response.json(result)
}

// app/api/vehicles/route.ts
export async function GET() {
  const result = await getAllVehiclesWithStatus()
  return Response.json(result)
}

// app/api/vehicles/status/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url)
  const timePeriod = url.searchParams.get('timePeriod') || '30d'
  const result = await getVehicleStatusOverview(timePeriod)
  return Response.json(result)
}
```

### Security Considerations

1. **Rate Limiting**: Use Vercel's edge middleware or Upstash Redis for rate limiting
2. **Sensitive Fields**: Filter from public responses:
   - `chassis_number` (VIN fraud prevention)
   - `purchase_price`, `sell_price` (business sensitive)
   - `insurance_policy_number` (personal data)
   - Customer booking details (GDPR compliance)

3. **Public API Response**: Return minimal vehicle data:
```typescript
{
  id, plate, make, model, year, type,
  fuelType, transmission, seats,
  isAvailable, imageUrl
}
```

4. **CORS Configuration**: Configure allowed origins in `next.config.js` or use Vercel's built-in CORS handling

### Performance Optimization (Vercel)

1. **Edge Caching**:
   - Static vehicle data can be cached at CDN edge
   - Use `revalidate` tags for ISR (Incremental Static Regeneration)

2. **Vehicle Photos**:
   - Signed URLs with 1-hour cache
   - Consider Vercel Image Optimization for automatic WebP conversion
   - Store in Supabase Storage with CDN caching

3. **Database Optimization**:
   - PostgreSQL RPC functions reduce round-trips
   - Supabase connection pooling for serverless functions
   - Availability checks use indexed date range queries

4. **Serverless Function Optimization**:
   - Results ordered by availability and popularity
   - Response streaming for large datasets
   - Cold start optimization with minimal dependencies

---

## Example Usage

### Check Weekend Availability
```bash
curl -X POST https://noah.air.city/api/vehicles/availability \
  -H "Content-Type: application/json" \
  -d '{
    "pickupDate": "2024-12-21",
    "dropoffDate": "2024-12-23"
  }'
```

### Get Popular Electric Vehicles
```bash
curl -X POST https://noah.air.city/api/vehicles/popular \
  -H "Content-Type: application/json" \
  -d '{
    "pickupDate": "2024-12-25",
    "dropoffDate": "2024-12-30"
  }' | jq '.vehicles[] | select(.fuelType == "Electric")'
```

### Search for MG Vehicles
```bash
curl -X POST https://noah.air.city/api/vehicles/search \
  -H "Content-Type: application/json" \
  -d '{
    "pickupDate": "2024-12-15",
    "dropoffDate": "2024-12-20",
    "searchQuery": "MG"
  }'
```

### Get Current Fleet Status
```bash
curl https://noah.air.city/api/vehicles/status?timePeriod=30d
```

### Get All Available Vehicles
```bash
curl https://noah.air.city/api/vehicles
```

---

## Error Handling

### Common Error Responses

**Invalid Date Range:**
```json
{
  "error": "Dropoff date must be after pickup date",
  "availableVehicles": [],
  "unavailableVehicles": []
}
```

**Missing Parameters:**
```json
{
  "error": "Pickup and dropoff dates are required",
  "vehicles": []
}
```

**Server Error:**
```json
{
  "success": false,
  "error": "Failed to fetch vehicle status"
}
```

---

## Database Schema

### Core Tables

**vehicles**
- Primary table for vehicle fleet management
- Unique constraints: `plate`, `chassis_number`
- Status field tracks asset condition

**bookings**
- Links vehicles to customer reservations
- Date ranges determine availability conflicts
- Status values: "reserved", "on-going", "completed", "cancelled"

**vehicle_documents**
- Stores references to uploaded photos
- `document_type = 'vehicle_photo'` for main images
- Files stored in Supabase Storage

**customers**
- Customer information for booking associations
- Privacy-protected in public APIs

---

## Future Enhancements

1. **GraphQL API** for flexible queries using Vercel's edge runtime
2. **Real-time availability updates** via WebSockets or Vercel's Edge Functions with Server-Sent Events
3. **Vehicle filtering** by features (GPS, child seat, etc.)
4. **Multi-language support** for vehicle descriptions (EN/繁體中文)
5. **Vehicle rating and review system**
6. **Dynamic pricing** based on demand using Vercel Edge Config
7. **Image optimization** using Vercel Image Optimization API (automatic WebP/AVIF conversion)
8. **Vehicle comparison** API endpoint
9. **Webhook notifications** for availability changes
10. **API versioning** (`/api/v1/vehicles`, `/api/v2/vehicles`)

## Deployment Notes (Vercel)

### Environment Variables Required
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Rate Limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Vercel Configuration
```json
{
  "rewrites": [
    {
      "source": "/api/vehicles/:path*",
      "destination": "/api/vehicles/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ]
}
```

### Edge Middleware (Optional)
Create `middleware.ts` for rate limiting:
```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

export async function middleware(request: Request) {
  if (request.url.includes("/api/vehicles")) {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous"
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return new Response("Rate limit exceeded", { status: 429 })
    }
  }
}
```
