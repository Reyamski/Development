import type { ChildProcess } from 'child_process';

// ===== Teleport Types =====

export interface TeleportTunnel {
  process: ChildProcess;
  host: string;
  port: number;
  dbName: string;
  dbUser: string;
}

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
