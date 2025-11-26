import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { withCronAuth } from '@/lib/cron-auth';
import {
  createLogger,
  checkDataQuality,
  PARKING_VACANCY_THRESHOLDS,
} from '@/lib/logger';
import type {
  VacancyApiResponse,
  VacancyRecord,
  VehicleType,
  ParkingVacancySnapshot,
} from '@/types/parking-vacancy';

// Extend Vercel function timeout to 60 seconds (default is 10s)
export const maxDuration = 60;

const HK_GOV_API_URL = 'https://api.data.gov.hk/v1/carpark-info-vacancy';
const SERVICE_NAME = 'carpark-vacancy';

/**
 * Fetch parking vacancy data from Hong Kong Government API
 */
async function fetchVacancyData(): Promise<VacancyApiResponse> {
  const url = `${HK_GOV_API_URL}?data=vacancy&lang=en_US`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
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
function transformVacancyData(data: VacancyApiResponse): {
  records: ParkingVacancySnapshot[];
  stats: DataQualityStats;
} {
  const records: ParkingVacancySnapshot[] = [];
  const ingestedAt = new Date().toISOString();

  // Track stats
  const parkIdsWithValidData = new Set<string>();
  const typeStats: { [key: string]: { total: number; offline: number; valid: number } } = {
    A: { total: 0, offline: 0, valid: 0 },
    B: { total: 0, offline: 0, valid: 0 },
    C: { total: 0, offline: 0, valid: 0 },
  };

  for (const carpark of data.results) {
    const parkId = carpark.park_Id;

    // Process each vehicle type
    const vehicleTypes: VehicleType[] = [
      'privateCar',
      'LGV',
      'HGV',
      'CV',
      'coach',
      'motorCycle',
    ];

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

  const validRecords = records.filter((r) => r.vacancy >= 0).length;
  const offlineRecords = records.filter((r) => r.vacancy === -1).length;

  const stats: DataQualityStats = {
    total_records: records.length,
    valid_records: validRecords,
    offline_records: offlineRecords,
    offline_percent:
      records.length > 0
        ? Math.round((offlineRecords / records.length) * 100 * 100) / 100
        : 0,
    unique_carparks: new Set(records.map((r) => r.park_id)).size,
    carparks_with_valid_data: parkIdsWithValidData.size,
    by_vacancy_type: typeStats,
  };

  return { records, stats };
}

/**
 * Insert vacancy records into Supabase
 */
async function insertVacancyRecords(
  records: ParkingVacancySnapshot[]
): Promise<{ success: number; failed: number }> {
  const supabase = getServerSupabaseClient('service');

  // Insert in batches to avoid payload size limits
  const BATCH_SIZE = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from('parking_vacancy_snapshots').insert(batch);

    if (error) {
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
export const GET = withCronAuth(async (request: NextRequest) => {
  const logger = createLogger({ service: SERVICE_NAME });
  const supabase = getServerSupabaseClient('service');

  try {
    logger.info('Starting parking vacancy ingestion');

    // Fetch data from HK Gov API
    const apiData = await fetchVacancyData();
    logger.info('Fetched data from HK Gov API', {
      carparks: apiData.results.length,
    });

    // Transform to database records and calculate quality stats
    const { records, stats } = transformVacancyData(apiData);
    logger.info('Transformed vacancy data', {
      records: records.length,
      validRecords: stats.valid_records,
      offlineRecords: stats.offline_records,
      offlinePercent: stats.offline_percent,
    });

    // Insert into database
    const result = await insertVacancyRecords(records);
    logger.info('Inserted records', {
      inserted: result.success,
      failed: result.failed,
    });

    // Check data quality against thresholds
    const qualityCheck = checkDataQuality(
      {
        totalRecords: stats.total_records,
        validRecords: stats.valid_records,
        offlineRecords: stats.offline_records,
        insertedRecords: result.success,
        failedRecords: result.failed,
      },
      PARKING_VACANCY_THRESHOLDS
    );

    if (!qualityCheck.ok) {
      for (const warning of qualityCheck.warnings) {
        logger.warn('Data quality warning', { warning });
      }
    }

    // Refresh core vacancy materialized views
    logger.info('Refreshing core vacancy views');
    const { error: refreshError } = await supabase.rpc('refresh_latest_parking_vacancy');

    if (refreshError) {
      logger.error('Failed to refresh vacancy views', { error: refreshError.message });
    }

    // Refresh trending carparks cache
    logger.info('Refreshing trending carparks cache');
    const { error: trendingError } = await supabase.rpc(
      'refresh_trending_carparks_with_tracking'
    );

    if (trendingError) {
      logger.warn('Trending cache refresh failed', { error: trendingError.message });
    }

    // Log ingestion to database
    await supabase.rpc('log_ingestion', {
      p_trace_id: logger.getTraceId(),
      p_service: SERVICE_NAME,
      p_success: true,
      p_duration_ms: logger.getElapsedMs(),
      p_total_records: stats.total_records,
      p_valid_records: stats.valid_records,
      p_offline_records: stats.offline_records,
      p_inserted_records: result.success,
      p_failed_records: result.failed,
      p_warnings: qualityCheck.warnings.length > 0 ? qualityCheck.warnings : null,
      p_metadata: {
        carparks: apiData.results.length,
        by_vacancy_type: stats.by_vacancy_type,
      },
    });

    const response = {
      success: true,
      traceId: logger.getTraceId(),
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
        warnings: qualityCheck.warnings,
      },
      duration_ms: logger.getElapsedMs(),
      timestamp: new Date().toISOString(),
    };

    logger.info('Ingestion complete', response);

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Ingestion failed', { error: errorMessage });

    // Log failed ingestion
    await supabase.rpc('log_ingestion', {
      p_trace_id: logger.getTraceId(),
      p_service: SERVICE_NAME,
      p_success: false,
      p_error_message: errorMessage,
      p_duration_ms: logger.getElapsedMs(),
    });

    return NextResponse.json(
      {
        success: false,
        traceId: logger.getTraceId(),
        error: errorMessage,
        duration_ms: logger.getElapsedMs(),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
