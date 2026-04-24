import type { ChildProcess } from 'child_process';

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

export interface CollationInfo {
  database: string;
  table: string | null;
  column: string | null;
  collation: string;
  characterSet: string;
  level: 'database' | 'table' | 'column';
}

export interface Baseline {
  characterSet: string;
  collation: string;
}

export const DEFAULT_BASELINE: Baseline = {
  characterSet: 'utf8mb4',
  collation: 'utf8mb4_0900_ai_ci',
};

export interface CollationIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  type: string;
  database: string;
  table?: string;
  column?: string;
  description: string;
  currentCollation: string;
  currentCharset: string;
  expectedCollation: string;
  expectedCharset: string;
  level: 'database' | 'table' | 'column';
}

export interface CollationReport {
  instance: string;
  databases: string[];
  baseline: Baseline;
  collations: CollationInfo[];
  issues: CollationIssue[];
  timestamp: string;
}