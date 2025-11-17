import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("connected_carparks")
      .select("park_id, name, address, district, latitude, longitude")
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
