import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching

const supabase = getServerSupabaseClient('anon');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parkId = searchParams.get('park_id');

    // Build query for latest vacancy with location data
    let query = supabase
      .from("latest_vacancy_with_location")
      .select("park_id, name, display_address, latitude, longitude, district, opening_status, vehicle_type, vacancy, vacancy_dis, vacancy_ev, lastupdate, is_stale")
      .eq("vehicle_type", "privateCar");

    // Apply park_id filter if specified (for single carpark lookup)
    if (parkId) {
      query = query.eq("park_id", parkId);
    } else {
      // Only apply vacancy > 0 filter for list views, not single lookups
      query = query.gt("vacancy", 0);
    }

    query = query.order("vacancy", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Use no-store cache for specific carpark lookups (real-time)
    // Use normal caching for list views
    const cacheControl = parkId
      ? 'no-store'
      : 'no-cache, no-store, must-revalidate, max-age=0';

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': cacheControl,
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error fetching carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
