export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ColumnDiff {
  name: string;
  status: DiffStatus;
  sourceDefinition?: string;
  targetDefinition?: string;
}

export interface IndexDiff {
  name: string;
  status: DiffStatus;
  sourceColumns?: string[];
  targetColumns?: string[];
  sourceUnique?: boolean;
  targetUnique?: boolean;
}

export interface ForeignKeyDiff {
  name: string;
  status: DiffStatus;
}

export interface TableDiffDetail {
  columns: ColumnDiff[];
  indexes: IndexDiff[];
  foreignKeys: ForeignKeyDiff[];
  primaryKeyChanged: boolean;
  optionChanges: Record<string, { source?: string; target?: string }>;
}

export interface ComparisonResult {
  key: string;
  objectType: string;
  name: string;
  status: DiffStatus;
  sourceRaw?: string;
  targetRaw?: string;
  tableDiff?: TableDiffDetail;
  collateDrift?: boolean;
  charsetDrift?: boolean;
}

export interface DiffOptions {
  ignoreFkNameOnly: boolean;
  ignoreIndexNameOnly: boolean;
  ignoreCollate: boolean;
  ignoreCharset: boolean;
  ignoreWhitespace: boolean;
}
