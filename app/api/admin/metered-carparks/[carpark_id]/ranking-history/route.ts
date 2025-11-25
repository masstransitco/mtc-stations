import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carpark_id: string }> }
) {
  try {
    const { carpark_id } = await params;
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('get_carpark_ranking_history', {
      p_carpark_id: decodeURIComponent(carpark_id),
      p_hours: hours
    });

    if (error) {
      console.error('Error fetching ranking history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      carpark_id: decodeURIComponent(carpark_id),
      hours,
      data_points: data?.length || 0,
      history: data || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ranking history API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ranking history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
