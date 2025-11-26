/**
 * Structured Logger for Cron Jobs and API Routes
 *
 * Outputs JSON logs that can be parsed by log aggregation tools.
 * In production (Vercel), these appear in the Function Logs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Unique identifier for this operation (e.g., job run) */
  traceId?: string;
  /** Service/route name */
  service: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

/**
 * Creates a structured logger with consistent formatting
 */
export function createLogger(context: LogContext) {
  const traceId = context.traceId || generateTraceId();
  const startTime = Date.now();

  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: context.service,
      message,
      traceId,
      durationMs: Date.now() - startTime,
      ...(data && { data }),
    };

    // Output as JSON for structured logging
    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),

    /** Get the trace ID for this logger instance */
    getTraceId: () => traceId,

    /** Get elapsed time since logger creation */
    getElapsedMs: () => Date.now() - startTime,
  };
}

/**
 * Generate a short trace ID for correlating log entries
 */
function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Data quality thresholds for alerting
 */
export interface DataQualityThresholds {
  /** Minimum expected records per ingestion */
  minRecords: number;
  /** Maximum allowed offline/invalid percentage */
  maxOfflinePercent: number;
  /** Maximum allowed failure rate for batch inserts */
  maxFailureRate: number;
}

/**
 * Default thresholds for parking vacancy data
 */
export const PARKING_VACANCY_THRESHOLDS: DataQualityThresholds = {
  minRecords: 100,        // Expect at least 100 records
  maxOfflinePercent: 50,  // Alert if >50% offline (normal is ~37%)
  maxFailureRate: 0.05,   // Alert if >5% insert failures
};

/**
 * Default thresholds for metered occupancy data
 */
export const METERED_OCCUPANCY_THRESHOLDS: DataQualityThresholds = {
  minRecords: 1000,       // Expect at least 1000 records
  maxOfflinePercent: 30,  // Alert if >30% invalid meters
  maxFailureRate: 0.05,   // Alert if >5% insert failures
};

/**
 * Check data quality against thresholds and return warnings
 */
export function checkDataQuality(
  stats: {
    totalRecords: number;
    validRecords: number;
    offlineRecords: number;
    insertedRecords: number;
    failedRecords: number;
  },
  thresholds: DataQualityThresholds
): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check minimum records
  if (stats.totalRecords < thresholds.minRecords) {
    warnings.push(
      `Low record count: ${stats.totalRecords} < ${thresholds.minRecords} expected`
    );
  }

  // Check offline percentage
  const offlinePercent = stats.totalRecords > 0
    ? (stats.offlineRecords / stats.totalRecords) * 100
    : 0;
  if (offlinePercent > thresholds.maxOfflinePercent) {
    warnings.push(
      `High offline rate: ${offlinePercent.toFixed(1)}% > ${thresholds.maxOfflinePercent}% threshold`
    );
  }

  // Check failure rate
  const totalAttempted = stats.insertedRecords + stats.failedRecords;
  const failureRate = totalAttempted > 0
    ? stats.failedRecords / totalAttempted
    : 0;
  if (failureRate > thresholds.maxFailureRate) {
    warnings.push(
      `High failure rate: ${(failureRate * 100).toFixed(1)}% > ${(thresholds.maxFailureRate * 100)}% threshold`
    );
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}
