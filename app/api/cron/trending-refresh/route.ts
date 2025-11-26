import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

// Extend Vercel function timeout to 30 seconds
export const maxDuration = 30;

const supabase = getServerSupabaseClient('service');

/**
 * Dedicated cron for refreshing trending carpark caches.
 *
 * This acts as a safety net to ensure trending caches are always fresh,
 * even if the main data ingestion crons time out before reaching the
 * trending refresh step.
 *
 * Runs at :01 and :06 past each 5-minute interval (1 minute after data crons).
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Trending Refresh Cron] Starting...');

    const results = {
      regular_carparks: { success: false, error: null as string | null },
      metered_carparks: { success: false, error: null as string | null },
    };

    // Refresh regular carparks trending cache
    console.log('[Trending Refresh Cron] Refreshing regular carparks trending...');
    const { error: regularError } = await supabase.rpc('refresh_trending_carparks_with_tracking');

    if (regularError) {
      console.error('[Trending Refresh Cron] Regular carparks refresh failed:', regularError);
      results.regular_carparks.error = regularError.message;
    } else {
      console.log('[Trending Refresh Cron] Regular carparks trending refreshed');
      results.regular_carparks.success = true;
    }

    // Refresh metered carparks trending cache
    console.log('[Trending Refresh Cron] Refreshing metered carparks trending...');
    const { error: meteredError } = await supabase.rpc('refresh_trending_metered_carparks_with_tracking');

    if (meteredError) {
      console.error('[Trending Refresh Cron] Metered carparks refresh failed:', meteredError);
      results.metered_carparks.error = meteredError.message;
    } else {
      console.log('[Trending Refresh Cron] Metered carparks trending refreshed');
      results.metered_carparks.success = true;
    }

    const duration = Date.now() - startTime;
    const overallSuccess = results.regular_carparks.success && results.metered_carparks.success;

    const response = {
      success: overallSuccess,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results,
    };

    console.log('[Trending Refresh Cron] Complete:', response);

    return NextResponse.json(response, { status: overallSuccess ? 200 : 207 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Trending Refresh Cron] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
