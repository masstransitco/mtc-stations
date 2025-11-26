import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = getServerSupabaseClient('anon');

export async function GET() {
  try {
    // Get cached activity rankings with position changes
    const { data: rankings, error: rankError } = await supabase
      .rpc("get_trending_carparks_with_changes");

    if (rankError) {
      console.error("Error fetching trending rankings:", rankError);
      return NextResponse.json({ error: rankError.message }, { status: 500 });
    }

    if (!rankings?.length) {
      return NextResponse.json([]);
    }

    // Get live vacancy data for these park_ids
    const parkIds = rankings.map((r: { park_id: string }) => r.park_id);
    const { data: liveData, error: liveError } = await supabase
      .from("latest_vacancy_with_location")
      .select("*")
      .in("park_id", parkIds)
      .eq("vehicle_type", "privateCar");

    if (liveError) {
      console.error("Error fetching live vacancy data:", liveError);
      return NextResponse.json({ error: liveError.message }, { status: 500 });
    }

    // Merge rankings with live vacancy data, preserving ranking order
    const result = rankings
      .map((rank: { park_id: string; activity_score: number; rank_change: number | null }) => {
        const live = liveData?.find(l => l.park_id === rank.park_id);
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
    console.error("Error fetching trending carparks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
