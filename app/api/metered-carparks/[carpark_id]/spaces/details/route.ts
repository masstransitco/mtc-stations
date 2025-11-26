import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface MeteredSpaceDetail {
  parking_space_id: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  is_vacant: boolean | null;
  has_real_time_tracking: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carpark_id: string }> }
) {
  try {
    const { carpark_id } = await params;
    const decodedCarparkId = decodeURIComponent(carpark_id);

    const { data, error } = await supabase.rpc('get_metered_carpark_space_details', {
      p_carpark_id: decodedCarparkId
    });

    if (error) {
      console.error('[Metered Space Details API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const spaces: MeteredSpaceDetail[] = (data || []).map((row: {
      parking_space_id: string;
      latitude: string | number;
      longitude: string | number;
      vehicle_type: string;
      is_vacant: boolean | null;
      has_real_time_tracking: boolean;
    }) => ({
      parking_space_id: row.parking_space_id,
      latitude: typeof row.latitude === 'string' ? parseFloat(row.latitude) : row.latitude,
      longitude: typeof row.longitude === 'string' ? parseFloat(row.longitude) : row.longitude,
      vehicle_type: row.vehicle_type,
      is_vacant: row.is_vacant,
      has_real_time_tracking: row.has_real_time_tracking,
    }));

    return NextResponse.json({
      carpark_id: decodedCarparkId,
      count: spaces.length,
      spaces
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('[Metered Space Details API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
