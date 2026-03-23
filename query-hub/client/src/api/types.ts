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

export interface ColumnMeta {
  name: string;
  type: string;
}

export type QueryExecuteResult =
  | {
      kind: 'select';
      columns: ColumnMeta[];
      rows: unknown[][];
      rowCount: number;
      executionTimeMs: number;
      truncated: boolean;
    }
  | {
      kind: 'mutate';
      rowsAffected: number;
      insertId?: number;
      executionTimeMs: number;
    };

export interface SchemaTable {
  name: string;
  type: string;
  engine: string | null;
  rowEstimate: number;
  dataSizeMb: number;
  indexSizeMb: number;
  comment: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: unknown;
  key: string;
  extra: string;
  comment: string;
}
