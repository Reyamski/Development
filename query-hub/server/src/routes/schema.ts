import { Router, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { getConnection } from '../services/connection-manager.js';

const router = Router();

function escapeId(id: string): string {
  return id.replace(/`/g, '``');
}

router.get('/databases', async (_req: Request, res: Response) => {
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY SCHEMA_NAME",
    );
    const databases = (rows as RowDataPacket[]).map((r) => r.SCHEMA_NAME as string);
    res.json({ databases });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list databases' });
  }
});

router.get('/tables', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  if (!db) {
    res.status(400).json({ error: 'db query param is required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COMMENT
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [db],
    );
    const tables = (rows as RowDataPacket[]).map((r) => ({
      name: r.TABLE_NAME as string,
      type: r.TABLE_TYPE as string,
      engine: r.ENGINE as string | null,
      rowEstimate: Number(r.TABLE_ROWS) || 0,
      dataSizeMb: r.DATA_LENGTH != null ? Number(r.DATA_LENGTH) / (1024 * 1024) : 0,
      indexSizeMb: r.INDEX_LENGTH != null ? Number(r.INDEX_LENGTH) / (1024 * 1024) : 0,
      comment: (r.TABLE_COMMENT as string) || '',
    }));
    res.json({ tables });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list tables' });
  }
});

router.get('/columns', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  const table = req.query.table as string;
  if (!db || !table) {
    res.status(400).json({ error: 'db and table query params are required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [db, table],
    );
    const columns = (rows as RowDataPacket[]).map((r) => ({
      name: r.COLUMN_NAME as string,
      type: (r.COLUMN_TYPE as string) || (r.DATA_TYPE as string),
      nullable: (r.IS_NULLABLE as string) === 'YES',
      defaultValue: r.COLUMN_DEFAULT,
      key: (r.COLUMN_KEY as string) || '',
      extra: (r.EXTRA as string) || '',
      comment: (r.COLUMN_COMMENT as string) || '',
    }));
    res.json({ columns });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list columns' });
  }
});

router.get('/indexes', async (req: Request, res: Response) => {
  const db = req.query.db as string;
  const table = req.query.table as string;
  if (!db || !table) {
    res.status(400).json({ error: 'db and table query params are required' });
    return;
  }
  try {
    const conn = getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SHOW INDEX FROM \`${escapeId(table)}\` FROM \`${escapeId(db)}\``,
    );
    const byName = new Map<
      string,
      { name: string; unique: boolean; type: string; columns: string[] }
    >();
    for (const r of rows as RowDataPacket[]) {
      const name = r.Key_name as string;
      const col = r.Column_name as string;
      const unique = Number(r.Non_unique) === 0;
      const indexType = (r.Index_type as string) || 'BTREE';
      if (!byName.has(name)) {
        byName.set(name, { name, unique, type: indexType, columns: [] });
      }
      byName.get(name)!.columns.push(col);
    }
    res.json({ indexes: [...byName.values()] });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to list indexes' });
  }
});

export default router;
