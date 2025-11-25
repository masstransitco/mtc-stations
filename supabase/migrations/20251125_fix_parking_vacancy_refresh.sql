-- Fix: Update refresh function to refresh all dependent materialized views
-- Issue: The original refresh function only refreshed latest_parking_vacancy,
-- but dependent views also need refreshing
-- Note: trending_carparks_cache is NOT refreshed here - it only stores rankings (park_id + activity_score)
--       and is refreshed separately via refresh_trending_carparks()

CREATE OR REPLACE FUNCTION refresh_latest_parking_vacancy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set a longer statement timeout for this operation (60 seconds)
  SET LOCAL statement_timeout = '60s';

  -- Refresh the base materialized view
  REFRESH MATERIALIZED VIEW latest_parking_vacancy;

  -- Refresh dependent materialized views in order
  REFRESH MATERIALIZED VIEW latest_valid_parking_vacancy;
  REFRESH MATERIALIZED VIEW latest_vacancy_with_location;

  -- Note: trending_carparks_cache refresh is separate - it only stores rankings,
  -- and vacancy data is fetched live at query time

  -- Reset to default timeout
  RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail completely
  RAISE WARNING 'Error refreshing parking vacancy views: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_latest_parking_vacancy() IS
  'Refreshes latest_parking_vacancy and all dependent materialized views (latest_valid_parking_vacancy, latest_vacancy_with_location). Called by cron job every 5 minutes.';
