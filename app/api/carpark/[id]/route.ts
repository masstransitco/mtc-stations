import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parkId = params.id;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const { Client } = await import('pg');
    const client = new Client({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', '')}`,
      password: process.env.POSTGRES_PASSWORD,
      database: 'postgres',
      ssl: {
        rejectUnauthorized: false,
      },
    });
    await client.connect();

    try {
      // Get carpark details with capacity
      const carparkQuery = `
        WITH capacity_data AS (
          SELECT
            park_id,
            MAX(vacancy) as max_capacity
          FROM parking_vacancy_snapshots
          WHERE vehicle_type = 'privateCar' AND is_valid = true
          GROUP BY park_id
        ),
        latest_data AS (
          SELECT DISTINCT ON (v.park_id)
            v.park_id,
            c.name,
            c.display_address,
            c.latitude,
            c.longitude,
            c.district,
            v.vacancy as current_vacancy,
            cap.max_capacity,
            CASE
              WHEN cap.max_capacity < 50 THEN 'Small'
              WHEN cap.max_capacity < 100 THEN 'Medium'
              WHEN cap.max_capacity < 200 THEN 'Large'
              ELSE 'Very Large'
            END as size_category,
            v.lastupdate,
            v.ingested_at
          FROM parking_vacancy_snapshots v
          JOIN carpark_info c ON v.park_id = c.park_id
          LEFT JOIN capacity_data cap ON v.park_id = cap.park_id
          WHERE v.vehicle_type = 'privateCar'
            AND v.is_valid = true
            AND v.park_id = $1
          ORDER BY v.park_id, v.ingested_at DESC
        )
        SELECT * FROM latest_data
        WHERE max_capacity IS NOT NULL
      `;

      const carparkResult = await client.query(carparkQuery, [parkId]);

      if (carparkResult.rows.length === 0) {
        await client.end();
        return NextResponse.json(
          { error: 'Carpark not found' },
          { status: 404 }
        );
      }

      const carpark = carparkResult.rows[0];

      // Get hourly time-series data
      const timeSeriesQuery = `
        SELECT
          DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
          AVG(vacancy) as avg_vacancy,
          MIN(vacancy) as min_vacancy,
          MAX(vacancy) as max_vacancy,
          COUNT(*) as snapshot_count,
          STDDEV(vacancy) as vacancy_stddev
        FROM parking_vacancy_snapshots
        WHERE park_id = $1
          AND vehicle_type = 'privateCar'
          AND is_valid = true
          AND ingested_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong')
        ORDER BY hour DESC
        LIMIT 168
      `;

      const timeSeriesResult = await client.query(timeSeriesQuery, [parkId]);

      // Calculate rate of change (vacancy delta per hour)
      const timeSeriesData = timeSeriesResult.rows.reverse();
      const rateOfChange = timeSeriesData.map((current, index) => {
        if (index === 0) return { ...current, rate_of_change: 0 };
        const previous = timeSeriesData[index - 1];
        const change = Number(current.avg_vacancy) - Number(previous.avg_vacancy);
        return {
          ...current,
          rate_of_change: Number(change.toFixed(2)),
        };
      });

      // Calculate activity score (based on variance and frequency of changes)
      const avgStdDev = timeSeriesData.reduce((sum, d) => sum + Number(d.vacancy_stddev || 0), 0) / timeSeriesData.length;
      const avgRateChange = Math.abs(rateOfChange.reduce((sum, d) => sum + Math.abs(d.rate_of_change), 0) / rateOfChange.length);
      const activityScore = Math.round((avgStdDev * 0.5 + avgRateChange * 0.5) * 10) / 10;

      const carparkWithMetrics = {
        ...carpark,
        max_capacity: Number(carpark.max_capacity),
        current_vacancy: Number(carpark.current_vacancy),
        time_series: rateOfChange,
        activity_score: activityScore,
        avg_variance: Number(avgStdDev.toFixed(2)),
        avg_rate_change: Number(avgRateChange.toFixed(2)),
      };

      await client.end();

      return NextResponse.json({
        success: true,
        carpark: carparkWithMetrics,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Carpark API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carpark data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
