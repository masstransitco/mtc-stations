-- Migration: Ingestion Logs Table
-- Description: Track data ingestion history for monitoring and debugging
-- Date: 2025-11-26

-- ============================================================================
-- 1. INGESTION LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingestion_logs (
  id BIGSERIAL PRIMARY KEY,

  -- Identification
  trace_id VARCHAR(50) NOT NULL,
  service VARCHAR(100) NOT NULL,  -- 'carpark-vacancy', 'metered-occupancy', etc.

  -- Status
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Data Quality Metrics
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  offline_records INTEGER NOT NULL DEFAULT 0,
  inserted_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,

  -- Quality Indicators
  offline_percent NUMERIC(5,2),
  failure_rate NUMERIC(5,4),

  -- Warnings
  warnings TEXT[],

  -- Additional metadata (JSON for flexibility)
  metadata JSONB
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Query by service and time
CREATE INDEX idx_ingestion_logs_service_time
ON ingestion_logs(service, started_at DESC);

-- Query recent logs
CREATE INDEX idx_ingestion_logs_started_at
ON ingestion_logs(started_at DESC);

-- Query failures
CREATE INDEX idx_ingestion_logs_success
ON ingestion_logs(success) WHERE success = false;

-- ============================================================================
-- 3. RPC FUNCTION TO LOG INGESTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_ingestion(
  p_trace_id VARCHAR(50),
  p_service VARCHAR(100),
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_total_records INTEGER DEFAULT 0,
  p_valid_records INTEGER DEFAULT 0,
  p_offline_records INTEGER DEFAULT 0,
  p_inserted_records INTEGER DEFAULT 0,
  p_failed_records INTEGER DEFAULT 0,
  p_warnings TEXT[] DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offline_percent NUMERIC(5,2);
  v_failure_rate NUMERIC(5,4);
  v_id BIGINT;
BEGIN
  -- Calculate quality metrics
  v_offline_percent := CASE
    WHEN p_total_records > 0
    THEN ROUND((p_offline_records::NUMERIC / p_total_records) * 100, 2)
    ELSE 0
  END;

  v_failure_rate := CASE
    WHEN (p_inserted_records + p_failed_records) > 0
    THEN ROUND(p_failed_records::NUMERIC / (p_inserted_records + p_failed_records), 4)
    ELSE 0
  END;

  INSERT INTO ingestion_logs (
    trace_id,
    service,
    success,
    error_message,
    completed_at,
    duration_ms,
    total_records,
    valid_records,
    offline_records,
    inserted_records,
    failed_records,
    offline_percent,
    failure_rate,
    warnings,
    metadata
  ) VALUES (
    p_trace_id,
    p_service,
    p_success,
    p_error_message,
    NOW(),
    p_duration_ms,
    p_total_records,
    p_valid_records,
    p_offline_records,
    p_inserted_records,
    p_failed_records,
    v_offline_percent,
    v_failure_rate,
    p_warnings,
    p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- 4. VIEW FOR RECENT INGESTION SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW ingestion_summary AS
SELECT
  service,
  COUNT(*) as total_runs,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_runs,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_runs,
  ROUND(AVG(duration_ms)::numeric, 0) as avg_duration_ms,
  ROUND(AVG(total_records)::numeric, 0) as avg_records,
  ROUND(AVG(offline_percent)::numeric, 2) as avg_offline_percent,
  MAX(started_at) as last_run
FROM ingestion_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY service
ORDER BY last_run DESC;

-- ============================================================================
-- 5. CLEANUP FUNCTION (keep 7 days of logs)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ingestion_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ingestion_logs
  WHERE started_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT SELECT ON ingestion_logs TO anon;
GRANT SELECT ON ingestion_summary TO anon;
GRANT EXECUTE ON FUNCTION log_ingestion TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_ingestion_logs TO service_role;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE ingestion_logs IS 'Tracks data ingestion history for monitoring';
COMMENT ON VIEW ingestion_summary IS '24-hour summary of ingestion runs by service';
COMMENT ON FUNCTION log_ingestion IS 'Record an ingestion run with quality metrics';
COMMENT ON FUNCTION cleanup_old_ingestion_logs IS 'Remove logs older than 7 days';
