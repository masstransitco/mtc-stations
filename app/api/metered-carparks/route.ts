import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MeteredCarpark } from '@/types/metered-carpark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Query parameters
    const district = searchParams.get('district');
    const minVacancy = searchParams.get('minVacancy');
    const limit = searchParams.get('limit');

    // Build query
    let query = supabase
      .from('latest_metered_carpark_occupancy')
      .select('*');

    // Apply filters
    if (district) {
      query = query.eq('district', district);
    }

    if (minVacancy) {
      query = query.gte('vacant_spaces', parseInt(minVacancy));
    }

    // Apply ordering (by vacancy rate descending, then by name)
    query = query.order('vacancy_rate', { ascending: false });

    // Apply limit if specified
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Metered Carparks API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ensure timestamps have timezone indicator (Z for UTC)
    const dataWithTimezone = (data as MeteredCarpark[]).map(carpark => ({
      ...carpark,
      last_updated: carpark.last_updated ? `${carpark.last_updated}Z` : null
    }));

    return NextResponse.json(dataWithTimezone, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('[Metered Carparks API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
