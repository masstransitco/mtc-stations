import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/tracking/sensor
 * Log device sensor data (accelerometer, gyroscope, magnetometer)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sensorType, x, y, z, timestamp } = body;

    // Validate required fields
    if (!sessionId || !sensorType) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, sensorType' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Insert sensor log
    const { data, error } = await supabase
      .from('user_sensor_logs')
      .insert({
        session_id: sessionId,
        sensor_type: sensorType,
        x,
        y,
        z,
        timestamp: timestamp || new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Failed to log sensor data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Sensor tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
