export const OBJECT_TYPES = [
  'tables',
  'views',
  'procedures',
  'functions',
  'triggers',
  'events',
  'indexes',
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export interface ParsedColumn {
  name: string;
  definition: string; // full column definition (type, nullable, default, etc.)
}

export interface ParsedIndex {
  name: string;
  unique: boolean;
  columns: string[];
  type?: string; // BTREE, HASH, FULLTEXT, SPATIAL
}

export interface ParsedForeignKey {
  name: string;
  columns: string[];
  referenceTable: string;
  referenceColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
  primaryKey: string[] | null;
  indexes: ParsedIndex[];
  foreignKeys: ParsedForeignKey[];
  options: Record<string, string>; // ENGINE, CHARSET, COLLATE, etc.
  raw: string;
}

export interface ParsedIndexFile {
  indexName: string;
  tableName: string;
  unique: boolean;
  columns: string[];
  raw: string;
}

export interface ParsedText {
  normalized: string;
  raw: string;
}

export type ParsedObject = ParsedTable | ParsedIndexFile | ParsedText;

export interface SchemaFile {
  objectType: ObjectType;
  name: string; // filename without .sql
  key: string; // {objectType}/{name}
  path: string; // absolute file path
}

export interface SchemaFilePair {
  key: string;
  objectType: ObjectType;
  name: string;
  source?: SchemaFile;
  target?: SchemaFile;
}
