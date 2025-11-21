import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district') || null;
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'capacity';

    const { Client } = await import('pg');
    const client = new Client({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: `postgres.${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', '')}`,
      password: process.env.POSTGRES_PASSWORD,
      database: 'postgres',
      ssl: {
        rejectUnauthorized: false,
      },
    });
    await client.connect();

    try {
      // Call the optimized RPC function
      const result = await client.query(
        'SELECT get_carpark_analytics($1, $2, $3, $4) as data',
        [days, district, limit, sortBy]
      );

      await client.end();

      // The RPC function returns JSON directly
      const responseData = result.rows[0].data;

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });

    } finally {
      if (client) {
        await client.end();
      }
    }

  } catch (error) {
    console.error('Carparks API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carpark data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
