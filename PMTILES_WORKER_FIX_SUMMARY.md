# PMTiles Cloudflare Worker Fix Summary

**Date**: November 20, 2025
**Status**: ✅ FIXED AND DEPLOYED

---

## Problem Identified

The Cloudflare Worker at `https://pmtiles-cors-proxy.mark-737.workers.dev` was experiencing errors that caused inconsistent 3D building tile rendering in development.

### Root Cause

The worker code (`cloudflare-worker-pmtiles-cors.js:97`) was attempting to cache **all responses** including 206 Partial Content responses:

```javascript
// OLD CODE - BROKEN
ctx.waitUntil(cache.put(request, response.clone()));
```

**Issue**: Cloudflare's Cache API does not support caching 206 Partial Content responses. This is a known limitation.

### Error Logs

```
❌ TypeError: Cannot cache response to a range request (206 Partial Content).
```

This error occurred on every range request (which PMTiles uses heavily), causing:
- Worker instability after accumulating many errors
- Potential throttling by Cloudflare
- Inconsistent tile loading behavior
- Tiles working initially then failing after a while

---

## Solution Implemented

Modified `cloudflare-worker-pmtiles-cors.js` to only cache full responses (status 200):

```javascript
// NEW CODE - FIXED
// Only cache full responses (status 200), not range requests (status 206)
// Cloudflare Cache API doesn't support caching 206 Partial Content responses
if (status === 200) {
  ctx.waitUntil(cache.put(request, response.clone()));
}
```

### Changes Made

1. **Fixed Worker Code**: Added conditional caching to avoid 206 responses
2. **Deployed to Cloudflare**: Version `300cfd09-04c4-495a-87c4-7ade5f741948`
3. **Verified No Errors**: Worker logs now show clean requests with no errors
4. **Updated Vercel Environment Variables**:
   - Added `NEXT_PUBLIC_PMTILES_CDN_URL=https://pmtiles-cors-proxy.mark-737.workers.dev`
   - Set across all environments: Production, Preview, Development

---

## Verification Results

### Worker Status
- ✅ Deployed and live on Cloudflare global edge network
- ✅ 100% independent of local machine
- ✅ Serving from 300+ data centers worldwide
- ✅ R2 bucket binding: `mtc-buildings-pmtiles` → `buildings.pmtiles`

### Test Results
```
Test 1: HEAD request ✅
Test 2: Range request (bytes 0-511) ✅ (206 status)
Test 3: Multiple rapid range requests ✅
Test 4: 10 concurrent requests ✅ (avg 82ms)
```

### Worker Logs (After Fix)
```
GET https://pmtiles-cors-proxy.mark-737.workers.dev/buildings.pmtiles - Ok
```
No errors! 🎉

---

## Environment Configuration

### Local Development (`.env.local`)
```bash
NEXT_PUBLIC_PMTILES_CDN_URL=https://pmtiles-cors-proxy.mark-737.workers.dev
```

### Vercel Production
```bash
NEXT_PUBLIC_PMTILES_CDN_URL=https://pmtiles-cors-proxy.mark-737.workers.dev
```

### Legacy Environment Variable
The old `NEXT_PUBLIC_BUILDINGS_CDN_URL=https://pub-1fe455741dc34c92bb2b492e811ddc5c.r2.dev` is still in Vercel for backward compatibility with legacy GeoJSON tiles.

---

## Next Deployment

When you push to git and Vercel automatically deploys:
1. ✅ Vercel will use the new `NEXT_PUBLIC_PMTILES_CDN_URL` environment variable
2. ✅ Production will now use the fixed Cloudflare Worker
3. ✅ No code changes needed - environment variable is already set
4. ✅ 3D buildings should load consistently and reliably

---

## Technical Details

### Worker Architecture
```
Browser Request
    ↓
Cloudflare Edge (300+ locations)
    ↓
Worker: pmtiles-cors-proxy.mark-737.workers.dev
    ↓
R2 Bucket: mtc-buildings-pmtiles
    ↓
buildings.pmtiles (65.8 MB)
```

### Worker Features
- ✅ CORS headers for browser access
- ✅ HTTP range request support (critical for PMTiles)
- ✅ Edge caching for full responses (200)
- ✅ R2 bucket binding (no public URL needed)
- ✅ Global CDN distribution

### Why This Is Better Than Direct R2 Access
1. **CORS Control**: Worker adds proper CORS headers
2. **Edge Caching**: Cloudflare edge caches full responses
3. **No Public R2 URL**: R2 bucket remains private with worker binding
4. **Observability**: Can tail logs with `wrangler tail`
5. **Flexibility**: Can add rate limiting, analytics, etc.

---

## Files Modified

1. `cloudflare-worker-pmtiles-cors.js` - Fixed caching logic
2. Vercel Environment Variables - Added `NEXT_PUBLIC_PMTILES_CDN_URL`

## Files Not Modified

- `components/building-overlay-pmtiles.tsx` - Already uses `NEXT_PUBLIC_PMTILES_CDN_URL`
- `.env.local` - Already has correct configuration

---

## Maintenance

### Monitoring Worker Health
```bash
wrangler tail pmtiles-cors-proxy --format pretty
```

### Redeploying Worker (if needed)
```bash
wrangler deploy cloudflare-worker-pmtiles-cors.js --config wrangler-pmtiles.toml
```

### Checking Vercel Environment Variables
```bash
vercel env ls
```

---

## Conclusion

The inconsistent 3D building tile rendering issue in development was caused by a bug in the Cloudflare Worker attempting to cache 206 Partial Content responses, which Cloudflare's Cache API does not support. This has been fixed and deployed to production.

**Status**: Ready for production deployment on next git push ✅
