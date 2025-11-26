import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching
export const maxDuration = 30; // Extend timeout for materialized view queries

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/parking-spaces
 * Fetches non-metered parking space occupancy data
 *
 * Query parameters:
 * - status: 'vacant' | 'occupied' | 'all' (default: 'vacant')
 * - district: Filter by district name
 * - vehicleType: Filter by vehicle type (A, C, D)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'vacant';
    const district = searchParams.get('district');
    const vehicleType = searchParams.get('vehicleType');

    // Build query
    let query = supabase
      .from("latest_space_occupancy_with_location")
      .select(`
        feature_id,
        parking_space_id,
        latitude,
        longitude,
        district,
        district_tc,
        sub_district,
        sub_district_tc,
        street,
        street_tc,
        section_of_street,
        section_of_street_tc,
        vehicle_type,
        occupancy_status,
        is_vacant,
        occupancy_date_changed,
        is_stale
      `);

    // Filter by occupancy status
    if (status === 'vacant') {
      query = query.eq('is_vacant', true);
    } else if (status === 'occupied') {
      query = query.eq('is_vacant', false);
    }
    // 'all' shows both vacant and occupied

    // Filter by district if provided
    if (district) {
      query = query.eq('district', district);
    }

    // Filter by vehicle type if provided
    if (vehicleType) {
      query = query.eq('vehicle_type', vehicleType);
    }

    // Order by district, then sub-district
    query = query.order('district', { ascending: true })
                 .order('sub_district', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error fetching parking spaces:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
