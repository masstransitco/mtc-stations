import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const supabase = getServerSupabaseClient('service');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshot_id: string }> }
) {
  try {
    const { snapshot_id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error } = await supabase.rpc('get_ranking_snapshot', {
      p_snapshot_id: snapshot_id,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching snapshot:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get metadata for this snapshot
    const { data: metadata } = await supabase
      .from('metered_carpark_snapshot_metadata')
      .select('*')
      .eq('snapshot_id', snapshot_id)
      .single();

    return NextResponse.json({
      success: true,
      snapshot: metadata,
      rankings: data || [],
      total: data?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Snapshot detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
