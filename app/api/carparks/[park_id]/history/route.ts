import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = getServerSupabaseClient('anon');

export async function GET(
  request: NextRequest,
  { params }: { params: { park_id: string } }
) {
  try {
    const { park_id } = params;
    const searchParams = request.nextUrl.searchParams;
    const vehicleType = searchParams.get("vehicle_type") || "privateCar";
    const hours = parseInt(searchParams.get("hours") || "6");

    // Fetch vacancy history for the past N hours
    const { data, error } = await supabase
      .from("parking_vacancy_snapshots")
      .select("vacancy, lastupdate, ingested_at")
      .eq("park_id", park_id)
      .eq("vehicle_type", vehicleType)
      .eq("is_valid", true)
      .gte("ingested_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order("ingested_at", { ascending: true });

    if (error) {
      console.error("Error fetching vacancy history:", error);
      return NextResponse.json(
        { error: "Failed to fetch vacancy history" },
        { status: 500 }
      );
    }

    // Group by 5-minute intervals to reduce data points
    const grouped = data.reduce((acc: any[], item) => {
      const timestamp = new Date(item.ingested_at).getTime();
      const roundedTimestamp = Math.floor(timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);

      const existing = acc.find(x => x.timestamp === roundedTimestamp);
      if (existing) {
        // Take the average if multiple values in the same 5-minute window
        existing.vacancy = Math.round((existing.vacancy + item.vacancy) / 2);
      } else {
        acc.push({
          timestamp: roundedTimestamp,
          vacancy: item.vacancy,
          time: new Date(roundedTimestamp).toISOString()
        });
      }

      return acc;
    }, []);

    return NextResponse.json({
      park_id,
      vehicle_type: vehicleType,
      hours,
      data_points: grouped.length,
      history: grouped.sort((a, b) => a.timestamp - b.timestamp)
    });

  } catch (error) {
    console.error("Error in vacancy history API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
