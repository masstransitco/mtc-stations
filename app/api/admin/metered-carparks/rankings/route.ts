import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const supabase = getServerSupabaseClient('service');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const district = searchParams.get('district') || null;

    const { data, error } = await supabase.rpc('get_latest_ranking_snapshot_with_vacancy', {
      p_limit: limit,
      p_offset: offset,
      p_district: district
    });

    if (error) {
      console.error('Error fetching rankings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Rankings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
