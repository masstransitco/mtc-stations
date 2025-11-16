import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Calculate "trending" based on activity in the past 6 hours
    // We'll calculate a simple activity score based on:
    // 1. Number of vacancy changes (updates)
    // 2. Total variance in vacancy numbers
    // 3. Current availability

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // Get carparks with their recent activity
    const { data: historyData, error: historyError } = await supabase
      .from("parking_vacancy_snapshots")
      .select("park_id, vehicle_type, vacancy, ingested_at")
      .eq("vehicle_type", "privateCar")
      .eq("is_valid", true)
      .gte("ingested_at", sixHoursAgo)
      .order("ingested_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching history:", historyError);
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Calculate activity score for each carpark
    const activityByPark = new Map<string, { changes: number; variance: number; dataPoints: number }>();

    // Group by park_id
    const parkGroups = historyData.reduce((acc, item) => {
      const key = `${item.park_id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof historyData>);

    // Calculate metrics for each park
    Object.entries(parkGroups).forEach(([parkId, history]) => {
      if (history.length < 2) return; // Need at least 2 data points

      let changes = 0;
      let totalVariance = 0;
      const vacancies = history.map(h => h.vacancy);

      // Count changes
      for (let i = 1; i < history.length; i++) {
        if (history[i].vacancy !== history[i-1].vacancy) {
          changes++;
        }
      }

      // Calculate variance
      const mean = vacancies.reduce((sum, v) => sum + v, 0) / vacancies.length;
      totalVariance = vacancies.reduce((sum, v) => sum + Math.abs(v - mean), 0);

      activityByPark.set(parkId, {
        changes,
        variance: totalVariance,
        dataPoints: history.length
      });
    });

    // Get current vacancy data with location info
    const { data: currentData, error: currentError } = await supabase
      .from("latest_vacancy_with_location")
      .select("park_id, name, display_address, latitude, longitude, district, opening_status, vehicle_type, vacancy, vacancy_dis, vacancy_ev, lastupdate, is_stale")
      .eq("vehicle_type", "privateCar")
      .eq("opening_status", "OPEN")
      .gt("vacancy", 0);

    if (currentError) {
      console.error("Error fetching current data:", currentError);
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    // Combine activity scores with current data
    const trendingCarparks = currentData
      .filter(carpark => activityByPark.has(carpark.park_id))
      .map(carpark => {
        const activity = activityByPark.get(carpark.park_id)!;
        // Activity score: weight changes heavily, add variance, normalize by data points
        const activityScore = (activity.changes * 10) + (activity.variance / 2) + (activity.dataPoints * 0.5);

        return {
          ...carpark,
          activity_score: Math.round(activityScore * 100) / 100
        };
      })
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, 10); // Top 10

    return NextResponse.json(trendingCarparks, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error fetching trending carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
