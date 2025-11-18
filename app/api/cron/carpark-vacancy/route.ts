import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { VacancyApiResponse, CarparkVacancy, VacancyRecord, VehicleType, ParkingVacancySnapshot } from '@/types/parking-vacancy';

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
 * Fetch parking vacancy data from Hong Kong Government API
 */
async function fetchVacancyData(): Promise<VacancyApiResponse> {
  const url = `${HK_GOV_API_URL}?data=vacancy&lang=en_US`;

  console.log('Fetching vacancy data from:', url);

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
 * Data quality statistics
 */
interface DataQualityStats {
  total_records: number;
  valid_records: number;
  offline_records: number;
  offline_percent: number;
  unique_carparks: number;
  carparks_with_valid_data: number;
  by_vacancy_type: {
    [key: string]: {
      total: number;
      offline: number;
      valid: number;
    };
  };
}

/**
 * Transform API response into database records and calculate quality stats
 */
function transformVacancyData(data: VacancyApiResponse): { records: ParkingVacancySnapshot[]; stats: DataQualityStats } {
  const records: ParkingVacancySnapshot[] = [];
  const ingestedAt = new Date().toISOString();

  // Track stats
  const parkIdsWithValidData = new Set<string>();
  const typeStats: { [key: string]: { total: number; offline: number; valid: number } } = {
    'A': { total: 0, offline: 0, valid: 0 },
    'B': { total: 0, offline: 0, valid: 0 },
    'C': { total: 0, offline: 0, valid: 0 },
  };

  for (const carpark of data.results) {
    const parkId = carpark.park_Id;

    // Process each vehicle type
    const vehicleTypes: VehicleType[] = ['privateCar', 'LGV', 'HGV', 'CV', 'coach', 'motorCycle'];

    for (const vehicleType of vehicleTypes) {
      const vacancyRecords = carpark[vehicleType] as VacancyRecord[] | undefined;

      if (vacancyRecords && vacancyRecords.length > 0) {
        for (const record of vacancyRecords) {
          const isValid = record.vacancy >= 0;

          records.push({
            park_id: parkId,
            vehicle_type: vehicleType,
            vacancy_type: record.vacancy_type,
            vacancy: record.vacancy,
            vacancy_dis: record.vacancyDIS ?? null,
            vacancy_ev: record.vacancyEV ?? null,
            vacancy_unl: record.vacancyUNL ?? null,
            category: record.category ?? null,
            lastupdate: record.lastupdate,
            ingested_at: ingestedAt,
          });

          // Track stats
          if (isValid) {
            parkIdsWithValidData.add(parkId);
          }

          const vType = record.vacancy_type;
          if (typeStats[vType]) {
            typeStats[vType].total++;
            if (isValid) {
              typeStats[vType].valid++;
            } else {
              typeStats[vType].offline++;
            }
          }
        }
      }
    }
  }

  const validRecords = records.filter(r => r.vacancy >= 0).length;
  const offlineRecords = records.filter(r => r.vacancy === -1).length;

  const stats: DataQualityStats = {
    total_records: records.length,
    valid_records: validRecords,
    offline_records: offlineRecords,
    offline_percent: records.length > 0 ? Math.round((offlineRecords / records.length) * 100 * 100) / 100 : 0,
    unique_carparks: new Set(records.map(r => r.park_id)).size,
    carparks_with_valid_data: parkIdsWithValidData.size,
    by_vacancy_type: typeStats,
  };

  return { records, stats };
}

/**
 * Insert vacancy records into Supabase
 */
async function insertVacancyRecords(records: ParkingVacancySnapshot[]): Promise<{ success: number; failed: number }> {
  const supabase = getSupabaseClient();

  // Insert in batches to avoid payload size limits
  const BATCH_SIZE = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('parking_vacancy_snapshots')
      .insert(batch);

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
 * GET handler for the cron job
 * Fetches parking vacancy data from HK Gov API and stores in Supabase
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

    console.log('Starting parking vacancy ingestion...');

    // Fetch data from HK Gov API
    const apiData = await fetchVacancyData();
    console.log(`Fetched data for ${apiData.results.length} car parks`);

    // Transform to database records and calculate quality stats
    const { records, stats } = transformVacancyData(apiData);
    console.log(`Transformed to ${records.length} vacancy records`);
    console.log('Data quality:', stats);

    // Insert into database
    const result = await insertVacancyRecords(records);

    // Refresh the materialized views to update real-time data
    console.log('Refreshing materialized views...');
    const supabase = getSupabaseClient();
    const { error: refreshError } = await supabase.rpc('refresh_latest_parking_vacancy');

    if (refreshError) {
      console.error('Error refreshing materialized views:', refreshError);
      // Don't fail the entire job if refresh fails
    } else {
      console.log('Materialized views refreshed successfully');
    }

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      carparks: apiData.results.length,
      records: records.length,
      inserted: result.success,
      failed: result.failed,
      data_quality: {
        valid_records: stats.valid_records,
        offline_records: stats.offline_records,
        offline_percent: stats.offline_percent,
        unique_carparks: stats.unique_carparks,
        carparks_with_valid_data: stats.carparks_with_valid_data,
        by_vacancy_type: stats.by_vacancy_type,
      },
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    console.log('Ingestion complete:', response);

    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Ingestion failed:', error);

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
