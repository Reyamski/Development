import { getConnection } from './connection-manager.js';

/**
 * Query dba schema for long-running queries and performance metrics.
 * Tables: events_statements_summary_by_digest_history, query_latency_history
 * Safe: read-only, no writes. Returns empty on error (e.g. schema doesn't exist).
 */

const PICOSEC_TO_SEC = 1e12;

async function getDbTimeOffset(): Promise<{ offsetMs: number; jsNow: Date }> {
  const conn = getConnection();
  const [timeRows] = await conn.query('SELECT NOW() as db_now');
  const dbNow = new Date((timeRows as any[])[0].db_now);
  const jsNow = new Date();
  return { offsetMs: dbNow.getTime() - jsNow.getTime(), jsNow };
}

function toUiIso(value: unknown, offsetMs: number): string | null {
  if (!value) return null;
  const dbDate = new Date(value as string | number | Date);
  if (Number.isNaN(dbDate.getTime())) return null;
  return new Date(dbDate.getTime() - offsetMs).toISOString();
}

export interface DbaSlowQuery {
  schemaName: string;
  digestText: string;
  querySampleText: string | null;
  countStar: number;
  avgDurationSeconds: number;
  maxDurationSeconds: number;
  sumRowsExamined: number;
  sumRowsAffected: number;
  sumNoIndexUsed: number;
  asOfDate: string | null;
}

export interface DbaQueryLatency {
  snapshotTime: string;
  queryType: string;
  tableName: string;
  histogramLatency: number;
}

export interface DbaDebugInfo {
  schemaAccessible: boolean;
  digestHistoryTableExists: boolean;
  queryLatencyTableExists: boolean;
  lastAsOfDate: string | null;
  source: 'query_sample_text' | 'digest_text_fallback' | 'none';
  rowCount: number;
  error: string | null;
}

export interface DbaSlowQueryResult {
  dbaSlowQueries: DbaSlowQuery[];
  dbaDebug: DbaDebugInfo;
}

async function resolveSnapshotAsOfDate(offsetMs: number, since?: Date, until?: Date): Promise<string | null> {
  const conn = getConnection();

  if (since && until) {
    const dbSince = new Date(since.getTime() + offsetMs);
    const dbUntil = new Date(until.getTime() + offsetMs);
    const [rows] = await conn.query(`
      SELECT MAX(AsOfDate) AS max_asof
      FROM dba.events_statements_summary_by_digest_history
      WHERE AsOfDate >= ? AND AsOfDate <= ?
    `, [dbSince, dbUntil]);
    return (rows as any[])[0]?.max_asof ?? null;
  }

  const [rows] = await conn.query(`
    SELECT MAX(AsOfDate) AS max_asof
    FROM dba.events_statements_summary_by_digest_history
  `);
  return (rows as any[])[0]?.max_asof ?? null;
}

function mapSlowQueryRows(rows: any[], withSample: boolean, offsetMs: number): DbaSlowQuery[] {
  return rows.map(r => ({
    schemaName: r.SCHEMA_NAME ?? '',
    digestText: r.DIGEST_TEXT ?? '',
    querySampleText: withSample ? (r.QUERY_SAMPLE_TEXT ?? null) : null,
    countStar: Number(r.COUNT_STAR ?? 0),
    avgDurationSeconds: Number(r.AVG_SEC ?? 0),
    maxDurationSeconds: Number(r.MAX_SEC ?? 0),
    sumRowsExamined: Number(r.SUM_ROWS_EXAMINED ?? 0),
    sumRowsAffected: Number(r.SUM_ROWS_AFFECTED ?? 0),
    sumNoIndexUsed: Number(r.SUM_NO_INDEX_USED ?? 0),
    asOfDate: toUiIso(r.AsOfDate, offsetMs),
  }));
}

/**
 * Get top slow queries from dba.events_statements_summary_by_digest_history.
 * Uses the latest snapshot inside the selected range when provided.
 * TIMER columns are in picoseconds.
 */
export async function getDbaSlowQueries(limit = 10, since?: Date, until?: Date): Promise<DbaSlowQuery[]> {
  const conn = getConnection();
  try {
    const { offsetMs } = await getDbTimeOffset();
    const snapshotAsOfDate = await resolveSnapshotAsOfDate(offsetMs, since, until);
    if (!snapshotAsOfDate) return [];

    const [rows] = await conn.query(`
      SELECT /*+ MAX_EXECUTION_TIME(5000) */
        SCHEMA_NAME,
        LEFT(DIGEST_TEXT, 500) AS DIGEST_TEXT,
        LEFT(QUERY_SAMPLE_TEXT, 500) AS QUERY_SAMPLE_TEXT,
        COUNT_STAR,
        ROUND(AVG_TIMER_WAIT / ${PICOSEC_TO_SEC}, 1) AS AVG_SEC,
        ROUND(MAX_TIMER_WAIT / ${PICOSEC_TO_SEC}, 1) AS MAX_SEC,
        SUM_ROWS_EXAMINED,
        SUM_ROWS_AFFECTED,
        SUM_NO_INDEX_USED,
        AsOfDate
      FROM dba.events_statements_summary_by_digest_history
      WHERE AsOfDate = ?
        AND DIGEST_TEXT IS NOT NULL
        AND DIGEST_TEXT NOT LIKE 'SHOW%'
      ORDER BY MAX_TIMER_WAIT DESC
      LIMIT ?
    `, [snapshotAsOfDate, limit]);

    return mapSlowQueryRows(rows as any[], true, offsetMs);
  } catch {
    return [];
  }
}

/**
 * Fallback when QUERY_SAMPLE_TEXT column doesn't exist (older schema).
 */
export async function getDbaSlowQueriesFallback(limit = 10, since?: Date, until?: Date): Promise<DbaSlowQuery[]> {
  const conn = getConnection();
  try {
    const { offsetMs } = await getDbTimeOffset();
    const snapshotAsOfDate = await resolveSnapshotAsOfDate(offsetMs, since, until);
    if (!snapshotAsOfDate) return [];

    const [rows] = await conn.query(`
      SELECT /*+ MAX_EXECUTION_TIME(5000) */
        SCHEMA_NAME,
        LEFT(DIGEST_TEXT, 500) AS DIGEST_TEXT,
        COUNT_STAR,
        ROUND(AVG_TIMER_WAIT / ${PICOSEC_TO_SEC}, 1) AS AVG_SEC,
        ROUND(MAX_TIMER_WAIT / ${PICOSEC_TO_SEC}, 1) AS MAX_SEC,
        SUM_ROWS_EXAMINED,
        SUM_ROWS_AFFECTED,
        SUM_NO_INDEX_USED,
        AsOfDate
      FROM dba.events_statements_summary_by_digest_history
      WHERE AsOfDate = ?
        AND DIGEST_TEXT IS NOT NULL
        AND DIGEST_TEXT NOT LIKE 'SHOW%'
      ORDER BY MAX_TIMER_WAIT DESC
      LIMIT ?
    `, [snapshotAsOfDate, limit]);

    return mapSlowQueryRows(rows as any[], false, offsetMs);
  } catch {
    return [];
  }
}

/**
 * Get query latency history from dba.query_latency_history for recent snapshots.
 */
export async function getDbaQueryLatency(since: Date, limit = 20): Promise<DbaQueryLatency[]> {
  const conn = getConnection();
  try {
    const { offsetMs } = await getDbTimeOffset();
    const dbSince = new Date(since.getTime() + offsetMs);
    const [rows] = await conn.query(`
      SELECT /*+ MAX_EXECUTION_TIME(5000) */
        snapshot_time,
        query_type,
        table_name,
        histogram_latency
      FROM dba.query_latency_history
      WHERE snapshot_time >= ?
      ORDER BY histogram_latency DESC
      LIMIT ?
    `, [dbSince, limit]);

    return (rows as any[]).map(r => ({
      snapshotTime: toUiIso(r.snapshot_time, offsetMs) ?? '',
      queryType: r.query_type ?? '',
      tableName: r.table_name ?? '',
      histogramLatency: Number(r.histogram_latency ?? 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Combined fetch: try slow queries with QUERY_SAMPLE_TEXT first, fallback to basic columns if that fails.
 */
export async function getDbaSlowQueriesSafe(limit = 10, since?: Date, until?: Date): Promise<DbaSlowQuery[]> {
  try {
    const result = await getDbaSlowQueries(limit, since, until);
    if (result.length > 0) return result;
  } catch {
    // QUERY_SAMPLE_TEXT column may not exist
  }
  return getDbaSlowQueriesFallback(limit, since, until);
}

/**
 * Fetch slow queries with explicit debug metadata so UI can explain empty results.
 */
export async function getDbaSlowQueriesWithDebug(limit = 10, since?: Date, until?: Date): Promise<DbaSlowQueryResult> {
  const conn = getConnection();
  let offsetMs = 0;
  const debug: DbaDebugInfo = {
    schemaAccessible: false,
    digestHistoryTableExists: false,
    queryLatencyTableExists: false,
    lastAsOfDate: null,
    source: 'none',
    rowCount: 0,
    error: null,
  };

  try {
    const [tableRows] = await conn.query(`
      SELECT TABLE_NAME
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = 'dba'
        AND TABLE_NAME IN ('events_statements_summary_by_digest_history', 'query_latency_history')
    `);
    const tableNames = new Set((tableRows as any[]).map(r => String(r.TABLE_NAME)));
    debug.schemaAccessible = true;
    debug.digestHistoryTableExists = tableNames.has('events_statements_summary_by_digest_history');
    debug.queryLatencyTableExists = tableNames.has('query_latency_history');
  } catch (err: any) {
    debug.error = `information_schema check failed: ${err.message ?? 'unknown error'}`;
    return { dbaSlowQueries: [], dbaDebug: debug };
  }

  if (!debug.digestHistoryTableExists) {
    debug.error = 'dba.events_statements_summary_by_digest_history table not found';
    return { dbaSlowQueries: [], dbaDebug: debug };
  }

  try {
    ({ offsetMs } = await getDbTimeOffset());
    const maxAsOf = await resolveSnapshotAsOfDate(offsetMs, since, until);
    debug.lastAsOfDate = toUiIso(maxAsOf, offsetMs);
  } catch (err: any) {
    debug.error = `failed to read latest AsOfDate: ${err.message ?? 'unknown error'}`;
    return { dbaSlowQueries: [], dbaDebug: debug };
  }

  try {
    const dbaSlowQueries = await getDbaSlowQueries(limit, since, until);
    if (dbaSlowQueries.length > 0) {
      debug.source = 'query_sample_text';
      debug.rowCount = dbaSlowQueries.length;
      return { dbaSlowQueries, dbaDebug: debug };
    }
  } catch (err: any) {
    debug.error = `QUERY_SAMPLE_TEXT query failed: ${err.message ?? 'unknown error'}`;
  }

  try {
    const dbaSlowQueries = await getDbaSlowQueriesFallback(limit, since, until);
    debug.source = dbaSlowQueries.length > 0 ? 'digest_text_fallback' : 'none';
    debug.rowCount = dbaSlowQueries.length;
    if (dbaSlowQueries.length === 0 && !debug.error) {
      debug.error = since && until
        ? 'No rows returned for a DBA snapshot inside the selected time range'
        : 'No rows returned for latest AsOfDate snapshot';
    }
    return { dbaSlowQueries, dbaDebug: debug };
  } catch (err: any) {
    debug.error = debug.error
      ? `${debug.error}; fallback failed: ${err.message ?? 'unknown error'}`
      : `fallback query failed: ${err.message ?? 'unknown error'}`;
    return { dbaSlowQueries: [], dbaDebug: debug };
  }
}
