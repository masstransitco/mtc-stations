import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Metered Snapshots Cleanup] Starting cleanup of old snapshots...');

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_old_metered_snapshots');

    if (error) {
      console.error('[Metered Snapshots Cleanup] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 500 }
      );
    }

    const deletedCount = data && data.length > 0 ? data[0].deleted_count : 0;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      deleted_count: deletedCount
    };

    console.log('[Metered Snapshots Cleanup] Complete:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Metered Snapshots Cleanup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
