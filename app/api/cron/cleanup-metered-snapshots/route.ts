import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

const supabase = getServerSupabaseClient('service');

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Metered Snapshots Cleanup] Starting cleanup of old snapshots...');

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_old_metered_snapshots');

    if (error) {
      console.error('[Metered Snapshots Cleanup] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 500 }
      );
    }

    const deletedCount = data && data.length > 0 ? data[0].deleted_count : 0;
    console.log(`[Metered Snapshots Cleanup] Deleted ${deletedCount} occupancy snapshots`);

    // Clean up old ranking snapshots (7 day retention)
    console.log('[Metered Snapshots Cleanup] Cleaning up old ranking snapshots...');
    const { data: rankingCleanup, error: rankingError } = await supabase.rpc('cleanup_old_ranking_snapshots', {
      p_retention_days: 7
    });

    let deletedRankingSnapshots = 0;
    let deletedRankingMetadata = 0;

    if (rankingError) {
      console.error('[Metered Snapshots Cleanup] Ranking cleanup error:', rankingError);
    } else if (rankingCleanup && rankingCleanup.length > 0) {
      deletedRankingSnapshots = rankingCleanup[0].deleted_snapshots || 0;
      deletedRankingMetadata = rankingCleanup[0].deleted_metadata || 0;
      console.log(`[Metered Snapshots Cleanup] Deleted ${deletedRankingSnapshots} ranking snapshots, ${deletedRankingMetadata} metadata entries`);
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      deleted_occupancy_snapshots: deletedCount,
      deleted_ranking_snapshots: deletedRankingSnapshots,
      deleted_ranking_metadata: deletedRankingMetadata
    };

    console.log('[Metered Snapshots Cleanup] Complete:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Metered Snapshots Cleanup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
