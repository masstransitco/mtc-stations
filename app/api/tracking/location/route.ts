import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Get client IP address from request headers
 */
function getClientIP(request: NextRequest): string | null {
  // Check various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const cfConnecting = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (cfConnecting) {
    return cfConnecting;
  }
  if (real) {
    return real;
  }

  return null;
}

/**
 * POST /api/tracking/location
 * Log user location data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      latitude,
      longitude,
      accuracy,
      altitude,
      altitudeAccuracy,
      heading,
      speed,
      timestamp
    } = body;

    // Validate required fields
    if (!sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, latitude, longitude' },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent');
    const supabase = getSupabaseClient();

    // Insert location log
    const { data, error } = await supabase
      .from('user_location_logs')
      .insert({
        session_id: sessionId,
        ip_address: ipAddress,
        latitude,
        longitude,
        accuracy,
        altitude,
        altitude_accuracy: altitudeAccuracy,
        heading,
        speed,
        timestamp: timestamp || new Date().toISOString(),
        user_agent: userAgent
      })
      .select();

    if (error) {
      console.error('Failed to log location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Location tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
