import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching

const supabase = getServerSupabaseClient('anon');

export async function GET() {
  try {

    const { data, error } = await supabase
      .from("connected_carparks")
      .select("park_id, name, address, district, latitude, longitude, has_indoor_map, indoor_floors")
      .order("name");

    if (error) {
      console.error("Error fetching connected carparks from Supabase:", error);
      return NextResponse.json(
        { error: "Failed to fetch connected carparks" },
        { status: 500 }
      );
    }

    // Transform to expected format (ensure types are correct)
    const carparks = (data || []).map((record: any) => ({
      park_id: record.park_id,
      name: record.name,
      address: record.address,
      district: record.district || "",
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude),
      has_indoor_map: record.has_indoor_map || false,
      indoor_floors: record.indoor_floors || null,
    }));

    return NextResponse.json(carparks, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error reading connected carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
