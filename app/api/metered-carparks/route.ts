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
    const carparkId = searchParams.get('carpark_id');
    const district = searchParams.get('district');
    const minVacancy = searchParams.get('minVacancy');
    const limit = searchParams.get('limit');

    // Build query
    let query = supabase
      .from('latest_metered_carpark_occupancy')
      .select('*');

    // Apply filters
    if (carparkId) {
      query = query.eq('carpark_id', carparkId);
    }

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

    // Use no-store cache for specific carpark lookups (real-time)
    // Use normal caching for list views
    const cacheControl = carparkId
      ? 'no-store'
      : 'public, s-maxage=60, stale-while-revalidate=120';

    return NextResponse.json(dataWithTimezone, {
      headers: {
        'Cache-Control': cacheControl
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
