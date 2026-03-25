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

export interface SchemaRoutine {
  name: string;
  type: 'PROCEDURE' | 'FUNCTION';
  comment: string;
}

export type SchemaDdlKind = 'table' | 'view' | 'procedure' | 'function' | 'event';

export interface SchemaEvent {
  name: string;
  status: string;
  eventType: string;
  executeAt: unknown;
  intervalValue: unknown;
  intervalField: string;
  starts: unknown;
  ends: unknown;
  comment: string;
}

/** One column participating in a FOREIGN KEY (composite keys = multiple rows). */
export interface SchemaForeignKeyEdge {
  constraintName: string;
  tableName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
}

/** Tables vs views referenced by a view or routine. */
export interface SchemaRefTablesViews {
  tables: string[];
  views: string[];
}

/** Event body references: base tables, views, and stored routines (CALL / backtick heuristic). */
export interface SchemaEventRefs extends SchemaRefTablesViews {
  routines: string[];
}

/** From GET /api/schema/object-dependencies */
export interface SchemaObjectDependencies {
  views: Record<string, SchemaRefTablesViews>;
  /** Keys: `PROCEDURE:name` or `FUNCTION:name` (uppercase). */
  routines: Record<string, SchemaRefTablesViews>;
  events: Record<string, SchemaEventRefs>;
}
