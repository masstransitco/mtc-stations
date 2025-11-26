import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const supabase = getServerSupabaseClient('service');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('start') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = searchParams.get('end') || new Date().toISOString();
    const limit = parseInt(searchParams.get('limit') || '100');

    const { data, error } = await supabase.rpc('get_ranking_snapshot_list', {
      p_start_time: startTime,
      p_end_time: endTime,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching snapshot list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      snapshots: data || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Snapshot list API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
