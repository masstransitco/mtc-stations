import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Allow up to 5 minutes for the space-level refresh (scanning 52M+ rows)
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Metered Space Occupancy Cron] Starting space-level refresh...');
    const startTime = Date.now();

    // Refresh the space-level materialized view
    const { error } = await supabase.rpc('refresh_latest_metered_space_occupancy');

    const duration = Date.now() - startTime;

    if (error) {
      console.error('[Metered Space Occupancy Cron] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          duration_ms: duration
        },
        { status: 500 }
      );
    }

    console.log(`[Metered Space Occupancy Cron] Refresh completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('[Metered Space Occupancy Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
