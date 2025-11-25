import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { carpark_id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const carparkId = params.carpark_id;

    if (!carparkId) {
      return NextResponse.json(
        { error: 'Carpark ID is required' },
        { status: 400 }
      );
    }

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
      // Call the time series RPC function
      const result = await client.query(
        'SELECT get_metered_carpark_time_series($1, $2) as data',
        [carparkId, hours]
      );

      await client.end();

      const responseData = result.rows[0].data;

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      });

    } finally {
      if (client) {
        await client.end();
      }
    }

  } catch (error) {
    console.error('Metered carpark trend API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time series data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
