import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

const OCCUPANCY_CSV_URL = 'https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus';

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

interface OccupancyRecord {
  feature_id: number;
  parking_space_id: string;
  occupancy_status: string;
  occupancy_date_changed: string | null;
}

interface OccupancyStats {
  total_records: number;
  vacant_count: number;
  occupied_count: number;
  not_updated_count: number;
  valid_records: number;
  invalid_records: number;
  vacancy_rate: number;
}

/**
 * Parse date from DD/MM/YYYY HH:MM:SS format to ISO 8601
 */
function parseDateFromCSV(dateString: string): string | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  try {
    // Format: "16/11/2025 17:48:2" (DD/MM/YYYY HH:MM:SS)
    const parts = dateString.trim().split(' ');
    if (parts.length !== 2) return null;

    const [datePart, timePart] = parts;
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');

    // Create ISO date string
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    const paddedHour = hour.padStart(2, '0');
    const paddedMinute = minute.padStart(2, '0');
    const paddedSecond = second.padStart(2, '0');

    return `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinute}:${paddedSecond}+08:00`;
  } catch (error) {
    console.warn(`Failed to parse date: ${dateString}`, error);
    return null;
  }
}

/**
 * Fetch occupancy data from CSV API
 */
async function fetchOccupancyCSV(): Promise<OccupancyRecord[]> {
  console.log('Fetching occupancy data from:', OCCUPANCY_CSV_URL);

  const response = await fetch(OCCUPANCY_CSV_URL, {
    headers: {
      'Accept': 'text/csv',
    },
  });

  if (!response.ok) {
    throw new Error(`Occupancy API returned ${response.status}: ${response.statusText}`);
  }

  const csvText = await response.text();

  // Parse CSV: FeatureID,ParkingSpaceId,OccupancyStatus,OccupancyDateChanged
  const lines = csvText.split('\n').filter(line => line.trim());
  const records: OccupancyRecord[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 3) {
      console.warn(`Skipping malformed line ${i}: ${line}`);
      continue;
    }

    const [featureId, spaceId, status, dateChanged] = parts;

    records.push({
      feature_id: parseInt(featureId),
      parking_space_id: spaceId,
      occupancy_status: status,
      occupancy_date_changed: parseDateFromCSV(dateChanged),
    });
  }

  return records;
}

/**
 * Calculate statistics from occupancy records
 */
function calculateStats(records: OccupancyRecord[]): OccupancyStats {
  const vacant = records.filter(r => r.occupancy_status === 'V').length;
  const occupied = records.filter(r => r.occupancy_status === 'O').length;
  const notUpdated = records.filter(r => r.occupancy_status === 'NU').length;
  const valid = vacant + occupied;
  const invalid = notUpdated;

  return {
    total_records: records.length,
    vacant_count: vacant,
    occupied_count: occupied,
    not_updated_count: notUpdated,
    valid_records: valid,
    invalid_records: invalid,
    vacancy_rate: valid > 0 ? Math.round((vacant / valid) * 100 * 100) / 100 : 0,
  };
}

/**
 * Insert occupancy records in batches
 */
async function insertOccupancyRecords(records: OccupancyRecord[]): Promise<void> {
  const supabase = getSupabaseClient();
  const BATCH_SIZE = 100; // Smaller batches since we only have 145 spaces

  console.log(`Inserting ${records.length} records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('parking_space_occupancy_snapshots')
      .insert(batch);

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
      throw error;
    }

    console.log(`Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(records.length / BATCH_SIZE)}`);
  }
}

/**
 * Main cron handler
 * Runs every 5 minutes to fetch and store parking space occupancy data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚗 Starting parking space occupancy ingestion...');

    // Fetch CSV data
    const records = await fetchOccupancyCSV();
    console.log(`📊 Fetched ${records.length} occupancy records`);

    // Calculate statistics
    const stats = calculateStats(records);
    console.log('📈 Statistics:', stats);

    // Insert into database
    await insertOccupancyRecords(records);

    const duration = Date.now() - startTime;
    console.log(`✅ Ingestion completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      stats,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Ingestion failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}
