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

    // Use RPC function for efficient server-side calculation
    const { data, error } = await supabase.rpc('get_metered_carpark_history', {
      p_carpark_id: carpark_id,
      p_hours: hours
    });

    if (error) {
      console.error("Error fetching metered vacancy history:", error);
      return NextResponse.json(
        { error: "Failed to fetch vacancy history" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        carpark_id,
        hours,
        data_points: 0,
        history: []
      });
    }

    // Transform to expected format
    // Add 'Z' suffix to indicate UTC since PostgreSQL returns timestamp without timezone
    const history = data.map((item: { time_bucket: string; vacant_count: number }) => {
      const utcTime = item.time_bucket.endsWith('Z') ? item.time_bucket : `${item.time_bucket}Z`;
      return {
        timestamp: new Date(utcTime).getTime(),
        vacancy: item.vacant_count,
        time: utcTime
      };
    });

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
