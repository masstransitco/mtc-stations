-- Fix: Update metered refresh function to refresh all dependent materialized views
-- Note: trending_metered_carparks_cache is NOT refreshed here - it only stores rankings (carpark_id + activity_score)
--       and is refreshed separately via refresh_trending_metered_carparks()

CREATE OR REPLACE FUNCTION refresh_latest_metered_carpark_occupancy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set a longer statement timeout for this operation (60 seconds)
  SET LOCAL statement_timeout = '60s';

  -- Refresh the main materialized view
  REFRESH MATERIALIZED VIEW latest_metered_carpark_occupancy;

  -- Note: trending_metered_carparks_cache refresh is separate - it only stores rankings,
  -- and vacancy data is fetched live at query time

  -- Reset to default timeout
  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail completely
  RAISE WARNING 'Error refreshing metered carpark views: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_latest_metered_carpark_occupancy() IS
  'Refreshes latest_metered_carpark_occupancy. Called by cron job every 5 minutes.';
