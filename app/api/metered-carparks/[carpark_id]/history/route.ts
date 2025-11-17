import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { carpark_id: string } }
) {
  try {
    const { carpark_id } = params;
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get("hours") || "6");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, get the space IDs for this carpark
    const { data: spaces, error: spacesError } = await supabase
      .from("metered_space_info")
      .select("parking_space_id")
      .eq("carpark_id", carpark_id)
      .eq("has_real_time_tracking", true);

    if (spacesError || !spaces || spaces.length === 0) {
      console.error("Error fetching spaces:", spacesError);
      return NextResponse.json({
        carpark_id,
        hours,
        data_points: 0,
        history: []
      });
    }

    const spaceIds = spaces.map(s => s.parking_space_id);

    // Fetch vacancy history for the past N hours
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("metered_space_occupancy_snapshots")
      .select("ingested_at, is_vacant, parking_space_id")
      .in("parking_space_id", spaceIds)
      .eq("is_valid", true)
      .gte("ingested_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order("ingested_at", { ascending: true });

    if (snapshotsError) {
      console.error("Error fetching snapshots:", snapshotsError);
      return NextResponse.json(
        { error: "Failed to fetch vacancy history" },
        { status: 500 }
      );
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        carpark_id,
        hours,
        data_points: 0,
        history: []
      });
    }

    // Group by ingested_at timestamp and calculate vacancy
    const timeGroupMap = new Map<number, { vacant: number; total: number }>();

    snapshots.forEach(item => {
      const timestamp = new Date(item.ingested_at).getTime();
      const roundedTimestamp = Math.floor(timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);

      const existing = timeGroupMap.get(roundedTimestamp) || { vacant: 0, total: 0 };
      existing.total++;
      if (item.is_vacant) {
        existing.vacant++;
      }
      timeGroupMap.set(roundedTimestamp, existing);
    });

    // Calculate vacancy count for each time window
    const history = Array.from(timeGroupMap.entries())
      .map(([timestamp, counts]) => ({
        timestamp,
        vacancy: counts.vacant,
        time: new Date(timestamp).toISOString()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      carpark_id,
      hours,
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
