import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseFloat(searchParams.get("radius") || "2"); // Default 2km radius
    const limit = parseInt(searchParams.get("limit") || "20"); // Default 20 results

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    // Fetch all carparks with vacancy
    const { data, error } = await supabase
      .from("latest_vacancy_with_location")
      .select(
        "park_id, name, display_address, latitude, longitude, district, opening_status, vehicle_type, vacancy, vacancy_dis, vacancy_ev, lastupdate, is_stale"
      )
      .eq("vehicle_type", "privateCar")
      .gt("vacancy", 0);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    // Calculate distances and filter by radius
    const carparksWithDistance = data
      .map((carpark) => ({
        ...carpark,
        distance: calculateDistance(lat, lng, carpark.latitude, carpark.longitude),
      }))
      .filter((carpark) => carpark.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return NextResponse.json(carparksWithDistance, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching nearby carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
