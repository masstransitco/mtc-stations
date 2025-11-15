import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Fetch latest vacancy with location data
    // Using the view that joins vacancy data with carpark coordinates
    const { data, error } = await supabase
      .from("latest_vacancy_with_location")
      .select("park_id, name, display_address, latitude, longitude, district, opening_status, vehicle_type, vacancy, vacancy_dis, vacancy_ev, lastupdate, is_stale")
      .eq("vehicle_type", "privateCar")
      .gt("vacancy", 0)
      .order("vacancy", { ascending: false });

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
    console.error("Error fetching carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
