import type { Connection } from 'mysql2/promise';
import type { CollationInfo } from '../types.js';

/**
 * Fetch collations at database/table/column level for a single schema.
 * Uses information_schema only — read-only.
 */
export async function fetchCollations(connection: Connection, database: string): Promise<CollationInfo[]> {
  const collations: CollationInfo[] = [];

  const [dbInfo] = await connection.query<any[]>(
    `SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
     FROM information_schema.SCHEMATA
     WHERE SCHEMA_NAME = ?`,
    [database]
  );

  if (dbInfo.length > 0) {
    collations.push({
      database,
      table: null,
      column: null,
      collation: dbInfo[0].DEFAULT_COLLATION_NAME,
      characterSet: dbInfo[0].DEFAULT_CHARACTER_SET_NAME,
      level: 'database'
    });
  }

  const [tables] = await connection.query<any[]>(
    `SELECT TABLE_NAME, TABLE_COLLATION
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' AND TABLE_COLLATION IS NOT NULL`,
    [database]
  );

  for (const table of tables) {
    collations.push({
      database,
      table: table.TABLE_NAME,
      column: null,
      collation: table.TABLE_COLLATION,
      characterSet: String(table.TABLE_COLLATION).split('_')[0],
      level: 'table'
    });
  }

  const [columns] = await connection.query<any[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND COLLATION_NAME IS NOT NULL`,
    [database]
  );

  for (const col of columns) {
    collations.push({
      database,
      table: col.TABLE_NAME,
      column: col.COLUMN_NAME,
      collation: col.COLLATION_NAME,
      characterSet: col.CHARACTER_SET_NAME,
      level: 'column'
    });
  }

  return collations;
}

/**
 * Fetch collations across multiple databases in a single connection.
 */
export async function fetchCollationsForDatabases(
  connection: Connection,
  databases: string[],
): Promise<CollationInfo[]> {
  const all: CollationInfo[] = [];
  for (const db of databases) {
    const rows = await fetchCollations(connection, db);
    all.push(...rows);
  }
  return all;
}
