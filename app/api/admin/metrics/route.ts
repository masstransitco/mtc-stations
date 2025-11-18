import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    const sizeCategory = searchParams.get('sizeCategory');
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
      // ===== Activity Metrics =====
      const activityResult = await client.query(`
        SELECT
          DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
          COUNT(*) as snapshot_count,
          COUNT(DISTINCT park_id) as unique_carparks,
          COUNT(*) FILTER (WHERE is_valid = true) as valid_count,
          COUNT(*) FILTER (WHERE is_valid = false) as invalid_count,
          ROUND(100.0 * COUNT(*) FILTER (WHERE is_valid = false) / COUNT(*), 2) as offline_percentage
        FROM parking_vacancy_snapshots
        WHERE vehicle_type = 'privateCar'
          AND ingested_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE_TRUNC('hour', ingested_at AT TIME ZONE 'Asia/Hong_Kong')
        ORDER BY hour DESC
        LIMIT 168
      `);

      // ===== Data Quality Metrics =====
      const qualityResult = await client.query(`
        WITH latest AS (
          SELECT DISTINCT ON (park_id)
            park_id, is_valid
          FROM parking_vacancy_snapshots
          WHERE vehicle_type = 'privateCar'
          ORDER BY park_id, ingested_at DESC
        )
        SELECT
          COUNT(DISTINCT park_id) as total_carparks,
          COUNT(DISTINCT park_id) FILTER (WHERE is_valid = true) as active_carparks,
          COUNT(*) as total_snapshots,
          COUNT(*) FILTER (WHERE is_valid = true) as valid_snapshots,
          ROUND(100.0 * COUNT(*) FILTER (WHERE is_valid = true) / COUNT(*), 2) as validity_rate
        FROM latest
      `);

      // ===== Utilization Over Time =====
      let utilizationQuery = `
        WITH hourly_data AS (
          SELECT
            DATE_TRUNC('hour', v.ingested_at AT TIME ZONE 'Asia/Hong_Kong') as hour,
            v.park_id,
            AVG(v.vacancy) as avg_vacancy,
            MAX(v.vacancy) FILTER (WHERE v.vacancy > 0) as max_capacity
          FROM parking_vacancy_snapshots v
          JOIN carpark_info c ON v.park_id = c.park_id
          WHERE v.vehicle_type = 'privateCar'
            AND v.is_valid = true
            AND v.ingested_at >= NOW() - INTERVAL '${days} days'
            ${district ? `AND c.district = $1` : ''}
          GROUP BY DATE_TRUNC('hour', v.ingested_at AT TIME ZONE 'Asia/Hong_Kong'), v.park_id
        ),
        capacity_estimates AS (
          SELECT
            park_id,
            MAX(max_capacity) as estimated_capacity
          FROM hourly_data
          WHERE max_capacity IS NOT NULL
          GROUP BY park_id
        )
        SELECT
          h.hour,
          COUNT(DISTINCT h.park_id) as carpark_count,
          ROUND(AVG(h.avg_vacancy), 2) as avg_vacancy,
          ROUND(AVG(CASE
            WHEN c.estimated_capacity > 0
            THEN 100.0 * (1 - h.avg_vacancy / c.estimated_capacity)
            ELSE NULL
          END), 2) as avg_utilization_rate
        FROM hourly_data h
        LEFT JOIN capacity_estimates c ON h.park_id = c.park_id
        GROUP BY h.hour
        ORDER BY h.hour DESC
        LIMIT 168
      `;

      const utilizationResult = await client.query(
        utilizationQuery,
        district ? [district] : []
      );

      // ===== Utilization by District =====
      const districtUtilResult = await client.query(`
        WITH latest_data AS (
          SELECT DISTINCT ON (v.park_id)
            v.park_id,
            c.district,
            v.vacancy,
            v.ingested_at
          FROM parking_vacancy_snapshots v
          JOIN carpark_info c ON v.park_id = c.park_id
          WHERE v.vehicle_type = 'privateCar'
            AND v.is_valid = true
          ORDER BY v.park_id, v.ingested_at DESC
        ),
        capacity_data AS (
          SELECT
            park_id,
            MAX(vacancy) as max_capacity
          FROM parking_vacancy_snapshots
          WHERE vehicle_type = 'privateCar' AND is_valid = true
          GROUP BY park_id
        )
        SELECT
          l.district,
          COUNT(DISTINCT l.park_id) as carpark_count,
          ROUND(AVG(l.vacancy), 2) as avg_vacancy,
          SUM(l.vacancy)::integer as total_vacancy,
          ROUND(AVG(CASE
            WHEN c.max_capacity > 0
            THEN 100.0 * (1 - l.vacancy / c.max_capacity)
            ELSE NULL
          END), 2) as avg_utilization_rate
        FROM latest_data l
        LEFT JOIN capacity_data c ON l.park_id = c.park_id
        GROUP BY l.district
        ORDER BY carpark_count DESC
      `);

      // ===== Utilization by Size =====
      const sizeUtilResult = await client.query(`
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
            v.vacancy,
            c.max_capacity,
            CASE
              WHEN c.max_capacity < 50 THEN 'Small (0-49)'
              WHEN c.max_capacity < 100 THEN 'Medium (50-99)'
              WHEN c.max_capacity < 200 THEN 'Large (100-199)'
              ELSE 'Very Large (200+)'
            END as size_category
          FROM parking_vacancy_snapshots v
          JOIN capacity_data c ON v.park_id = c.park_id
          WHERE v.vehicle_type = 'privateCar'
            AND v.is_valid = true
          ORDER BY v.park_id, v.ingested_at DESC
        )
        SELECT
          size_category,
          COUNT(*)::integer as carpark_count,
          ROUND(AVG(vacancy), 2) as avg_vacancy,
          ROUND(AVG(max_capacity), 0)::integer as avg_capacity,
          ROUND(AVG(CASE
            WHEN max_capacity > 0
            THEN 100.0 * (1 - vacancy / max_capacity)
            ELSE NULL
          END), 2) as avg_utilization_rate
        FROM latest_data
        GROUP BY size_category
        ORDER BY
          CASE size_category
            WHEN 'Small (0-49)' THEN 1
            WHEN 'Medium (50-99)' THEN 2
            WHEN 'Large (100-199)' THEN 3
            ELSE 4
          END
      `);

      await client.end();

      return NextResponse.json({
        success: true,
        filters: { district, sizeCategory, days },
        activity: activityResult.rows,
        quality: qualityResult.rows[0] || {},
        utilization: utilizationResult.rows,
        districtUtilization: districtUtilResult.rows,
        sizeUtilization: sizeUtilResult.rows,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
