import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VehicleTypeHistoryPoint {
  timestamp: number;
  time: string;
  A?: number;
  G?: number;
  C?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carpark_id: string }> }
) {
  try {
    const { carpark_id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get("hours") || "6");
    const byType = searchParams.get("by_type") === "true";

    // Parse vehicle_types filter (comma-separated, e.g., "A,G")
    const vehicleTypesParam = searchParams.get("vehicle_types");
    const vehicleTypes = vehicleTypesParam
      ? vehicleTypesParam.split(",").filter(t => ["A", "C", "G"].includes(t.toUpperCase())).map(t => t.toUpperCase())
      : null;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle by_type mode - returns separate lines per vehicle type
    if (byType) {
      const { data, error } = await supabase.rpc('get_metered_carpark_history_by_vehicle_type', {
        p_carpark_id: carpark_id,
        p_hours: hours
      });

      if (error) {
        console.error("Error fetching metered vacancy history by type:", error);
        return NextResponse.json(
          { error: "Failed to fetch vacancy history" },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        return NextResponse.json({
          carpark_id,
          hours,
          by_type: true,
          data_points: 0,
          history: []
        });
      }

      // Pivot data: [{time_bucket, vehicle_type, vacant_count}, ...] -> [{timestamp, A, G, C}, ...]
      const pivotMap = new Map<number, VehicleTypeHistoryPoint>();

      data.forEach((item: { time_bucket: string; vehicle_type: string; vacant_count: number }) => {
        const utcTime = item.time_bucket.endsWith('Z') ? item.time_bucket : `${item.time_bucket}Z`;
        const timestamp = new Date(utcTime).getTime();

        if (!pivotMap.has(timestamp)) {
          pivotMap.set(timestamp, { timestamp, time: utcTime });
        }

        const point = pivotMap.get(timestamp)!;
        const vt = item.vehicle_type.trim().toUpperCase();
        if (vt === 'A') point.A = item.vacant_count;
        else if (vt === 'G') point.G = item.vacant_count;
        else if (vt === 'C') point.C = item.vacant_count;
      });

      const history = Array.from(pivotMap.values()).sort((a, b) => a.timestamp - b.timestamp);

      return NextResponse.json({
        carpark_id,
        hours,
        by_type: true,
        data_points: history.length,
        history
      });
    }

    // Standard mode - aggregated vacancy
    // Use filtered RPC when specific vehicle types are selected, otherwise use original
    const useFiltered = vehicleTypes && vehicleTypes.length > 0 && vehicleTypes.length < 3;

    const { data, error } = useFiltered
      ? await supabase.rpc('get_metered_carpark_history_filtered', {
          p_carpark_id: carpark_id,
          p_hours: hours,
          p_vehicle_types: vehicleTypes
        })
      : await supabase.rpc('get_metered_carpark_history', {
          p_carpark_id: carpark_id,
          p_hours: hours
        });

    if (error) {
      console.error("Error fetching metered vacancy history:", error);
      return NextResponse.json(
        { error: "Failed to fetch vacancy history" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        carpark_id,
        hours,
        vehicle_types: vehicleTypes || ['A', 'C', 'G'],
        data_points: 0,
        history: []
      });
    }

    // Transform to expected format
    // Add 'Z' suffix to indicate UTC since PostgreSQL returns timestamp without timezone
    const history = data.map((item: { time_bucket: string; vacant_count: number }) => {
      const utcTime = item.time_bucket.endsWith('Z') ? item.time_bucket : `${item.time_bucket}Z`;
      return {
        timestamp: new Date(utcTime).getTime(),
        vacancy: item.vacant_count,
        time: utcTime
      };
    });

    return NextResponse.json({
      carpark_id,
      hours,
      vehicle_types: vehicleTypes || ['A', 'C', 'G'],
      data_points: history.length,
      history
    });

  } catch (error) {
    console.error("Error in metered vacancy history API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
