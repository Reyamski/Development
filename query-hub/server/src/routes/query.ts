import { Router, Request, Response } from 'express';
import { guardSql, validateDatabaseName } from '../services/sql-guard.js';
import { runQuery, runExplain, rowsToCsv } from '../services/query-runner.js';

const router = Router();

const DEFAULT_ROW_LIMIT = 1000;
const DEFAULT_TIMEOUT_MS = 30_000;
const EXPORT_ROW_LIMIT = 50_000;

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { sql, database, rowLimit, timeoutMs } = req.body as {
      sql?: string;
      database?: string;
      rowLimit?: number;
      timeoutMs?: number;
    };
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'sql is required' });
      return;
    }
    const guard = guardSql(sql);
    if (!guard.allowed) {
      res.status(403).json({ error: guard.reason ?? 'Query blocked', blocked: true, blockedPattern: guard.blockedPattern });
      return;
    }
    const safeDatabase = validateDatabaseName(database ?? '');
    const result = await runQuery({
      sql: guard.cleanSql!,
      database: safeDatabase,
      rowLimit: Math.min(Number(rowLimit) || DEFAULT_ROW_LIMIT, 50_000),
      timeoutMs: Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 600_000),
    });
    if ('error' in result) {
      const status = result.blocked ? 403 : 400;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
  }
});

router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { sql, database } = req.body as { sql?: string; database?: string };
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'sql is required' });
      return;
    }
    const safeDatabase = validateDatabaseName(database ?? '');
    const result = await runExplain({ sql, database: safeDatabase });
    if ('error' in result) {
      const status = result.blocked ? 403 : 400;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
  }
});

router.post('/validate', (req: Request, res: Response) => {
  const { sql } = req.body as { sql?: string };
  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'sql is required' });
    return;
  }
  const g = guardSql(sql);
  res.json({
    valid: g.allowed,
    blocked: !g.allowed,
    blockedPattern: g.blockedPattern,
    reason: g.reason,
  });
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { sql, database, rowLimit } = req.body as {
      sql?: string;
      database?: string;
      rowLimit?: number;
    };
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'sql is required' });
      return;
    }
    const guard = guardSql(sql);
    if (!guard.allowed) {
      res.status(403).json({ error: guard.reason ?? 'Query blocked', blocked: true, blockedPattern: guard.blockedPattern });
      return;
    }
    const safeDatabase = validateDatabaseName(database ?? '');
    const result = await runQuery({
      sql: guard.cleanSql!,
      database: safeDatabase,
      rowLimit: Math.min(Number(rowLimit) || EXPORT_ROW_LIMIT, EXPORT_ROW_LIMIT),
      timeoutMs: 120_000,
    });
    if ('error' in result) {
      const status = result.blocked ? 403 : 400;
      res.status(status).json(result);
      return;
    }
    if (result.kind !== 'select') {
      res.status(400).json({ error: 'Export only supports SELECT-style result sets' });
      return;
    }
    const csv = rowsToCsv(result.columns, result.rows);
    const name = `query-hub-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
  }
});

export default router;
