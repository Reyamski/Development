import { ParsedIndexFile } from './types.js';

export function parseIndexFile(raw: string, fileName: string): ParsedIndexFile {
  // Parse CREATE [UNIQUE] INDEX name ON [schema.]table (col1, col2, ...)
  // Handles backtick-quoted and schema-qualified table names
  const match = raw.match(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+`?(\w+)`?\s+ON\s+(?:`?\w+`?\.)?`?(\w+)`?\s*\(([^)]+)\)/i
  );

  if (match) {
    const unique = !!match[1];
    const indexName = match[2];
    const tableName = match[3];
    const columns = match[4]
      .split(',')
      .map((c) => c.trim().replace(/`/g, '').replace(/\s*\(\d+\)/, ''));

    return { indexName, tableName, unique, columns, raw };
  }

  // Fallback: extract from filename convention {table}__{index}
  const parts = fileName.split('__');
  return {
    indexName: parts[1] || fileName,
    tableName: parts[0] || 'unknown',
    unique: false,
    columns: [],
    raw,
  };
}
