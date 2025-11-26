import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = getServerSupabaseClient('anon');

export interface VehicleTypeBreakdown {
  vehicle_type: string;
  vehicle_type_label: string;
  total_spaces: number;
  tracked_spaces: number;
  vacant_spaces: number;
  occupied_spaces: number;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  'A': 'Private Car',
  'C': 'Coach/Bus',
  'G': 'Goods Vehicle',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carpark_id: string }> }
) {
  try {
    const { carpark_id } = await params;
    const decodedCarparkId = decodeURIComponent(carpark_id);

    // Query to get vehicle type breakdown
    const { data, error } = await supabase.rpc('get_metered_carpark_vehicle_breakdown', {
      p_carpark_id: decodedCarparkId
    });

    if (error) {
      // If RPC doesn't exist, fall back to direct query
      if (error.code === '42883') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('metered_space_info')
          .select('vehicle_type, has_real_time_tracking')
          .eq('carpark_id', decodedCarparkId);

        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }

        // Group by vehicle type manually
        const grouped = (fallbackData || []).reduce((acc, space) => {
          const type = space.vehicle_type || 'A';
          if (!acc[type]) {
            acc[type] = { total: 0, tracked: 0 };
          }
          acc[type].total++;
          if (space.has_real_time_tracking) acc[type].tracked++;
          return acc;
        }, {} as Record<string, { total: number; tracked: number }>);

        const breakdown: VehicleTypeBreakdown[] = Object.entries(grouped).map(([type, data]) => ({
          vehicle_type: type,
          vehicle_type_label: VEHICLE_TYPE_LABELS[type] || type,
          total_spaces: data.total,
          tracked_spaces: data.tracked,
          vacant_spaces: 0,
          occupied_spaces: 0,
        }));

        return NextResponse.json(breakdown.sort((a, b) => b.total_spaces - a.total_spaces));
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map RPC results to include labels
    const breakdown: VehicleTypeBreakdown[] = (data || []).map((row: {
      vehicle_type: string;
      total_spaces: number;
      tracked_spaces: number;
      vacant_spaces: number;
      occupied_spaces: number;
    }) => ({
      ...row,
      vehicle_type_label: VEHICLE_TYPE_LABELS[row.vehicle_type] || row.vehicle_type,
    }));

    return NextResponse.json(breakdown.sort((a, b) => b.total_spaces - a.total_spaces));
  } catch (error) {
    console.error('[Metered Carpark Spaces API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
