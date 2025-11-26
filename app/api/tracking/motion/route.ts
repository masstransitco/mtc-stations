import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * POST /api/tracking/motion
 * Log user motion data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      motionState,
      previousLatitude,
      previousLongitude,
      timestamp
    } = body;

    // Validate required fields
    if (!sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, latitude, longitude' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient('service');

    // Calculate distance from previous position if provided
    let distanceFromPrevious = null;
    if (previousLatitude !== undefined && previousLongitude !== undefined) {
      distanceFromPrevious = calculateDistance(
        previousLatitude,
        previousLongitude,
        latitude,
        longitude
      );
    }

    // Insert motion log
    const { data, error } = await supabase
      .from('user_motion_logs')
      .insert({
        session_id: sessionId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        motion_state: motionState || 'moving',
        distance_from_previous: distanceFromPrevious,
        timestamp: timestamp || new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Failed to log motion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      distance: distanceFromPrevious
    });
  } catch (error) {
    console.error('Motion tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
