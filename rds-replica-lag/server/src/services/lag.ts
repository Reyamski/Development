import { getConnection } from './connection-manager.js';
import type { ReplicaStatus, ReplicationWorker, SlowApplier, GtidGap } from '../types.js';

/**
 * Safety: All queries here read from performance_schema (in-memory, lock-free)
 * and SHOW REPLICA STATUS (read-only replication metadata).
 * - No user table access, no disk I/O, no row locks.
 */

/**
 * Get current replica status via SHOW REPLICA STATUS.
 * Falls back to SHOW SLAVE STATUS for older MySQL versions.
 */
export async function getReplicaStatus(): Promise<ReplicaStatus | null> {
  const conn = getConnection();

  let rows: any[];
  try {
    const [result] = await conn.query('SHOW REPLICA STATUS');
    rows = result as any[];
  } catch {
    // Older MySQL uses SHOW SLAVE STATUS
    const [result] = await conn.query('SHOW SLAVE STATUS');
    rows = result as any[];
  }

  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  return {
    secondsBehindSource: r.Seconds_Behind_Master ?? r.Seconds_Behind_Source ?? null,
    ioThreadRunning: (r.Slave_IO_Running ?? r.Replica_IO_Running ?? '') === 'Yes',
    sqlThreadRunning: (r.Slave_SQL_Running ?? r.Replica_SQL_Running ?? '') === 'Yes',
    lastSqlError: r.Last_SQL_Error ?? '',
    lastIoError: r.Last_IO_Error ?? '',
    sourceHost: r.Master_Host ?? r.Source_Host ?? '',
    sourceLogFile: r.Master_Log_File ?? r.Source_Log_File ?? '',
    readSourceLogPos: Number(r.Read_Master_Log_Pos ?? r.Read_Source_Log_Pos ?? 0),
    relayLogFile: r.Relay_Log_File ?? '',
    execSourceLogPos: Number(r.Exec_Master_Log_Pos ?? r.Exec_Source_Log_Pos ?? 0),
    retrievedGtidSet: r.Retrieved_Gtid_Set ?? '',
    executedGtidSet: r.Executed_Gtid_Set ?? '',
    channelName: r.Channel_Name ?? '',
  };
}

/**
 * Get replication worker status from performance_schema.
 * Shows what each parallel replication worker is currently applying.
 */
export async function getReplicationWorkers(): Promise<ReplicationWorker[]> {
  const conn = getConnection();

  try {
    const [rows] = await conn.query(`
      SELECT
        WORKER_ID,
        THREAD_ID,
        SERVICE_STATE,
        LAST_ERROR_NUMBER,
        LAST_ERROR_MESSAGE,
        LAST_APPLIED_TRANSACTION,
        LAST_APPLIED_TRANSACTION_START_APPLY_TIMESTAMP,
        LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP,
        APPLYING_TRANSACTION,
        APPLYING_TRANSACTION_START_APPLY_TIMESTAMP
      FROM performance_schema.replication_applier_status_by_worker
      ORDER BY WORKER_ID
    `);

    return (rows as any[]).map(r => ({
      workerId: Number(r.WORKER_ID),
      threadId: r.THREAD_ID !== null ? Number(r.THREAD_ID) : null,
      serviceState: r.SERVICE_STATE ?? '',
      lastErrorNumber: Number(r.LAST_ERROR_NUMBER ?? 0),
      lastErrorMessage: r.LAST_ERROR_MESSAGE ?? '',
      lastAppliedTransaction: r.LAST_APPLIED_TRANSACTION ?? '',
      lastAppliedTransactionStartApplyTimestamp: r.LAST_APPLIED_TRANSACTION_START_APPLY_TIMESTAMP
        ? new Date(r.LAST_APPLIED_TRANSACTION_START_APPLY_TIMESTAMP).toISOString()
        : '',
      lastAppliedTransactionEndApplyTimestamp: r.LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP
        ? new Date(r.LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP).toISOString()
        : '',
      applyingTransaction: r.APPLYING_TRANSACTION ?? '',
      applyingTransactionStartApplyTimestamp: r.APPLYING_TRANSACTION_START_APPLY_TIMESTAMP
        ? new Date(r.APPLYING_TRANSACTION_START_APPLY_TIMESTAMP).toISOString()
        : '',
    }));
  } catch {
    return [];
  }
}

/**
 * Count the total number of transactions in a GTID set string.
 * Format: uuid:n[-m][:n[-m]...][,uuid:n[-m]...]
 */
function countGtids(gtidSet: string): number {
  const clean = gtidSet.replace(/\s/g, '');
  let total = 0;
  for (const part of clean.split(',')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    for (const interval of part.slice(colonIdx + 1).split(':')) {
      if (interval.includes('-')) {
        const [s, e] = interval.split('-').map(Number);
        if (!isNaN(s) && !isNaN(e)) total += e - s + 1;
      } else {
        const n = Number(interval);
        if (n > 0) total += 1;
      }
    }
  }
  return total;
}

/**
 * Compute GTID gap between what the replica has received vs applied.
 * Pure math — no DB query required (uses SHOW REPLICA STATUS data).
 */
export function computeGtidGap(retrieved: string, executed: string): GtidGap | null {
  if (!retrieved || !executed) return null;
  const retrievedCount = countGtids(retrieved);
  const executedCount = countGtids(executed);
  if (retrievedCount === 0) return null;
  const gapCount = Math.max(0, retrievedCount - executedCount);
  return {
    retrievedCount,
    executedCount,
    gapCount,
    gapPercent: Math.round((gapCount / retrievedCount) * 1000) / 10,
  };
}

/**
 * Find slow statements recently applied by replication worker threads.
 * Queries performance_schema.events_statements_history_long joined to
 * replication_applier_status_by_worker — in-memory, lock-free, zero impact.
 * Only returns statements that took > 1 second.
 */
export async function getSlowAppliers(): Promise<SlowApplier[]> {
  const conn = getConnection();
  try {
    const [rows] = await conn.query(`
      SELECT /*+ MAX_EXECUTION_TIME(5000) */
        eshl.THREAD_ID,
        rasw.WORKER_ID,
        LEFT(eshl.SQL_TEXT, 300)                        AS SQL_TEXT,
        ROUND(eshl.TIMER_WAIT / 1000000000000, 1)       AS DURATION_SEC,
        eshl.ROWS_AFFECTED,
        COALESCE(eshl.OBJECT_SCHEMA, '')                AS OBJECT_SCHEMA,
        COALESCE(eshl.OBJECT_NAME, '')                  AS OBJECT_NAME
      FROM performance_schema.events_statements_history_long eshl
      JOIN performance_schema.replication_applier_status_by_worker rasw
        ON eshl.THREAD_ID = rasw.THREAD_ID
      WHERE eshl.TIMER_WAIT > 1000000000000
      ORDER BY eshl.TIMER_WAIT DESC
      LIMIT 10
    `);
    return (rows as any[]).map(r => ({
      threadId: Number(r.THREAD_ID),
      workerId: r.WORKER_ID !== null ? Number(r.WORKER_ID) : null,
      sqlText: r.SQL_TEXT ?? '',
      durationSeconds: Number(r.DURATION_SEC),
      rowsAffected: Number(r.ROWS_AFFECTED ?? 0),
      schema: r.OBJECT_SCHEMA ?? '',
      table: r.OBJECT_NAME ?? '',
    }));
  } catch {
    return [];
  }
}
