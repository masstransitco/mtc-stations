import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { CarparkInfo } from '@/types/parking-vacancy';

const HK_GOV_API_URL = 'https://api.data.gov.hk/v1/carpark-info-vacancy';

/**
 * Verify the cron secret to ensure only authorized requests
 * Supports both Vercel's automatic cron authentication and manual x-cron-secret header
 */
function verifyCronSecret(request: NextRequest): boolean {
  // Check for Vercel's automatic cron secret (sent in Authorization header)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && token === expectedSecret) {
      return true;
    }
  }

  // Also support manual x-cron-secret header for testing
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return cronSecret === expectedSecret;
}

/**
 * Fetch carpark info data from Hong Kong Government API
 */
async function fetchCarparkInfo(): Promise<{ results: CarparkInfo[] }> {
  const url = `${HK_GOV_API_URL}?data=info&lang=en_US`;

  console.log('Fetching carpark info from:', url);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HK Gov API returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Database record for carpark_info table
 */
interface CarparkInfoRecord {
  park_id: string;
  name: string;
  display_address: string;
  latitude: number;
  longitude: number;
  district: string | null;
  nature: string | null;
  carpark_type: string | null;
  opening_status: string | null;
  contact_no: string | null;
  website: string | null;
}

/**
 * Transform API response into database records
 */
function transformCarparkInfo(data: { results: CarparkInfo[] }): CarparkInfoRecord[] {
  const records: CarparkInfoRecord[] = [];

  for (const carpark of data.results) {
    records.push({
      park_id: carpark.park_Id,
      name: carpark.name || 'Unknown',
      display_address: carpark.displayAddress || '',
      latitude: carpark.latitude,
      longitude: carpark.longitude,
      district: carpark.district || null,
      nature: carpark.nature || null,
      carpark_type: carpark.carpark_Type || null,
      opening_status: carpark.opening_status || null,
      contact_no: carpark.contactNo || null,
      website: carpark.website || null,
    });
  }

  return records;
}

/**
 * Upsert carpark info records into Supabase
 * Uses ON CONFLICT to update existing records
 */
async function upsertCarparkInfo(records: CarparkInfoRecord[]): Promise<{ success: number; failed: number }> {
  const supabase = getSupabaseClient();

  let success = 0;
  let failed = 0;

  // Upsert records one by one or in small batches
  // We use upsert to handle updates to existing carparks
  const BATCH_SIZE = 100;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('carpark_info')
      .upsert(batch, {
        onConflict: 'park_id',
        ignoreDuplicates: false, // Update existing records
      });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
      failed += batch.length;
    } else {
      success += batch.length;
    }
  }

  return { success, failed };
}

/**
 * GET handler for the carpark info ingestion
 * Fetches carpark information from HK Gov API and stores in Supabase
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      console.error('Unauthorized cron request - invalid secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting carpark info ingestion...');

    // Fetch data from HK Gov API
    const apiData = await fetchCarparkInfo();
    console.log(`Fetched info for ${apiData.results.length} car parks`);

    // Transform to database records
    const records = transformCarparkInfo(apiData);
    console.log(`Transformed to ${records.length} carpark info records`);

    // Upsert into database
    const result = await upsertCarparkInfo(records);

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      carparks: apiData.results.length,
      records: records.length,
      upserted: result.success,
      failed: result.failed,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Carpark info ingestion complete:', response);

    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Carpark info ingestion failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
