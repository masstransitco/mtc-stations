# Parking Map Frontend Documentation

**Last Updated:** 2025-11-15
**Version:** 1.0.0

---

## Overview

Interactive Google Maps interface displaying real-time parking availability across Hong Kong. Built with Next.js 14, React, and Google Maps Platform (@vis.gl/react-google-maps).

---

## Table of Contents

1. [Architecture](#architecture)
2. [Components](#components)
3. [Theme System](#theme-system)
4. [Map Configuration](#map-configuration)
5. [Data Flow](#data-flow)
6. [UI/UX Design](#uiux-design)
7. [Environment Variables](#environment-variables)
8. [Deployment](#deployment)

---

## Architecture

### Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Rendering:** Client-side (CSR) with server components for layout
- **Maps:** @vis.gl/react-google-maps v1.x
- **Styling:** Inline CSS (theme-aware)
- **State Management:** React hooks (useState, useEffect, useContext)

### Component Hierarchy

```
app/
├── layout.tsx                 # Root layout with theme provider
├── page.tsx                   # Home page (renders map)
└── api/
    └── carparks/
        └── route.ts           # API endpoint for carpark data

components/
├── simple-map.tsx             # Main map component with markers
├── app-header.tsx             # Header with logo and theme toggle
├── footer.tsx                 # Footer with attribution
├── theme-provider.tsx         # Theme context provider
└── theme-toggle.tsx           # Theme switcher button
```

### Layout Structure

```
html (height: 100%)
└── body (display: flex, flexDirection: column, height: 100%)
    └── ThemeProvider
        ├── AppHeader (fixed height)
        ├── main (flex: 1, overflow: hidden)
        │   └── SimpleMap (width: 100%, height: 100%)
        └── Footer (fixed height)
```

---

## Components

### 1. SimpleMap Component

**File:** `components/simple-map.tsx`

**Purpose:** Renders Google Maps with parking markers and InfoWindows

**Key Features:**
- Displays 282+ parking locations in real-time
- Color-coded markers based on vacancy levels
- Click markers to view detailed information
- Theme-aware (light/dark mode sync)
- Smooth animations on InfoWindow open

**Props:** None (self-contained)

**State:**
```typescript
const [carparks, setCarparks] = useState<CarparkWithVacancy[]>([])
const [selectedCarpark, setSelectedCarpark] = useState<CarparkWithVacancy | null>(null)
const [loading, setLoading] = useState(true)
const { isDarkMode } = useTheme()
```

**Marker Color Logic:**
```typescript
vacancy > 20  → Green (#22c55e)
vacancy > 10  → Yellow (#eab308)
vacancy > 0   → Orange (#f97316)
vacancy === 0 → Red (#ef4444)
```

**Data Fetching:**
- Endpoint: `GET /api/carparks`
- Filters: `vehicle_type = 'privateCar'`, `vacancy > 0`
- Updates: On component mount
- Error handling: Console logging

---

### 2. AppHeader Component

**File:** `components/app-header.tsx`

**Purpose:** Application header with branding and theme controls

**Features:**
- MTC logo (SVG, theme-adaptive via CSS filter)
- App title and tagline
- Theme toggle button
- Responsive design (hides tagline on mobile)

**Theme Adaptation:**
```typescript
// Logo color inversion for dark mode
filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
```

---

### 3. Footer Component

**File:** `components/footer.tsx`

**Purpose:** Attribution and copyright notice

**Content:**
- Data source attribution (HK Transport Department)
- Copyright year (dynamic)
- Theme-aware colors

---

### 4. Theme System

**Files:**
- `components/theme-provider.tsx` - Context provider
- `components/theme-toggle.tsx` - UI control

**Themes:**
1. **Light Mode** - Default, light backgrounds
2. **Dark Mode** - Dark backgrounds with inverted logo
3. **System Mode** - Follows OS preference

**Implementation:**
```typescript
type Theme = "light" | "dark" | "system"

// Theme provider exposes:
{
  theme: Theme,
  setTheme: (theme: Theme) => void,
  isDarkMode: boolean  // Computed based on theme + system preference
}
```

**Persistence:** LocalStorage (`localStorage.getItem("theme")`)

**CSS Variables:**
```css
--card: Light (#ffffff) / Dark (#1f2937)
--foreground: Light (#111827) / Dark (#f3f4f6)
--border: Light (#e5e7eb) / Dark (#374151)
--muted-foreground: Light (#6b7280) / Dark (#9ca3af)
```

---

## Map Configuration

### Google Maps Setup

**API Provider:** @vis.gl/react-google-maps

**Map Settings:**
```typescript
{
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
  defaultCenter: { lat: 22.3193, lng: 114.1694 },  // Hong Kong center
  defaultZoom: 11,
  colorScheme: isDarkMode ? 'DARK' : 'LIGHT',
  gestureHandling: "greedy"
}
```

**Map ID Configuration:**
- Platform: Google Cloud Console
- Style: Custom (RoadmapDark for dark mode)
- Features: Advanced markers, 3D buildings

**Important:** Environment variables must be trimmed to avoid whitespace issues:
```typescript
const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim()
```

---

## Data Flow

### API Endpoint

**Route:** `app/api/carparks/route.ts`

**Request:**
```
GET /api/carparks
```

**Response:**
```typescript
{
  park_id: string
  name: string
  display_address: string
  latitude: number
  longitude: number
  district: string | null
  opening_status: "OPEN" | "CLOSED" | null
  vehicle_type: string
  vacancy: number
  vacancy_dis: number | null
  vacancy_ev: number | null
  lastupdate: string (ISO 8601)
  is_stale: boolean
}[]
```

**Query:**
```sql
SELECT park_id, name, display_address, latitude, longitude,
       district, opening_status, vehicle_type, vacancy,
       vacancy_dis, vacancy_ev, lastupdate, is_stale
FROM latest_vacancy_with_location
WHERE vehicle_type = 'privateCar'
  AND vacancy > 0
ORDER BY vacancy DESC
```

**Database:** Supabase PostgreSQL

---

## UI/UX Design

### InfoWindow Design

**Style:** Modern, minimal, card-based

**Layout:**
```
┌─────────────────────────────────┐
│ Carpark Name          [OPEN]   │  ← Header
├─────────────────────────────────┤
│ Full address text here          │  ← Address
├─────────────────────────────────┤
│ ┌────────────┬────────────┐    │
│ │ Available  │ EV Charging│    │  ← Vacancy Grid
│ │    146     │     5      │    │
│ └────────────┴────────────┘    │
├─────────────────────────────────┤
│ Accessible Parking: 2           │  ← Optional
├─────────────────────────────────┤
│ Last updated   Nov 15, 2025     │  ← Timestamp
└─────────────────────────────────┘
```

**Animations:**
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.3s ease-out */
```

**Color Coding:**
- **OPEN Status:** Green background
  - Light: `#d1fae5` bg, `#065f46` text
  - Dark: `#065f46` bg, `#d1fae5` text
- **CLOSED Status:** Red background
  - Light: `#fee2e2` bg, `#7f1d1d` text
  - Dark: `#7f1d1d` bg, `#fee2e2` text

**Typography:**
- Headings: 18px, font-weight 600
- Body: 13px
- Labels: 11px, uppercase, letter-spacing 0.5px
- Numbers: 36px, font-weight 700

---

## Environment Variables

**Required:**

```bash
# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=fac8d0a4...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Important Notes:**
1. Map ID must NOT have trailing whitespace/newlines
2. Use `printf` when setting in Vercel:
   ```bash
   printf "fac8d0a4b514e481e907fa98" | vercel env add NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID production
   ```
3. All env vars are trimmed in code as safety measure

---

## Deployment

### Vercel Configuration

**Framework Preset:** Next.js

**Build Command:** `npm run build`

**Output Directory:** `.next`

**Node Version:** 18.x

### Environment Setup

1. Add all environment variables in Vercel dashboard
2. Ensure no trailing whitespace in Map ID
3. Deploy from `main` branch
4. Enable automatic deployments

### Production Checklist

- [ ] Google Maps API key has proper restrictions
- [ ] Map ID is correctly configured in Google Cloud Console
- [ ] Supabase database is accessible from Vercel IPs
- [ ] Cron jobs are configured for data ingestion
- [ ] Theme system works in production build
- [ ] All 282+ markers render correctly
- [ ] InfoWindow displays complete data

---

## Common Issues

### Map Not Rendering

**Symptom:** Blank screen or "Loading map..."

**Causes:**
1. Map ID has trailing whitespace
2. API key restrictions too strict
3. Layout height cascade broken

**Solution:**
```typescript
// Always trim env vars
const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim()

// Ensure parent has explicit height
<main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
```

### Theme Not Syncing

**Symptom:** Map stays in one color scheme

**Cause:** Missing `colorScheme` prop on Map component

**Solution:**
```typescript
<Map
  colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
  // ... other props
/>
```

### No Data Showing

**Symptom:** 0 carparks rendered

**Causes:**
1. API endpoint not returning data
2. Database view missing `display_address`
3. Filters too restrictive

**Debug:**
```bash
# Check API response
curl http://localhost:3000/api/carparks | python3 -m json.tool

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM latest_vacancy_with_location WHERE vehicle_type = 'privateCar' AND vacancy > 0"
```

---

## Performance

### Metrics

- **Initial Load:** ~2s (includes API fetch + map tiles)
- **Map Render:** ~500ms (282 markers)
- **InfoWindow Open:** <100ms (with animation)
- **Theme Toggle:** <50ms (CSS-only)

### Optimizations

1. **Image Optimization:** Next.js Image component for logo
2. **Code Splitting:** Client components with "use client"
3. **CSS-in-JS:** Inline styles for guaranteed load
4. **Lazy Loading:** Map loads after mount
5. **Data Caching:** API route has `export const dynamic = "force-dynamic"`

---

## Future Enhancements

- [ ] Filter by district
- [ ] Search functionality
- [ ] User geolocation
- [ ] Route to selected car park
- [ ] Favorite car parks (localStorage)
- [ ] Real-time updates (WebSocket/polling)
- [ ] Mobile app (PWA)
- [ ] Accessibility improvements (ARIA labels)
- [ ] Analytics integration
- [ ] Multi-language support

---

## Support

**Repository:** https://github.com/markau/mtc-stations
**Issues:** GitHub Issues
**Documentation:** `/docs` folder

---

**End of Document**
