import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Extend Vercel function timeout to 60 seconds (default is 10s)
// This ensures trending cache refresh completes after data ingestion
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse date from government CSV format: "11/17/2025 02:06:04 PM"
function parseDateFromCSV(dateStr: string): string {
  const [datePart, timePart, period] = dateStr.split(' ');
  const [month, day, year] = datePart.split('/');
  let [hours, minutes, seconds] = timePart.split(':');

  // Convert 12-hour to 24-hour format
  let hour = parseInt(hours);
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  // Pad with zeros
  const paddedHour = hour.toString().padStart(2, '0');
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  const paddedMinutes = minutes.padStart(2, '0');
  const paddedSeconds = seconds.padStart(2, '0');

  // Return ISO 8601 format with Hong Kong timezone
  return `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinutes}:${paddedSeconds}+08:00`;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Metered Occupancy Cron] Starting ingestion...');

    // Fetch occupancy data from government API
    const response = await fetch(
      'https://resource.data.one.gov.hk/td/psiparkingspaces/occupancystatus/occupancystatus.csv',
      {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MTCApp/1.0)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    // Skip header row
    const dataLines = lines.slice(1);

    console.log(`[Metered Occupancy Cron] Received ${dataLines.length} occupancy records`);

    // Parse CSV data
    const occupancyRecords: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let vacantCount = 0;
    let occupiedCount = 0;

    for (const line of dataLines) {
      // Simple CSV parse (fields: ParkingSpaceId,ParkingMeterStatus,OccupancyStatus,OccupancyDateChanged)
      const [parkingSpaceId, meterStatus, occupancyStatus, dateChanged] = line.split(',').map(s => s.trim());

      if (!parkingSpaceId || !meterStatus || !occupancyStatus) {
        continue;
      }

      const isValid = meterStatus === 'N';
      const isVacant = occupancyStatus === 'V';

      if (isValid) {
        validCount++;
        if (isVacant) {
          vacantCount++;
        } else {
          occupiedCount++;
        }
      } else {
        invalidCount++;
      }

      occupancyRecords.push({
        parking_space_id: parkingSpaceId,
        meter_status: meterStatus,
        occupancy_status: occupancyStatus,
        occupancy_date_changed: dateChanged ? parseDateFromCSV(dateChanged) : null
      });
    }

    console.log(`[Metered Occupancy Cron] Parsed ${occupancyRecords.length} records`);
    console.log(`[Metered Occupancy Cron] Valid: ${validCount}, Invalid: ${invalidCount}`);
    console.log(`[Metered Occupancy Cron] Vacant: ${vacantCount}, Occupied: ${occupiedCount}`);

    // Batch insert into database (100 records per batch)
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < occupancyRecords.length; i += batchSize) {
      const batch = occupancyRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from('metered_space_occupancy_snapshots')
        .insert(batch);

      if (error) {
        console.error(`[Metered Occupancy Cron] Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }

      insertedCount += batch.length;
    }

    console.log(`[Metered Occupancy Cron] Inserted ${insertedCount} records`);

    // Update has_real_time_tracking flag for spaces we received data for
    const spaceIds = occupancyRecords.map(r => r.parking_space_id);
    const uniqueSpaceIds = [...new Set(spaceIds)];

    // Batch update tracking flags to avoid URI too large error (500 IDs per batch)
    const updateBatchSize = 500;
    let updatedCount = 0;

    for (let i = 0; i < uniqueSpaceIds.length; i += updateBatchSize) {
      const batch = uniqueSpaceIds.slice(i, i + updateBatchSize);

      const { error: updateError } = await supabase
        .from('metered_space_info')
        .update({ has_real_time_tracking: true })
        .in('parking_space_id', batch);

      if (updateError) {
        console.error(`[Metered Occupancy Cron] Error updating tracking flags batch ${i / updateBatchSize + 1}:`, updateError);
      } else {
        updatedCount += batch.length;
      }
    }

    console.log(`[Metered Occupancy Cron] Updated tracking flags for ${updatedCount} spaces`);

    // Refresh core metered occupancy materialized view
    console.log('[Metered Occupancy Cron] Refreshing core occupancy view...');
    const { error: refreshError } = await supabase.rpc('refresh_latest_metered_carpark_occupancy');

    if (refreshError) {
      console.error('[Metered Occupancy Cron] Error refreshing occupancy view:', refreshError);
    } else {
      console.log('[Metered Occupancy Cron] Core occupancy view refreshed successfully');
    }

    // Refresh metered carparks trending cache only (with position tracking)
    // Note: Only refresh trending for metered carparks here to keep vacancy/ranking in sync
    console.log('[Metered Occupancy Cron] Refreshing metered carparks trending cache...');
    const { error: trendingError } = await supabase.rpc('refresh_trending_metered_carparks_with_tracking');

    if (trendingError) {
      console.warn('[Metered Occupancy Cron] Trending metered carparks cache refresh failed:', trendingError);
      // Don't fail the entire job if trending refresh fails
    } else {
      console.log('[Metered Occupancy Cron] Trending metered carparks cache refreshed successfully');
    }

    // Capture exhaustive ranking snapshot for historical analysis
    console.log('[Metered Occupancy Cron] Capturing ranking snapshot...');
    const { data: snapshotId, error: snapshotError } = await supabase.rpc('capture_metered_carpark_ranking_snapshot');

    if (snapshotError) {
      console.warn('[Metered Occupancy Cron] Ranking snapshot capture failed:', snapshotError);
      // Don't fail the entire job if snapshot capture fails
    } else {
      console.log('[Metered Occupancy Cron] Ranking snapshot captured:', snapshotId);
    }

    // Calculate vacancy rate
    const vacancyRate = validCount > 0 ? Math.round((vacantCount / validCount) * 100) : 0;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      total_records: occupancyRecords.length,
      valid_records: validCount,
      invalid_records: invalidCount,
      vacant_count: vacantCount,
      occupied_count: occupiedCount,
      vacancy_rate: vacancyRate,
      inserted: insertedCount
    };

    console.log('[Metered Occupancy Cron] Complete:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Metered Occupancy Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
