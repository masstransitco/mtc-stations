-- Fix: Allow null lastupdate values
-- Some carparks don't provide lastupdate timestamps, causing ingestion failures

ALTER TABLE parking_vacancy_snapshots
ALTER COLUMN lastupdate DROP NOT NULL;

-- Add a comment explaining this
COMMENT ON COLUMN parking_vacancy_snapshots.lastupdate IS 'Last update timestamp from carpark operator (nullable - some operators do not provide this)';
