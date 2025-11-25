import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get cached activity rankings with position changes
    const { data: rankings, error: rankError } = await supabase
      .rpc("get_trending_metered_carparks_with_changes");

    if (rankError) {
      console.error("Error fetching trending metered rankings:", rankError);
      return NextResponse.json({ error: rankError.message }, { status: 500 });
    }

    if (!rankings?.length) {
      return NextResponse.json([]);
    }

    // Get live vacancy data for these carpark_ids
    const carparkIds = rankings.map((r: { carpark_id: string }) => r.carpark_id);
    const { data: liveData, error: liveError } = await supabase
      .from("latest_metered_carpark_occupancy")
      .select("*")
      .in("carpark_id", carparkIds);

    if (liveError) {
      console.error("Error fetching live metered vacancy data:", liveError);
      return NextResponse.json({ error: liveError.message }, { status: 500 });
    }

    // Merge rankings with live vacancy data, preserving ranking order
    const result = rankings
      .map((rank: { carpark_id: string; activity_score: number; rank_change: number | null }) => {
        const live = liveData?.find(l => l.carpark_id === rank.carpark_id);
        return live ? {
          ...live,
          activity_score: rank.activity_score,
          rank_change: rank.rank_change
        } : null;
      })
      .filter(Boolean);

    return NextResponse.json(result, {
      headers: {
        // No caching - vacancy data is real-time
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching trending metered carparks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
