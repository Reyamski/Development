import type { FieldPacket, ResultSetHeader, RowDataPacket } from 'mysql2';
import { getConnection } from './connection-manager.js';
import { guardSql, ensureSelectRowLimit, isSelectOrWith, stripSqlComments } from './sql-guard.js';

function escapeId(id: string): string {
  return id.replace(/`/g, '``');
}

export interface ColumnMeta {
  name: string;
  type: string;
}

export interface QuerySuccessSelect {
  kind: 'select';
  columns: ColumnMeta[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface QuerySuccessMutate {
  kind: 'mutate';
  rowsAffected: number;
  insertId?: number;
  executionTimeMs: number;
}

export type QuerySuccess = QuerySuccessSelect | QuerySuccessMutate;

export interface QueryError {
  error: string;
  blocked?: boolean;
  blockedPattern?: string;
}

/**
 * Run guarded SQL against the active Teleport MySQL session.
 */
export async function runQuery(options: {
  sql: string;
  database: string;
  rowLimit: number;
  timeoutMs: number;
}): Promise<QuerySuccess | QueryError> {
  const { sql, database, rowLimit, timeoutMs } = options;

  const g = guardSql(sql);
  if (!g.allowed) {
    return {
      error: g.reason ?? 'Query blocked',
      blocked: true,
      blockedPattern: g.blockedPattern,
    };
  }

  if (!database?.trim()) {
    return { error: 'database is required' };
  }

  let conn;
  try {
    conn = getConnection();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No connection' };
  }

  const started = Date.now();

  try {
    await conn.query(`USE \`${escapeId(database)}\``);

    // MySQL 5.7.8+ / 8.0: max_execution_time in milliseconds for SELECT
    const cappedTimeout = Math.min(Math.max(timeoutMs, 1000), 600_000);
    try {
      await conn.query(`SET SESSION max_execution_time = ?`, [cappedTimeout]);
    } catch {
      /* older MySQL — ignore */
    }

    const sqlTrim = stripSqlComments(sql).trim();
    const toRun = isSelectOrWith(sql) ? ensureSelectRowLimit(sql, rowLimit) : sqlTrim;

    const [packets, fields] = await conn.query<RowDataPacket[] | ResultSetHeader>(toRun);

    const executionTimeMs = Date.now() - started;

    if (Array.isArray(packets)) {
      const fieldList = (fields as FieldPacket[]) ?? [];
      const columns: ColumnMeta[] = fieldList.map((f) => ({
        name: f.name,
        type: String(f.columnType ?? 'unknown'),
      }));

      const rows = packets.map((row) => columns.map((c) => row[c.name] ?? null));
      const truncated = isSelectOrWith(sql) && packets.length >= rowLimit;

      return {
        kind: 'select',
        columns,
        rows,
        rowCount: packets.length,
        executionTimeMs,
        truncated,
      };
    }

    const header = packets as ResultSetHeader;
    return {
      kind: 'mutate',
      rowsAffected: header.affectedRows ?? 0,
      insertId: header.insertId,
      executionTimeMs,
    };
  } catch (e) {
    const executionTimeMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || 'Query failed' };
  }
}

/** Run EXPLAIN on a SELECT-like statement (still passes guard). */
export async function runExplain(options: { sql: string; database: string }): Promise<
  | { plan: Record<string, unknown>[]; raw: unknown; executionTimeMs: number }
  | QueryError
> {
  const { sql, database } = options;
  const trimmed = stripSqlComments(sql).trim();
  if (!isSelectOrWith(trimmed)) {
    return { error: 'EXPLAIN is only supported for SELECT / WITH queries' };
  }

  const g = guardSql(sql);
  if (!g.allowed) {
    return {
      error: g.reason ?? 'Query blocked',
      blocked: true,
      blockedPattern: g.blockedPattern,
    };
  }

  let conn;
  try {
    conn = getConnection();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No connection' };
  }

  const started = Date.now();
  try {
    await conn.query(`USE \`${escapeId(database)}\``);
    const explainSql = `EXPLAIN ${trimmed.replace(/;\s*$/, '')}`;
    const [rows] = await conn.query<RowDataPacket[]>(explainSql);
    const executionTimeMs = Date.now() - started;
    const plan = (rows as RowDataPacket[]).map((r) => ({ ...r }));
    return { plan, raw: rows, executionTimeMs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'EXPLAIN failed' };
  }
}

/** Rows to CSV (simple). */
export function rowsToCsv(columns: ColumnMeta[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c.name)).join(',');
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  return `${header}\n${body}\n`;
}
