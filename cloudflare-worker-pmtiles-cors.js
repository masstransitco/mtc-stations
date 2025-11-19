// Cloudflare Worker to proxy PMTiles with CORS headers and edge caching
// This Worker sits between the browser and R2, providing:
// - CORS headers for range requests
// - Cloudflare edge caching for PMTiles chunks
// - Proper handling of HTTP range requests

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, If-Modified-Since, If-None-Match',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Get the object key from the path
    const objectKey = url.pathname.slice(1); // Remove leading slash

    if (!objectKey) {
      return new Response('Please specify a file path', { status: 400 });
    }

    // Check cache first
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      // Not in cache, fetch from R2
      const range = request.headers.get('range');

      let object;
      if (range) {
        // Parse range header (e.g., "bytes=0-1023")
        const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : undefined;

          const options = end !== undefined
            ? { range: { offset: start, length: end - start + 1 } }
            : { range: { offset: start } };

          object = await env.PMTILES_BUCKET.get(objectKey, options);
        } else {
          object = await env.PMTILES_BUCKET.get(objectKey);
        }
      } else {
        object = await env.PMTILES_BUCKET.get(objectKey);
      }

      if (!object) {
        return new Response('Not Found', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // Build response headers
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);

      // Add CORS headers
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
      headers.set('Access-Control-Allow-Headers', 'Range, If-Modified-Since, If-None-Match');
      headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, ETag');

      // Add caching headers for Cloudflare edge
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      // Always advertise range support
      headers.set('Accept-Ranges', 'bytes');

      // Handle range response
      const status = range && object.range ? 206 : 200;

      if (status === 206 && object.range) {
        headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      }

      response = new Response(object.body, {
        status,
        headers,
      });

      // Cache the response (Cloudflare will cache based on Cache-Control)
      ctx.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  },
};

// wrangler.toml configuration:
// name = "pmtiles-cors-proxy"
// main = "cloudflare-worker-pmtiles-cors.js"
// compatibility_date = "2024-01-01"
//
// [[r2_buckets]]
// binding = "PMTILES_BUCKET"
// bucket_name = "mtc-buildings-pmtiles"
