import { Router, Request, Response } from 'express';
import { getConnection } from '../services/connection-manager.js';
import {
  getMissingIndexCandidates,
  getUnusedIndexes,
  getDuplicateIndexes,
  getOverlappingIndexes,
  getHighWriteBloatRisk,
} from '../services/index-analyzer.js';

const router = Router();

router.post('/run', async (req: Request, res: Response) => {
  const { database } = req.body as { database?: string };
  if (!database) return res.status(400).json({ error: 'database required' }) as any;

  const conn = getConnection();
  if (!conn) return res.status(503).json({ error: 'Not connected. Connect to an RDS instance first.' }) as any;

  try {
    // Switch to the target database
    await conn.query('USE ??', [database]);

    const [missing, unused, duplicate, overlapping, bloat] = await Promise.all([
      getMissingIndexCandidates(conn, database).catch(() => []),
      getUnusedIndexes(conn, database).catch(() => []),
      getDuplicateIndexes(conn, database).catch(() => []),
      getOverlappingIndexes(conn, database).catch(() => []),
      getHighWriteBloatRisk(conn, database).catch(() => []),
    ]);

    res.json({
      missingIndexes: missing,
      unusedIndexes: unused,
      duplicateIndexes: duplicate,
      overlappingIndexes: overlapping,
      bloatRiskTables: bloat,
      analyzedAt: new Date().toISOString(),
      database,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
