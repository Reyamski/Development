import { DatabaseChange, QueryDigestChange, SchemaChange } from '../types.js';
import { getConnection, getActiveSession } from './connection-manager.js';

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

/**
 * Fetch all database changes: query patterns, schema changes, and migrations.
 * Queries real dba schema via Teleport connection.
 */
export async function getDatabaseChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<DatabaseChange[]> {
  console.log(`Fetching database changes for ${dbInstance} from ${startTime} to ${endTime}`);
  
  // Check if we have an active connection
  const session = getActiveSession();
  if (!session || !session.connected) {
    console.warn('[database] No active Teleport connection. Returning empty results.');
    return [];
  }

  const changes: DatabaseChange[] = [];

  try {
    // 1. Get query digest changes
    const queryDigests = await getQueryDigestChanges(dbInstance, startTime, endTime);
    for (const digest of queryDigests) {
      if (digest.changeType === 'new' || digest.changeType === 'spike') {
        changes.push({
          id: `query-${digest.digest}`,
          timestamp: digest.firstSeen,
          changeType: 'query_pattern',
          database: digest.schema,
          table: digest.affectedTables[0],
          description: digest.changeType === 'new' 
            ? `New query pattern detected: ${digest.queryText.substring(0, 80)}...`
            : `Query spike detected: ${digest.comparisonMetric.percentChange.toFixed(0)}% increase in executions`,
          severity: digest.avgLatency > 1000 ? 'high' : digest.avgLatency > 100 ? 'medium' : 'low',
          details: {
            digest: digest.digest,
            queryText: digest.queryText,
            executionCount: digest.executionCount,
            avgLatency: digest.avgLatency,
          },
        });
      }
    }

    // 2. Get schema changes (from information_schema or dba.schema_history if exists)
    const schemaChanges = await getSchemaChanges(dbInstance, startTime, endTime);
    for (const schema of schemaChanges) {
      changes.push({
        id: `schema-${schema.table}-${schema.timestamp}`,
        timestamp: schema.timestamp,
        changeType: 'schema',
        database: 'detected',
        table: schema.table,
        description: `${schema.changeType} on table ${schema.table}`,
        severity: schema.changeType === 'DROP' ? 'high' : 'medium',
        details: {
          statement: schema.statement,
          changeType: schema.changeType,
        },
      });
    }

    // Sort by timestamp
    changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  } catch (error: any) {
    console.error('[database] Error fetching changes:', error.message);
  }

  return changes;
}

/**
 * Get query digest changes by comparing snapshots before and during the incident window.
 * Detects: new queries, query spikes (execution count increase)
 */
export async function getQueryDigestChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<QueryDigestChange[]> {
  console.log(`[database] Fetching query digest changes for ${dbInstance}`);
  
  const session = getActiveSession();
  if (!session || !session.connected) {
    return [];
  }

  try {
    const conn = getConnection();
    const { offsetMs } = await getDbTimeOffset();

    const start = new Date(startTime);
    const end = new Date(endTime);
    const dbStart = new Date(start.getTime() + offsetMs);
    const dbEnd = new Date(end.getTime() + offsetMs);

    // Query dba.events_statements_summary_by_digest_history for snapshots in the window
    const [rows] = await conn.query(`
      SELECT /*+ MAX_EXECUTION_TIME(10000) */
        DIGEST,
        SCHEMA_NAME,
        LEFT(DIGEST_TEXT, 500) AS DIGEST_TEXT,
        LEFT(QUERY_SAMPLE_TEXT, 500) AS QUERY_SAMPLE_TEXT,
        COUNT_STAR,
        ROUND(AVG_TIMER_WAIT / ${PICOSEC_TO_SEC}, 3) AS AVG_SEC,
        ROUND(SUM_TIMER_WAIT / ${PICOSEC_TO_SEC}, 3) AS SUM_SEC,
        AsOfDate,
        SUM_ROWS_EXAMINED,
        SUM_ROWS_AFFECTED
      FROM dba.events_statements_summary_by_digest_history
      WHERE AsOfDate >= ? AND AsOfDate <= ?
        AND DIGEST_TEXT IS NOT NULL
        AND DIGEST_TEXT NOT LIKE 'SHOW%'
        AND DIGEST_TEXT NOT LIKE 'SELECT VERSION%'
      ORDER BY AsOfDate ASC, SUM_TIMER_WAIT DESC
      LIMIT 100
    `, [dbStart, dbEnd]);

    // Group by digest and analyze changes
    const digestMap = new Map<string, any[]>();
    for (const row of rows as any[]) {
      const digest = row.DIGEST || '';
      if (!digestMap.has(digest)) {
        digestMap.set(digest, []);
      }
      digestMap.get(digest)!.push(row);
    }

    const changes: QueryDigestChange[] = [];

    for (const [digest, snapshots] of digestMap) {
      if (snapshots.length === 0) continue;

      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];

      const firstCount = Number(first.COUNT_STAR || 0);
      const lastCount = Number(last.COUNT_STAR || 0);
      const avgLatency = Number(last.AVG_SEC || 0) * 1000; // convert to ms

      // Detect if this is a new query or spike
      let changeType: 'new' | 'spike' | 'missing' = 'new';
      let percentChange = 100;

      if (snapshots.length > 1) {
        const countDiff = lastCount - firstCount;
        percentChange = firstCount > 0 ? (countDiff / firstCount) * 100 : 100;
        changeType = percentChange > 50 ? 'spike' : 'new';
      }

      // Only include new queries or significant spikes
      if (snapshots.length === 1 || percentChange > 50) {
        changes.push({
          digest,
          queryText: first.QUERY_SAMPLE_TEXT || first.DIGEST_TEXT || '',
          schema: first.SCHEMA_NAME || 'unknown',
          firstSeen: toUiIso(first.AsOfDate, offsetMs) || start.toISOString(),
          lastSeen: toUiIso(last.AsOfDate, offsetMs) || end.toISOString(),
          executionCount: lastCount,
          avgLatency,
          totalLatency: Number(last.SUM_SEC || 0) * 1000,
          affectedTables: extractTablesFromQuery(first.QUERY_SAMPLE_TEXT || first.DIGEST_TEXT || ''),
          changeType,
          comparisonMetric: {
            before: firstCount,
            after: lastCount,
            percentChange,
          },
        });
      }
    }

    // Sort by execution count descending (most impactful first)
    changes.sort((a, b) => b.executionCount - a.executionCount);

    return changes.slice(0, 20); // Top 20 changes
  } catch (error: any) {
    console.error('[database] Error fetching query digests:', error.message);
    return [];
  }
}

/**
 * Extract table names from SQL query text (simple parser)
 */
function extractTablesFromQuery(queryText: string): string[] {
  const tables = new Set<string>();
  const patterns = [
    /FROM\s+`?(\w+)`?/gi,
    /JOIN\s+`?(\w+)`?/gi,
    /INTO\s+`?(\w+)`?/gi,
    /UPDATE\s+`?(\w+)`?/gi,
  ];

  for (const pattern of patterns) {
    const matches = queryText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) tables.add(match[1]);
    }
  }

  return Array.from(tables);
}

/**
 * Get schema changes from information_schema or dba.schema_history if available.
 * Note: information_schema.TABLES.UPDATE_TIME may not capture all DDL changes.
 */
export async function getSchemaChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<SchemaChange[]> {
  console.log(`[database] Fetching schema changes for ${dbInstance}`);
  
  const session = getActiveSession();
  if (!session || !session.connected) {
    return [];
  }

  try {
    const conn = getConnection();
    const { offsetMs } = await getDbTimeOffset();

    const start = new Date(startTime);
    const end = new Date(endTime);
    const dbStart = new Date(start.getTime() + offsetMs);
    const dbEnd = new Date(end.getTime() + offsetMs);

    // Check if dba.schema_history table exists
    const [tableCheck] = await conn.query(`
      SELECT TABLE_NAME
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = 'dba' AND TABLE_NAME = 'schema_history'
    `);

    if ((tableCheck as any[]).length > 0) {
      // Use custom dba.schema_history if available
      const [rows] = await conn.query(`
        SELECT /*+ MAX_EXECUTION_TIME(5000) */
          table_name,
          change_type,
          ddl_statement,
          executed_at
        FROM dba.schema_history
        WHERE executed_at >= ? AND executed_at <= ?
        ORDER BY executed_at ASC
        LIMIT 50
      `, [dbStart, dbEnd]);

      return (rows as any[]).map(r => ({
        table: r.table_name || '',
        changeType: r.change_type || 'ALTER',
        statement: r.ddl_statement || '',
        timestamp: toUiIso(r.executed_at, offsetMs) || '',
      }));
    }

    // Fallback: detect from information_schema (limited - only shows recent updates)
    const [rows] = await conn.query(`
      SELECT 
        TABLE_NAME,
        CREATE_TIME,
        UPDATE_TIME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
        AND (UPDATE_TIME >= ? OR CREATE_TIME >= ?)
      ORDER BY COALESCE(UPDATE_TIME, CREATE_TIME) DESC
      LIMIT 20
    `, [dbStart, dbStart]);

    return (rows as any[]).map((r: any) => ({
      table: r.TABLE_NAME || '',
      changeType: r.CREATE_TIME >= dbStart ? 'CREATE' : 'ALTER',
      statement: `-- Schema change detected on ${r.TABLE_NAME} (information_schema fallback)`,
      timestamp: toUiIso(r.UPDATE_TIME || r.CREATE_TIME, offsetMs) || '',
    }));

  } catch (error: any) {
    console.error('[database] Error fetching schema changes:', error.message);
    return [];
  }
}
