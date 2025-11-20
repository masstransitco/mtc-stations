import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timePeriod = searchParams.get('timePeriod') || '30d';

    const response = await fetch(
      `https://noah.air.city/api/vehicles/status?timePeriod=${timePeriod}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Disable caching for fresh data
      }
    );

    if (!response.ok) {
      throw new Error(`Noah API responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from Noah API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicles from Noah API' },
      { status: 500 }
    );
  }
}
