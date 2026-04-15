import { Router, Request, Response } from 'express';
import { exportToConfluence, isConfigured } from '../services/confluence.js';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() });
});

router.post('/export', async (req: Request, res: Response) => {
  const { database, instance, results } = req.body as {
    database?: string;
    instance?: string;
    results?: any;
  };

  if (!database || !instance || !results) {
    return res.status(400).json({ error: 'database, instance, and results are required' });
  }

  try {
    const { pageUrl, summaryPageUrl } = await exportToConfluence(database, instance, results);
    res.json({ pageUrl, summaryPageUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
