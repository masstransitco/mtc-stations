import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface TimeSeriesPoint {
  hour: string;
  avg_vacancy: number;
  min_vacancy: number;
  max_vacancy: number;
  snapshot_count: number;
  vacancy_stddev: number;
  rate_of_change?: number;
}

interface CarparkAnalytics {
  park_id: string;
  name: string;
  display_address: string;
  latitude: number;
  longitude: number;
  district: string;
  current_vacancy: number;
  max_capacity: number;
  size_category: string;
  lastupdate: string;
  ingested_at: string;
}

/**
 * GET /api/carparks/[park_id]/analytics
 * Returns detailed carpark analytics with time-series data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ park_id: string }> }
) {
  try {
    const { park_id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const supabase = getServerSupabaseClient('anon');

    // Call the RPC function
    const { data, error } = await supabase.rpc('get_carpark_analytics', {
      p_park_id: park_id,
      p_days: days
    });

    if (error) {
      console.error('Carpark analytics RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch carpark analytics', details: error.message },
        { status: 500 }
      );
    }

    if (!data || !data.carpark) {
      return NextResponse.json(
        { error: 'Carpark not found' },
        { status: 404 }
      );
    }

    const carpark: CarparkAnalytics = data.carpark;
    const timeSeries: TimeSeriesPoint[] = data.time_series || [];

    // Calculate rate of change for each time point
    const reversedSeries = [...timeSeries].reverse();
    const timeSeriesWithChange = reversedSeries.map((current, index) => {
      if (index === 0) return { ...current, rate_of_change: 0 };
      const previous = reversedSeries[index - 1];
      const change = Number(current.avg_vacancy) - Number(previous.avg_vacancy);
      return {
        ...current,
        rate_of_change: Number(change.toFixed(2)),
      };
    });

    // Calculate activity score
    const avgStdDev = timeSeriesWithChange.reduce(
      (sum, d) => sum + Number(d.vacancy_stddev || 0), 0
    ) / (timeSeriesWithChange.length || 1);

    const avgRateChange = Math.abs(
      timeSeriesWithChange.reduce(
        (sum, d) => sum + Math.abs(d.rate_of_change || 0), 0
      ) / (timeSeriesWithChange.length || 1)
    );

    const activityScore = Math.round((avgStdDev * 0.5 + avgRateChange * 0.5) * 10) / 10;

    const carparkWithMetrics = {
      ...carpark,
      max_capacity: Number(carpark.max_capacity),
      current_vacancy: Number(carpark.current_vacancy),
      time_series: timeSeriesWithChange,
      activity_score: activityScore,
      avg_variance: Number(avgStdDev.toFixed(2)),
      avg_rate_change: Number(avgRateChange.toFixed(2)),
    };

    return NextResponse.json({
      success: true,
      carpark: carparkWithMetrics,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Carpark analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carpark data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
