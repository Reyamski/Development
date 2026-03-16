// ===== Teleport Types =====

export interface TeleportInstance {
  name: string;
  uri: string;
  accountId: string;
  region: string;
  instanceId: string;
}

export interface TeleportStatus {
  loggedIn: boolean;
  username: string;
  cluster?: string;
}

export interface ConnectionResult {
  connected: boolean;
  database: string;
  databases?: string[];
  version: string;
}

// ===== Replica Lag Types =====

export interface ReplicaStatus {
  secondsBehindSource: number | null;
  ioThreadRunning: boolean;
  sqlThreadRunning: boolean;
  lastSqlError: string;
  lastIoError: string;
  sourceHost: string;
  sourceLogFile: string;
  readSourceLogPos: number;
  relayLogFile: string;
  execSourceLogPos: number;
  retrievedGtidSet: string;
  executedGtidSet: string;
  channelName: string;
}

export interface ReplicationWorker {
  workerId: number;
  threadId: number | null;
  serviceState: string;
  lastErrorNumber: number;
  lastErrorMessage: string;
  lastAppliedTransaction: string;
  lastAppliedTransactionStartApplyTimestamp: string;
  lastAppliedTransactionEndApplyTimestamp: string;
  applyingTransaction: string;
  applyingTransactionStartApplyTimestamp: string;
}

export interface CloudWatchLagPoint {
  timestamp: string;
  lagSeconds: number;
}

export interface TimeRange {
  since: string; // ISO string
  until: string; // ISO string
  label: string;
}

export interface SlowApplier {
  threadId: number;
  workerId: number | null;
  sqlText: string;
  durationSeconds: number;
  rowsAffected: number;
  schema: string;
  table: string;
}

export interface GtidGap {
  retrievedCount: number;
  executedCount: number;
  gapCount: number;
  gapPercent: number;
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

export interface DbaDebugInfo {
  schemaAccessible: boolean;
  digestHistoryTableExists: boolean;
  queryLatencyTableExists: boolean;
  lastAsOfDate: string | null;
  source: 'query_sample_text' | 'digest_text_fallback' | 'none';
  rowCount: number;
  error: string | null;
}

export interface InvestigationData {
  slowAppliers: SlowApplier[];
  gtidGap: GtidGap | null;
  dbaSlowQueries?: DbaSlowQuery[];
  dbaDebug?: DbaDebugInfo;
}

export interface RdsParameterGroup {
  name: string;
  parameters: Record<string, { value: string; source: string }>;
}
