import type { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';

/** Build a compact schema string for Kiro / LLM system prompts. */
export async function buildSchemaSummary(conn: Connection, database: string, maxTables = 40): Promise<string> {
  if (!database?.trim()) return '';
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME LIMIT ?`,
    [database, maxTables],
  );
  const lines: string[] = [`Database: ${database}`];
  for (const t of tables as RowDataPacket[]) {
    const tableName = t.TABLE_NAME as string;
    const [cols] = await conn.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, tableName],
    );
    const parts = (cols as RowDataPacket[]).map((c) => {
      const pk = c.COLUMN_KEY === 'PRI' ? ' PK' : '';
      return `${c.COLUMN_NAME} ${c.COLUMN_TYPE}${pk}`;
    });
    lines.push(`Table ${tableName}: ${parts.join(', ')}`);
  }
  return lines.join('\n');
}
